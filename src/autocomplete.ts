import {
    CompletionContext,
    CompletionResult,
    Completion,
    autocompletion,
    acceptCompletion,
    clearSnippet,
    closeCompletion,
    completionStatus,
    nextSnippetField,
    pickedCompletion,
    prevSnippetField,
    selectedCompletion,
    snippet,
} from "@codemirror/autocomplete";
import { EditorView, keymap, ViewUpdate } from "@codemirror/view";
import { EditorState, Extension, Prec } from "@codemirror/state";
import { renderMath, finishRenderMath } from "obsidian";
import { LATEX_COMMANDS, LatexCommand } from "./latex-commands";
import { isEscaped, isInMathContext } from "./math-context";
import { scoreCommand } from "./fuzzy-match";
import { UsageTracker } from "./usage-tracker";
import { LatexAutocompleteSettings } from "./settings";
import {
    clearLatexSuiteSnippet,
    GetLatexSuite,
    hasLatexSuiteSnippet,
    insertWithLatexSuite,
    LatexSuitePlugin,
} from "./latex-suite";

const completionQueries = new WeakMap<Completion, string>();
const applyingCompletion = new WeakSet<EditorView>();
const suiteSnippets = new WeakMap<EditorView, LatexSuitePlugin>();
const completeSymbols = new Set(
    LATEX_COMMANDS.filter((cmd) => cmd.command === cmd.template).map((cmd) => cmd.command),
);

/** A Suite expansion may invalidate the menu before CodeMirror redraws it. */
function acceptLatexCompletion(view: EditorView): boolean {
    const completion = selectedCompletion(view.state);
    const expected = completion ? completionQueries.get(completion) : undefined;
    if (
        expected !== undefined &&
        new CompletionContext(view.state, view.state.selection.main.head, false).matchBefore(
            /\\[a-zA-Z]*/,
        )?.text !== expected
    ) {
        closeCompletion(view);
        return false;
    }
    return acceptCompletion(view);
}

function clearAutocompleteSnippet(view: EditorView): boolean {
    if (clearSnippet(view)) return true;
    const suite = suiteSnippets.get(view);
    return suite !== undefined && clearLatexSuiteSnippet(view, suite);
}

function dismissAutocomplete(view: EditorView): boolean {
    const menuVisible = completionStatus(view.state) === "active";
    const closed = closeCompletion(view);
    // A pending query has no visible menu. It must not swallow Escape while
    // the user is filling a template and wants to leave its inputs.
    return menuVisible ? closed : clearAutocompleteSnippet(view) || closed;
}

/**
 * Human-readable category labels for the preview badge.
 */
const CATEGORY_LABELS: Record<string, string> = {
    "greek-lower": "Greek (Lower)",
    "greek-upper": "Greek (Upper)",
    operators: "Operators",
    relations: "Relations",
    arrows: "Arrows",
    calculus: "Calculus",
    "linear-algebra": "Linear Algebra",
    "diff-eq": "Diff Equations",
    sets: "Sets",
    logic: "Logic",
    accents: "Accents",
    fonts: "Fonts",
    delimiters: "Delimiters",
    environments: "Environments",
    spaces: "Spacing",
    misc: "Misc",
};

