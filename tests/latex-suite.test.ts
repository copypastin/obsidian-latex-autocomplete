import test from "node:test";
import assert from "node:assert/strict";
import { EditorState, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { LATEX_COMMANDS } from "../src/latex-commands";
import { insertWithLatexSuite, toLatexSuiteInsert } from "../src/latex-suite";

test("LaTeX Suite: every template preserves literal TeX and supplies ordered native tabstops", () => {
    for (const command of LATEX_COMMANDS) {
        const result = toLatexSuiteInsert(command.template);
        assert.equal(result.insert, command.template.replace(/\$\{\d+\}/g, ""), command.command);
        const fields = [...command.template.matchAll(/\$\{(\d+)\}/g)];
        assert.equal(
            result.tabstops.length,
            fields.length + (fields.length ? 1 : 0),
            command.command,
        );
        let removed = 0;
        fields.forEach((match, index) => {
            assert.deepEqual(
                result.tabstops[index],
                {
                    index: [Number(match[1])],
                    from: match.index - removed,
                    to: match.index - removed,
                },
                command.command,
            );
            removed += match[0].length;
        });
        if (fields.length) {
            assert.deepEqual(
                result.tabstops.at(-1),
                {
                    index: [Math.max(...fields.map((match) => Number(match[1]))) + 1],
                    from: result.insert.length,
                    to: result.insert.length,
                },
                command.command,
            );
        }
    }
});

test("LaTeX Suite: uses the enabled native engine and falls back when its API or editor fields are unavailable", () => {
    const field = StateField.define<unknown>({ create: () => ({}), update: (value) => value });
    const state = EditorState.create({ doc: "$\\fr$", extensions: [field] });
    const view = { state } as EditorView;
    let calls = 0;
    const suite = {
        api: {
            fields: { tabstopsStateField: field },
            shortcuts: {
                snippet(
                    editor: EditorView,
                    edit: {
                        from: number;
                        to: number;
                        insert: ReturnType<typeof toLatexSuiteInsert>;
                    },
                ) {
                    calls++;
                    assert.equal(editor, view);
                    assert.deepEqual(edit, {
                        from: 1,
                        to: 4,
                        insert: toLatexSuiteInsert("\\frac{${1}}{${2}}"),
                    });
                    return true;
                },
            },
        },
    };
    assert.equal(insertWithLatexSuite(view, suite, "\\frac{${1}}{${2}}", 1, 4), true);
    assert.equal(calls, 1);
    assert.equal(insertWithLatexSuite(view, {}, "\\frac{${1}}{${2}}", 1, 4), false);
    assert.equal(
        insertWithLatexSuite(
            view,
            { ...suite, settings: { snippetsEnabled: false } },
            "\\frac{${1}}{${2}}",
            1,
            4,
        ),
        false,
    );
    assert.equal(
        insertWithLatexSuite(
            { state: EditorState.create() } as EditorView,
            suite,
            "\\frac{${1}}{${2}}",
            1,
            4,
        ),
        false,
    );
    assert.equal(calls, 1);
});
