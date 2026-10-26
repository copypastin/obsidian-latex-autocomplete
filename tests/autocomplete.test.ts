import test from "node:test";
import assert from "node:assert/strict";
import {
    EditorSelection,
    EditorState,
    StateEffect,
    StateField,
    Transaction,
    TransactionSpec,
} from "@codemirror/state";
import { EditorView, runScopeHandlers, ViewUpdate } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import {
    clearSnippet,
    closeCompletion,
    CompletionContext,
    completionStatus,
    hasNextSnippetField,
    nextSnippetField,
    prevSnippetField,
} from "@codemirror/autocomplete";
import {
    computeCursorOffset,
    createLatexAutocomplete,
    formatCategory,
    latexCompletionSource,
} from "../src/autocomplete";
import { DEFAULT_SETTINGS, LatexAutocompleteSettings } from "../src/settings";
import { UsageTracker } from "../src/usage-tracker";
import { LATEX_COMMANDS } from "../src/latex-commands";
import type { GetLatexSuite, LatexSuiteInsert } from "../src/latex-suite";

function createEditor(
    doc: string,
    pos: number,
    settings = DEFAULT_SETTINGS,
    getLatexSuite?: GetLatexSuite,
) {
    const tracker = new UsageTracker({ loadData: async () => ({}), saveData: async () => {} });
    // Exercise real CodeMirror transactions and the extension's update listeners.
    // A DOM view isn't needed to check whether a completion query was activated.
    const view = {
        state: EditorState.create({
            doc,
            selection: { anchor: pos },
            extensions: [createLatexAutocomplete(settings, tracker, getLatexSuite)],
        }),
        hasFocus: true,
        composing: false,
        dispatch(spec: TransactionSpec | Transaction) {
            const startState = view.state;
            const tr = spec instanceof Transaction ? spec : startState.update(spec);
            view.state = tr.state;
            const update = {
                view,
                startState,
                state: tr.state,
                transactions: [tr],
                docChanged: tr.docChanged,
                selectionSet: tr.selection !== undefined,
            } as unknown as ViewUpdate;
            for (const listener of view.state.facet(EditorView.updateListener)) listener(update);
        },
    };
    return { view: view as unknown as EditorView, tracker };
}

function applyCommand(
    view: EditorView,
    tracker: UsageTracker,
    label: string,
    description?: string,
): void {
    const result = latexCompletionSource(
        new CompletionContext(view.state, view.state.selection.main.head, true),
        { ...DEFAULT_SETTINGS, maxSuggestions: LATEX_COMMANDS.length },
        tracker,
    )!;
    const completion = result.options.find(
        (o) => o.label === label && (!description || o.detail === description),
    );
    assert.ok(completion, `Missing command ${label}`);
    assert.equal(typeof completion.apply, "function");
    (completion.apply as Function)(view, completion, result.from, result.to);
}

function fillField(view: EditorView, value: string): void {
    const changes = view.state.changeByRange((range) => ({
        changes: { from: range.from, to: range.to, insert: value },
        range: EditorSelection.cursor(range.from + value.length),
    }));
    view.dispatch({ ...changes, userEvent: "input.type" });
}

function typeText(view: EditorView, text: string, userEvent?: string): void {
    const from = view.state.selection.main.head;
    view.dispatch({
        changes: { from, insert: text },
        selection: { anchor: from + text.length },
        userEvent,
    });
}

test("computeCursorOffset: template with ${1} placeholder", () => {
    // \frac{${1}}{${2}} becomes \frac{}{} when stripped.
    // Cursor should land inside first {}, which is at offset 6.
    const template = "\\frac{${1}}{${2}}";
    const insertText = "\\frac{}{}";
    const offset = computeCursorOffset(template, insertText);
    assert.strictEqual(offset, 6);
    // Verify that inserting at offset 6 puts cursor between first { and }
    assert.strictEqual(insertText[offset - 1], "{");
    assert.strictEqual(insertText[offset], "}");
});

test("computeCursorOffset: template with subscript and superscript placeholders", () => {
    const template = "\\int_{${1}}^{${2}}";
    const insertText = "\\int_{}^{}";
    const offset = computeCursorOffset(template, insertText);
    assert.strictEqual(offset, 6);
    assert.strictEqual(insertText[offset - 1], "{");
    assert.strictEqual(insertText[offset], "}");
});