export function formatCategory(category: string): string {
    return CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Compute the cursor offset relative to the start of the inserted text.
 * - If the original template contained ${1}, lands at the position where ${1} was.
 * - Otherwise, if the inserted text contains an empty pair of braces "{}", lands inside the first "{}".
 * - Otherwise (no placeholders or empty braces), lands at the end of the text.
 */
export function computeCursorOffset(template: string, insertText: string): number {
    const p1 = template.indexOf("${1}");
    if (p1 !== -1) {
        return template.slice(0, p1).replace(/\$\{\d+\}/g, "").length;
    }
    const emptyBracesIndex = insertText.indexOf("{}");
    if (emptyBracesIndex !== -1) {
        return emptyBracesIndex + 1;
    }
    return insertText.length;
}

/**
 * Safely renders a LaTeX preview string into a container element.
 * Prioritizes Obsidian's official renderMath / finishRenderMath, with
 * robust fallbacks to window.MathJax, window.katex, or plain text.
 */
export function renderLatexPreview(container: HTMLElement, tex: string): void {
    // 1. Try Obsidian's official renderMath & finishRenderMath
    try {
        if (typeof renderMath === "function") {
            const mathEl = renderMath(tex, false);
            if (mathEl) {
                container.appendChild(mathEl);
                if (typeof finishRenderMath === "function") {
                    finishRenderMath();
                }
                return;
            }
        }
    } catch {
        // Fall back below
    }

    // 2. Safe fallbacks: window.MathJax, window.katex, or raw text
    try {
        const win = typeof window !== "undefined" ? (window as any) : null;
        if (win?.MathJax?.typesetPromise) {
            container.innerHTML = `\\(${tex}\\)`;
            win.MathJax.typesetPromise([container]);
        } else if (win?.katex?.render) {
            win.katex.render(tex, container, {
                throwOnError: false,
                displayMode: false,
            });
        } else {
            container.textContent = tex;
        }
    } catch {
        container.textContent = tex;
    }
}

/**
 * Create a CodeMirror 6 autocompletion extension for LaTeX commands.
 * Tab accepts completions, then navigates template inputs. The same bindings
 * also work when LaTeX Suite intercepts keyboard events before the editor.
 */
export function createLatexAutocomplete(
    settings: LatexAutocompleteSettings,
    usageTracker: UsageTracker,
    getLatexSuite?: GetLatexSuite,
): Extension {
    return [
        EditorState.allowMultipleSelections.of(true),
        autocompletion({
            override: [
                (context) => latexCompletionSource(context, settings, usageTracker, getLatexSuite),
            ],
            defaultKeymap: true,
            aboveCursor: false,
            icons: false,
        }),
        automaticCompletionTrigger(settings, usageTracker, getLatexSuite),
        Prec.highest(
            keymap.of([
                {
                    key: "Tab",
                    run: (view) => acceptLatexCompletion(view) || nextSnippetField(view),
                    shift: prevSnippetField,
                    // LaTeX Suite handles this scope before normal editor keys.
                    scope: "editor latex-suite",
                },
                {
                    key: "Enter",
                    run: acceptLatexCompletion,
                    scope: "editor latex-suite",
                },
                {
                    key: "Escape",
                    run: dismissAutocomplete,
                    scope: "editor latex-suite",
                },
            ]),
        ),
    ];
}

/**
 * CodeMirror only activates automatically for input.type transactions. Snippet
 * plugins can insert text without that annotation, or cancel a pending query by
 * setting the same selection again. Retry after those updates have settled.
 */
function automaticCompletionTrigger(
    settings: LatexAutocompleteSettings,
    usageTracker: UsageTracker,
    getLatexSuite?: GetLatexSuite,
): Extension {
    const pending = new WeakMap<EditorView, object>();
    const commandBeforeCursor = (state: EditorState): string | undefined => {
        if (!state.selection.main.empty) return undefined;
        return new CompletionContext(state, state.selection.main.head, false).matchBefore(
            /\\[a-zA-Z]*/,
        )?.text;
    };

    const listener = (update: ViewUpdate): void => {
        const { view, state, startState } = update;
        const suite = suiteSnippets.get(view);
        if (suite && !hasLatexSuiteSnippet(state, suite)) suiteSnippets.delete(view);
        if (applyingCompletion.has(view)) {
            pending.delete(view);
            return;
        }
        const before = completionStatus(startState);
        const after = completionStatus(state);
        const excluded = update.transactions.some(
            (tr) =>
                tr.isUserEvent("undo") ||
                tr.isUserEvent("redo") ||
                tr.isUserEvent("delete") ||
                tr.isUserEvent("input.paste") ||
                tr.isUserEvent("input.complete") ||
                tr.annotation(pickedCompletion) !== undefined,
        );

        // Preserve explicit dismissal and real cursor moves, including while a
        // retry is queued. Math-preview effects alone do not cancel a query.
        if (
            excluded ||
            (!update.docChanged &&
                update.selectionSet &&
                (!startState.selection.eq(state.selection) ||
                    update.transactions.some((tr) => tr.isUserEvent("select")))) ||
            (!update.docChanged && !update.selectionSet && before !== null && after === null)
        ) {
            pending.delete(view);
            return;
        }

        if (
            !settings.enabled ||
            state.readOnly ||
            !view.hasFocus ||
            view.composing ||
            after !== null
        )
            return;
        const selectionReset =
            update.selectionSet && before !== null && startState.selection.eq(state.selection);
        if (!update.docChanged && !selectionReset) return;
        const command = commandBeforeCursor(state);
        if (
            command === undefined ||
            (!selectionReset && before === null && command === commandBeforeCursor(startState))
        )
            return;
        if (pending.has(view)) return;

        const request = {};
        pending.set(view, request);
        queueMicrotask(() => {
            if (pending.get(view) !== request) return;
            pending.delete(view);
            // Settings changes may have removed this listener in the meantime.
            if (
                !view.state.facet(EditorView.updateListener).includes(listener) ||
                !view.hasFocus ||
                view.composing ||
                view.state.readOnly ||
                !view.state.selection.main.empty ||
                completionStatus(view.state) !== null
            )
                return;
            const context = new CompletionContext(
                view.state,
                view.state.selection.main.head,
                false,
                view,
            );
            // Restore the typing annotation without editing the document.
            // startCompletion would make this an explicit request and bypass
            // minChars on later queries (for example after backspacing).
            if (latexCompletionSource(context, settings, usageTracker, getLatexSuite)) {
                view.dispatch({ userEvent: "input.type" });
            }
        });
    };
    return EditorView.updateListener.of(listener);
}

export function latexCompletionSource(
    context: CompletionContext,
    settings: LatexAutocompleteSettings,
    usageTracker: UsageTracker,
    getLatexSuite?: GetLatexSuite,
): CompletionResult | null {
    if (!settings.enabled) return null;
    // Match \command pattern - find the backslash
    const beforeCursor = context.matchBefore(/\\[a-zA-Z]*/);
    if (!beforeCursor) {
        return null;
    }
    const line = context.state.doc.lineAt(beforeCursor.from);
    if (isEscaped(line.text, beforeCursor.from - line.from)) return null;

    // Check the cursor, not the left edge of the backslash: resolving the left
    // edge with bias -1 can pick up a closing $ from the previous math block.
    if (!isInMathContext(context.state, context.pos)) return null;

    // Get the query (everything after the backslash)
    const query = beforeCursor.text.slice(1);

    // A finished symbol needs no replacement. In particular, leave Suite's
    // automatic expansions alone and release Tab/Enter to its normal handlers.
    // Ctrl+Space can still request alternatives deliberately.
    if (!context.explicit && completeSymbols.has(beforeCursor.text)) return null;

    // Check minimum characters
    if (query.length < settings.minChars) {
        // Still show if explicitly requested (Ctrl+Space)
        if (!context.explicit) {
            return null;
        }
    }

    // Score and filter commands
    const scored: { cmd: LatexCommand; score: number }[] = [];
    for (const cmd of LATEX_COMMANDS) {
        const result = scoreCommand(query, cmd.command.slice(1), cmd.description);
        if (result.matched || query.length === 0) {
            const usageBoost = usageTracker.getBoostScore(cmd.command);
            scored.push({
                cmd,
                score: result.score + usageBoost,
            });
        }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Limit results
    const limited = scored.slice(0, settings.maxSuggestions);

    // Convert to CM6 Completion objects
    const options: Completion[] = limited.map(({ cmd }) => {
        const completion: Completion = {
            label: cmd.command,
            detail: cmd.description,
            type: "function",
            boost: 0,
            apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
                if (
                    !view.state.selection.main.empty ||
                    view.state.selection.main.head !== to ||
                    view.state.sliceDoc(from, to) !== beforeCursor.text
                ) {
                    closeCompletion(view);
                    return;
                }
                const suite = getLatexSuite?.();
                if (suite) {
                    applyingCompletion.add(view);
                    try {
                        if (insertWithLatexSuite(view, suite, cmd.template, from, to)) {
                            if (hasLatexSuiteSnippet(view.state, suite))
                                suiteSnippets.set(view, suite);
                            closeCompletion(view);
                            usageTracker.recordUsage(cmd.command);
                            return;
                        }
                    } finally {
                        applyingCompletion.delete(view);
                    }
                }
                // The snippet parser removes escapes before literal braces.
                // Double those escapes so LaTeX commands such as \left\{ survive.
                // A final stop keeps the last input editable with Shift+Tab and
                // lets Tab leave the entire command after all inputs are filled.
                const template = cmd.template.replace(/\\(?=(?:\$\{\d+\})*[{}])/g, "\\\\") + "${0}";
                snippet(template)(view, _completion, from, to);

                // Record usage for ranking
                usageTracker.recordUsage(cmd.command);
            },
            info: () => {
                // Create preview popup container
                const container = document.createElement("div");
                container.className = "latex-autocomplete-preview";

                // Category pill / badge
                const categoryEl = document.createElement("span");
                categoryEl.className = "latex-autocomplete-category";
                categoryEl.textContent = formatCategory(cmd.category);
                container.appendChild(categoryEl);

                // Prominent rendered math preview
                const mathEl = document.createElement("div");
                mathEl.className = "latex-autocomplete-math";
                renderLatexPreview(mathEl, cmd.preview);
                container.appendChild(mathEl);

                // Clean text description
                const descEl = document.createElement("div");
                descEl.className = "latex-autocomplete-desc";
                descEl.textContent = cmd.description;
                container.appendChild(descEl);

                return container;
            },
        };
        completionQueries.set(completion, beforeCursor.text);
        return completion;
    });

    if (options.length === 0) {
        return null;
    }

    return {
        from: beforeCursor.from,
        to: context.pos,
        options,
        filter: false, // Custom fuzzy filtering already applied
        update: (
            _current: CompletionResult,
            _from: number,
            _to: number,
            updateContext: CompletionContext,
        ): CompletionResult | null => {
            return latexCompletionSource(updateContext, settings, usageTracker, getLatexSuite);
        },
    };
}
