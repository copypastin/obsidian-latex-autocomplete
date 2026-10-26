import type { EditorState, StateEffectType, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export interface LatexSuiteInsert {
    insert: string;
    tabstops: { index: number[]; from: number; to: number }[];
}

type InsertSnippet = (
    view: EditorView,
    edit: { from: number; to: number; insert: LatexSuiteInsert },
) => boolean;

/** The optional public API exposed by LaTeX Suite. */
export interface LatexSuitePlugin {
    settings?: { snippetsEnabled?: boolean };
    api?: {
        effects?: { removeAllTabstopsEffect?: StateEffectType<null> };
        fields?: { tabstopsStateField?: StateField<unknown> };
        shortcuts?: { snippet?: InsertSnippet };
    };
}

export type GetLatexSuite = () => LatexSuitePlugin | null | undefined;

export function hasLatexSuiteSnippet(state: EditorState, suite: LatexSuitePlugin): boolean {
    const field = suite.api?.fields?.tabstopsStateField;
    const value = field && (state.field(field, false) as { tabstopGroups?: unknown[] } | undefined);
    return (value?.tabstopGroups?.length ?? 0) > 0;
}

export function clearLatexSuiteSnippet(view: EditorView, suite: LatexSuitePlugin): boolean {
    const effect = suite.api?.effects?.removeAllTabstopsEffect;
    if (!effect || !hasLatexSuiteSnippet(view.state, suite)) return false;
    view.dispatch({ effects: effect.of(null) });
    return true;
}

export function suiteCanInsert(state: EditorState, suite: LatexSuitePlugin): boolean {
    const field = suite.api?.fields?.tabstopsStateField;
    return (
        suite.settings?.snippetsEnabled !== false &&
        typeof suite.api?.shortcuts?.snippet === "function" &&
        field !== undefined &&
        state.field(field, false) !== undefined
    );
}

/** Supply literal TeX and tabstop offsets to Suite without reparsing escapes. */
export function toLatexSuiteInsert(template: string): LatexSuiteInsert {
    const tabstops: LatexSuiteInsert["tabstops"] = [];
    let removed = 0;
    let lastIndex = 0;
    const insert = template.replace(/\$\{(\d+)\}/g, (marker, field: string, offset: number) => {
        const index = Number(field);
        const position = offset - removed;
        tabstops.push({ index: [index], from: position, to: position });
        lastIndex = Math.max(lastIndex, index);
        removed += marker.length;
        return "";
    });
    if (tabstops.length > 0) {
        tabstops.push({ index: [lastIndex + 1], from: insert.length, to: insert.length });
    }
    return { insert, tabstops };
}

export function insertWithLatexSuite(
    view: EditorView,
    suite: LatexSuitePlugin,
    template: string,
    from: number,
    to: number,
): boolean {
    if (!suiteCanInsert(view.state, suite)) return false;
    return suite.api!.shortcuts!.snippet!(view, {
        from,
        to,
        insert: toLatexSuiteInsert(template),
    });
}