test("computeCursorOffset: command without placeholders", () => {
    const template = "\\alpha";
    const insertText = "\\alpha";
    const offset = computeCursorOffset(template, insertText);
    assert.strictEqual(offset, 6); // At the end of \alpha
});

test("computeCursorOffset: empty braces without explicit ${1}", () => {
    const template = "\\text{}";
    const insertText = "\\text{}";
    const offset = computeCursorOffset(template, insertText);
    assert.strictEqual(offset, 6); // Inside {}
    assert.strictEqual(insertText[offset - 1], "{");
    assert.strictEqual(insertText[offset], "}");
});

test("formatCategory: maps known category keys to display names", () => {
    assert.strictEqual(formatCategory("calculus"), "Calculus");
    assert.strictEqual(formatCategory("greek-lower"), "Greek (Lower)");
    assert.strictEqual(formatCategory("greek-upper"), "Greek (Upper)");
    assert.strictEqual(formatCategory("linear-algebra"), "Linear Algebra");
    assert.strictEqual(formatCategory("diff-eq"), "Diff Equations");
    assert.strictEqual(formatCategory("spaces"), "Spacing");
});

test("latexCompletionSource: multiple letters keep suggestions alive via update()", () => {
    const { EditorState } = require("@codemirror/state");
    const { CompletionContext } = require("@codemirror/autocomplete");
    const { latexCompletionSource } = require("../src/autocomplete");
    const { DEFAULT_SETTINGS } = require("../src/settings");
    const { UsageTracker } = require("../src/usage-tracker");

    const mockStorage = { loadData: async () => ({}), saveData: async () => {} };
    const tracker = new UsageTracker(mockStorage);

    // 1. Initial state: $\\
    const doc1 = "$\\";
    const state1 = EditorState.create({ doc: doc1 });
    const ctx1 = new CompletionContext(state1, 2, false);
    const res1 = latexCompletionSource(ctx1, DEFAULT_SETTINGS, tracker);

    assert.ok(res1, "Expected completion result for \\");
    assert.strictEqual(res1.filter, false);
    assert.ok(typeof res1.update === "function", "Expected update function on result");
    assert.strictEqual(res1.from, 1);
    assert.strictEqual(res1.to, 2);

    // 2. Type 'f' -> $\\f
    const doc2 = "$\\f";
    const state2 = EditorState.create({ doc: doc2 });
    const ctx2 = new CompletionContext(state2, 3, false);
    const res2 = res1.update(res1, res1.from, 3, ctx2);

    assert.ok(res2, "Expected completion result for \\f");
    assert.strictEqual(res2.from, 1);
    assert.strictEqual(res2.to, 3);
    const hasFracInF = res2.options.some((o: any) => o.label === "\\frac");
    assert.ok(hasFracInF, "Expected \\frac in \\f suggestions");

    // 3. Type 'r' -> $\\fr (more than one letter!)
    const doc3 = "$\\fr";
    const state3 = EditorState.create({ doc: doc3 });
    const ctx3 = new CompletionContext(state3, 4, false);
    const res3 = res2.update(res2, res2.from, 4, ctx3);

    assert.ok(res3, "Expected completion result for \\fr (more than one letter)");
    assert.strictEqual(res3.from, 1);
    assert.strictEqual(res3.to, 4);
    const hasFracInFr = res3.options.some((o: any) => o.label === "\\frac");
    assert.ok(hasFracInFr, "Expected \\frac in \\fr suggestions");

    // 4. Type 'ac' -> $\\frac
    const doc4 = "$\\frac";
    const state4 = EditorState.create({ doc: doc4 });
    const ctx4 = new CompletionContext(state4, 6, false);
    const res4 = res3.update(res3, res3.from, 6, ctx4);

    assert.ok(res4, "Expected completion result for \\frac");
    assert.strictEqual(res4.options[0].label, "\\frac");
});

test("latexCompletionSource: closed inline and display math return suggestions before their closing delimiters", () => {
    for (const doc of ["$\\fr$", "${}\\fr{}$", "$$\n\\fr\n$$"]) {
        const pos = doc.indexOf("\\fr") + 3;
        const { view, tracker } = createEditor(doc, pos);
        const result = latexCompletionSource(
            new CompletionContext(view.state, pos, false),
            DEFAULT_SETTINGS,
            tracker,
        );
        assert.ok(result, `Missing completions in ${JSON.stringify(doc)}`);
        assert.equal(result.options[0].label, "\\frac");
        assert.equal(view.state.sliceDoc(result.to), doc.slice(pos));
    }
});

test("LaTeX Suite: completed symbols stay untouched and explicit suggestions preserve their case", () => {
    const symbols = LATEX_COMMANDS.filter(
        (command) => command.command === command.template && /^\\[A-Za-z]+$/.test(command.command),
    );
    for (const symbol of symbols) {
        const doc = "$" + symbol.command + "$";
        const pos = doc.length - 1;
        const { view, tracker } = createEditor(doc, pos);
        assert.equal(
            latexCompletionSource(
                new CompletionContext(view.state, pos, false),
                DEFAULT_SETTINGS,
                tracker,
            ),
            null,
            symbol.command,
        );
        const explicit = latexCompletionSource(
            new CompletionContext(view.state, pos, true),
            DEFAULT_SETTINGS,
            tracker,
        );
        assert.ok(explicit, symbol.command);
        assert.equal(explicit.options[0].label, symbol.command);
        assert.equal(view.state.doc.toString(), doc);
    }
});

test("LaTeX Suite: every case-sensitive command pair keeps the typed capitalization despite usage history", () => {
    const commands = LATEX_COMMANDS.filter((command) => /^\\[A-Za-z]+$/.test(command.command));
    for (const command of commands) {
        const other = commands.find(
            (candidate) =>
                candidate.command !== command.command &&
                candidate.command.toLowerCase() === command.command.toLowerCase(),
        );
        if (!other) continue;
        const prefix = command.command.slice(0, -1);
        const doc = "$" + prefix + "$";
        const { view } = createEditor(doc, doc.length - 1);
        const tracker = new UsageTracker({ loadData: async () => ({}), saveData: async () => {} });
        // Use the maximum possible boost to cover even a very frequent command.
        tracker.getBoostScore = (name) => (name === other.command ? 500 : 0);
        const result = latexCompletionSource(
            new CompletionContext(view.state, doc.length - 1, false),
            DEFAULT_SETTINGS,
            tracker,
        );
        assert.ok(result, prefix);
        const wanted = result.options.findIndex((option) => option.label === command.command);
        const unwanted = result.options.findIndex((option) => option.label === other.command);
        assert.ok(wanted >= 0 && (unwanted < 0 || wanted < unwanted), command.command);
    }
});

test("LaTeX Suite: an expansion invalidates old suggestions before they can replace it", async () => {
    const { view, tracker } = createEditor("$\\Ome$", 5);
    const result = latexCompletionSource(
        new CompletionContext(view.state, 5, false),
        DEFAULT_SETTINGS,
        tracker,
    )!;
    const lower = result.options.find((option) => option.label === "\\omega")!;
    view.dispatch({ changes: { from: 1, to: 5, insert: "\\Omega" }, selection: { anchor: 7 } });
    // Exercise both a stale range and CodeMirror's range mapped over the expansion.
    for (const to of [5, 7]) {
        (lower.apply as Function)(view, lower, 1, to);
        assert.equal(view.state.doc.toString(), "$\\Omega$");
    }
    await Promise.resolve();
    assert.equal(completionStatus(view.state), null);
    assert.equal(tracker.getUsage("\\omega"), undefined);
});

test("LaTeX Suite: completion acceptance hands templates to Suite without starting a second snippet session", async () => {
    const field = StateField.define<unknown>({ create: () => ({}), update: (value) => value });
    let calls = 0;
    const suite = {
        api: {
            fields: { tabstopsStateField: field },
            shortcuts: {
                snippet(
                    editor: EditorView,
                    edit: { from: number; to: number; insert: LatexSuiteInsert },
                ) {
                    calls++;
                    editor.dispatch({
                        changes: { from: edit.from, to: edit.to, insert: edit.insert.insert },
                        selection: { anchor: edit.from + edit.insert.tabstops[0].from },
                    });
                    return true;
                },
            },
        },
    };
    const getSuite = () => suite;
    const { view, tracker } = createEditor("$\\fr$", 4, DEFAULT_SETTINGS, getSuite);
    view.dispatch({ effects: StateEffect.appendConfig.of(field) });
    const result = latexCompletionSource(
        new CompletionContext(view.state, 4, false),
        DEFAULT_SETTINGS,
        tracker,
        getSuite,
    )!;
    const option = result.options.find((item) => item.label === "\\frac")!;
    (option.apply as Function)(view, option, result.from, result.to);
    await Promise.resolve();
    assert.equal(calls, 1);
    assert.equal(view.state.doc.toString(), "$\\frac{}{}$");
    assert.equal(view.state.selection.main.head, 7);
    assert.equal(hasNextSnippetField(view.state), false);
    assert.equal(completionStatus(view.state), null);
    assert.equal(tracker.getUsage("\\frac")?.count, 1);
});

test("LaTeX Suite: Escape ends an autocomplete template and leaves independent Suite snippets alone", () => {
    const start = StateEffect.define<null>();
    const end = StateEffect.define<null>();
    const field = StateField.define<unknown>({
        create: () => ({ tabstopGroups: [] }),
        update(value, transaction) {
            if (transaction.effects.some((effect) => effect.is(end))) return { tabstopGroups: [] };
            if (transaction.effects.some((effect) => effect.is(start)))
                return { tabstopGroups: [{}] };
            return value;
        },
    });
    const suite = {
        api: {
            effects: { removeAllTabstopsEffect: end },
            fields: { tabstopsStateField: field },
            shortcuts: {
                snippet(
                    editor: EditorView,
                    edit: { from: number; to: number; insert: LatexSuiteInsert },
                ) {
                    editor.dispatch({
                        changes: { from: edit.from, to: edit.to, insert: edit.insert.insert },
                        selection: { anchor: edit.from + edit.insert.tabstops[0].from },
                        effects: start.of(null),
                    });
                    return true;
                },
            },
        },
    };
    const getSuite = () => suite;
    const { view, tracker } = createEditor("$\\fr$", 4, DEFAULT_SETTINGS, getSuite);
    view.dispatch({ effects: StateEffect.appendConfig.of(field) });
    const result = latexCompletionSource(
        new CompletionContext(view.state, 4, false),
        DEFAULT_SETTINGS,
        tracker,
        getSuite,
    )!;
    const option = result.options.find((item) => item.label === "\\frac")!;
    (option.apply as Function)(view, option, result.from, result.to);
    typeText(view, "x", "input.type");
    assert.equal(completionStatus(view.state), "pending");
    const escape = {
        key: "Escape",
        keyCode: 27,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
    } as KeyboardEvent;
    assert.equal(runScopeHandlers(view, escape, "latex-suite"), true);
    assert.deepEqual(view.state.field(field), { tabstopGroups: [] });
    assert.equal(view.state.doc.toString(), "$\\frac{x}{}$");
    view.dispatch({ effects: start.of(null) });
    assert.equal(runScopeHandlers(view, escape, "latex-suite"), false);
    assert.deepEqual(view.state.field(field), { tabstopGroups: [{}] });
});

test("automatic activation: unannotated snippet edits inside closed math start a query", async () => {
    const { view } = createEditor("${}{}$", 3);
    for (const ch of ["\\", "f", "r"]) {
        typeText(view, ch);
        await Promise.resolve();
        assert.equal(completionStatus(view.state), "pending", `No query after ${ch}`);
    }
});

test("automatic activation: a same-position snippet selection does not cancel typing", async () => {
    const { view } = createEditor("${}{}$", 3);
    typeText(view, "\\fr", "input.type");
    assert.equal(completionStatus(view.state), "pending");
    view.dispatch({ selection: view.state.selection });
    await Promise.resolve();
    assert.equal(completionStatus(view.state), "pending");
});

test("automatic activation: effect-only math preview updates preserve pending queries", async () => {
    const { StateEffect } = await import("@codemirror/state");
    const previewUpdated = StateEffect.define<null>();
    const { view } = createEditor("${}{}$", 3);
    typeText(view, "\\fr", "input.type");
    view.dispatch({ effects: previewUpdated.of(null) });
    await Promise.resolve();
    assert.equal(completionStatus(view.state), "pending");
});

test("automatic activation: Escape dismisses until another command edit", async () => {
    const { view } = createEditor("${}{}$", 3);
    typeText(view, "\\fr");
    await Promise.resolve();
    assert.equal(completionStatus(view.state), "pending");
    assert.equal(closeCompletion(view), true);
    await Promise.resolve();
    assert.equal(completionStatus(view.state), null);
    typeText(view, "a");
    await Promise.resolve();
    assert.equal(completionStatus(view.state), "pending");
});

test("automatic activation: respects disabled settings, minimum characters, selection, focus, and non-math text", async () => {
    const cases: {
        doc: string;
        pos: number;
        text: string;
        settings?: LatexAutocompleteSettings;
        blur?: boolean;
        select?: boolean;
    }[] = [
        { doc: "$x$", pos: 2, text: "\\fr", settings: { ...DEFAULT_SETTINGS, enabled: false } },
        { doc: "$x$", pos: 2, text: "\\f", settings: { ...DEFAULT_SETTINGS, minChars: 2 } },
        { doc: "plain ", pos: 6, text: "\\fr" },
        { doc: "`code `", pos: 6, text: "\\fr" },
        { doc: "$x$", pos: 2, text: "\\fr", blur: true },
        { doc: "$x$", pos: 2, text: "\\fr", select: true },
    ];
    for (const c of cases) {
        const { view } = createEditor(c.doc, c.pos, c.settings);
        if (c.blur) Object.defineProperty(view, "hasFocus", { value: false });
        typeText(view, c.text);
        if (c.select) view.dispatch({ selection: { anchor: c.pos, head: c.pos + c.text.length } });
        await Promise.resolve();
        assert.equal(completionStatus(view.state), null, JSON.stringify(c));
    }
});

test("automatic activation: undo, paste, cursor moves, and completion acceptance do not reopen suggestions", async () => {
    for (const userEvent of ["undo", "redo", "input.paste", "input.complete"]) {
        const { view } = createEditor("${}{}$", 3);
        typeText(view, "\\fr", userEvent);
        await Promise.resolve();
        assert.equal(completionStatus(view.state), null, userEvent);
    }
    const { view } = createEditor("${}\\fr{}$", 6);
    view.dispatch({ selection: { anchor: 5 }, userEvent: "select.pointer" });
    await Promise.resolve();
    assert.equal(completionStatus(view.state), null);
});

test("completion acceptance: preserves the surrounding closed math and marks a completed input", async () => {
    const { view, tracker } = createEditor("${}\\fr{}$", 6);
    const result = latexCompletionSource(
        new CompletionContext(view.state, 6, false),
        DEFAULT_SETTINGS,
        tracker,
    )!;
    const fraction = result.options.find((o) => o.label === "\\frac")!;
    assert.equal(typeof fraction.apply, "function");
    (fraction.apply as Function)(view, fraction, result.from, result.to);
    await Promise.resolve();
    assert.equal(view.state.doc.toString(), "${}\\frac{}{}{}$");
    assert.equal(view.state.selection.main.head, 9);
    assert.equal(completionStatus(view.state), null);
    assert.equal(tracker.getUsage("\\frac")?.count, 1);
});

test("latexCompletionSource: does not treat a LaTeX line break as a command", () => {
    const { view, tracker } = createEditor("$\\\\", 3);
    assert.equal(
        latexCompletionSource(
            new CompletionContext(view.state, 3, false),
            DEFAULT_SETTINGS,
            tracker,
        ),
        null,
    );
});

test("automatic activation: reaching minChars activates, while explicit invocation can bypass it", async () => {
    const settings = { ...DEFAULT_SETTINGS, minChars: 2 };
    const { view, tracker } = createEditor("$$", 1, settings);
    typeText(view, "\\f");
    await Promise.resolve();
    assert.equal(completionStatus(view.state), null);
    assert.ok(latexCompletionSource(new CompletionContext(view.state, 3, true), settings, tracker));
    typeText(view, "r");
    await Promise.resolve();
    assert.equal(completionStatus(view.state), "pending");
});

test("latexCompletionSource: a closing math syntax node before the backslash does not activate outside math", () => {
    const language = StreamLanguage.define({
        startState: () => ({ math: false }),
        token(stream, state) {
            if (stream.eat("$")) {
                state.math = !state.math;
                return "math";
            }
            if (state.math) {
                stream.eatWhile(/[^$]/);
                return "math";
            }
            stream.next();
            return null;
        },
        tokenTable: { math: tags.string },
    });
    const doc = "$x$\\fr";
    const state = EditorState.create({ doc, extensions: [language] });
    const { tracker } = createEditor("", 0);
    assert.equal(
        latexCompletionSource(
            new CompletionContext(state, doc.length, false),
            DEFAULT_SETTINGS,
            tracker,
        ),
        null,
    );
});

test("templates: Tab fills all nine matrix cells and then exits the environment", () => {
    const { view, tracker } = createEditor("$\\$", 2);
    applyCommand(view, tracker, "\\begin{bmatrix} 3x3");
    for (let cell = 1; cell <= 9; cell++) {
        assert.ok(hasNextSnippetField(view.state), `Cell ${cell} has no next Tab stop`);
        fillField(view, String(cell));
        assert.equal(nextSnippetField(view), true);
    }
    assert.equal(
        view.state.doc.toString(),
        "$\\begin{bmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{bmatrix}$",
    );
    assert.equal(view.state.selection.main.head, view.state.doc.length - 1);
    assert.equal(hasNextSnippetField(view.state), false);
    assert.equal(nextSnippetField(view), false);
});

test("templates: Shift+Tab returns to a filled field and typing replaces its value", () => {
    const { view, tracker } = createEditor("$\\$", 2);
    applyCommand(view, tracker, "\\frac");
    fillField(view, "longNumerator");
    assert.equal(nextSnippetField(view), true);
    fillField(view, "denominator");
    assert.equal(prevSnippetField(view), true);
    assert.equal(
        view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to),
        "longNumerator",
    );
    fillField(view, "x");
    assert.equal(nextSnippetField(view), true);
    assert.equal(
        view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to),
        "denominator",
    );
    assert.equal(nextSnippetField(view), true);
    assert.equal(view.state.doc.toString(), "$\\frac{x}{denominator}$");
    assert.equal(view.state.selection.main.head, view.state.doc.length - 1);
});

test("templates: every catalog command preserves LaTeX text and every numbered field is navigable", () => {
    for (const command of LATEX_COMMANDS) {
        assert.doesNotMatch(
            command.template,
            /\\{3,}/,
            `${command.command}: duplicate LaTeX row separators`,
        );
        const { view, tracker } = createEditor("$\\$", 2);
        applyCommand(view, tracker, command.command, command.description);
        const fields = [
            ...new Set([...command.template.matchAll(/\$\{(\d+)\}/g)].map((m) => Number(m[1]))),
        ].sort((a, b) => a - b);
        assert.equal(
            view.state.doc.toString(),
            "$" + command.template.replace(/\$\{\d+\}/g, "") + "$",
            command.command,
        );
        for (const field of fields) {
            assert.ok(
                hasNextSnippetField(view.state),
                `${command.command}: field ${field} is unreachable`,
            );
            fillField(view, `v${field}`);
            assert.equal(nextSnippetField(view), true, command.command);
        }
        const expected = command.template.replace(/\$\{(\d+)\}/g, (_, field) => `v${field}`);
        assert.equal(view.state.doc.toString(), "$" + expected + "$", command.command);
        assert.equal(view.state.selection.main.head, view.state.doc.length - 1, command.command);
        assert.equal(hasNextSnippetField(view.state), false, command.command);
    }
});

test("templates: Tab works in LaTeX Suite's keyboard scope and is released after the last field", () => {
    const { view, tracker } = createEditor("$\\$", 2);
    applyCommand(view, tracker, "\\sqrt[n]");
    const event = {
        key: "Tab",
        keyCode: 9,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
    } as KeyboardEvent;
    fillField(view, "3");
    assert.equal(runScopeHandlers(view, event, "latex-suite"), true);
    fillField(view, "x");
    assert.equal(
        runScopeHandlers(view, { ...event, shiftKey: true } as KeyboardEvent, "latex-suite"),
        true,
    );
    assert.equal(
        view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to),
        "3",
    );
    assert.equal(runScopeHandlers(view, event, "latex-suite"), true);
    assert.equal(runScopeHandlers(view, event, "latex-suite"), true);
    assert.equal(runScopeHandlers(view, event, "latex-suite"), false);
    assert.equal(view.state.doc.toString(), "$\\sqrt[3]{x}$");
});

test("templates: Escape ends navigation and moving outside the field releases Tab", () => {
    const { view, tracker } = createEditor("$\\$", 2);
    applyCommand(view, tracker, "\\frac");
    assert.equal(clearSnippet(view), true);
    assert.equal(nextSnippetField(view), false);
    const other = createEditor("$\\$", 2);
    applyCommand(other.view, other.tracker, "\\frac");
    other.view.dispatch({ selection: { anchor: other.view.state.doc.length } });
    assert.equal(nextSnippetField(other.view), false);
});
