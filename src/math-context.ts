import { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

/**
 * Checks if a character at index `index` in `str` is escaped by preceding backslashes.
 * An odd number of preceding backslashes means the character is escaped.
 * An even number (0, 2, 4...) means it is unescaped.
 */
export function isEscaped(str: string, index: number): boolean {
    let count = 0;
    let j = index - 1;
    while (j >= 0 && str[j] === "\\") {
        count++;
        j--;
    }
    return count % 2 === 1;
}

/**
 * Text-based fallback to check if cursor position is inside a LaTeX math context.
 *
 * Accurately handles:
 * 1. Fenced code blocks (```math / ```latex are math contexts; other languages are not)
 * 2. Multi-line and single-line display math $$...$$
 * 3. Inline math $...$ on the current line (excluding escaped \$)
 * 4. Inline code `...` (dollar signs inside backticks do not trigger math)
 *
 * @param docText The full document text up to `pos`
 * @param lineTextBefore Optional text on current line up to `pos` (defaults to last line of docText)
 */
export function isMathContextText(docText: string, lineTextBefore?: string): boolean {
    const lines = docText.split(/\r?\n/);
    if (lineTextBefore !== undefined) lines[lines.length - 1] = lineTextBefore;
    let fence: { char: string; length: number; math: boolean } | null = null;
    let inDisplayMath = false;
    let inInlineMath = false;
    let codeTicks = 0;

    // Scan in document order so delimiters inside code never affect later math.
    for (const line of lines) {
        inInlineMath = false;
        codeTicks = 0;
        const fenceMatch = line.match(/^[ \t>]*(?:[-*+]|\d+\.)?[ \t]*(`{3,}|~{3,})(.*)$/);
        if (fence) {
            if (
                fenceMatch &&
                fenceMatch[1][0] === fence.char &&
                fenceMatch[1].length >= fence.length &&
                fenceMatch[2].trim() === ""
            )
                fence = null;
            continue;
        }
        if (
            !inDisplayMath &&
            codeTicks === 0 &&
            fenceMatch &&
            (fenceMatch[1][0] !== "`" || !fenceMatch[2].includes("`"))
        ) {
            const info = fenceMatch[2].trim().toLowerCase();
            fence = {
                char: fenceMatch[1][0],
                length: fenceMatch[1].length,
                math: info === "math" || info === "latex",
            };
            continue;
        }

        for (let i = 0; i < line.length;) {
            if (
                !inDisplayMath &&
                !inInlineMath &&
                line[i] === "`" &&
                (codeTicks > 0 || !isEscaped(line, i))
            ) {
                let end = i + 1;
                while (line[end] === "`") end++;
                const length = end - i;
                if (codeTicks === 0) codeTicks = length;
                else if (length === codeTicks) codeTicks = 0;
                i = end;
                continue;
            }
            if (codeTicks === 0 && line[i] === "$" && !isEscaped(line, i)) {
                if (!inInlineMath && line[i + 1] === "$") {
                    inDisplayMath = !inDisplayMath;
                    i += 2;
                    continue;
                }
                if (!inDisplayMath) inInlineMath = !inInlineMath;
            }
            i++;
        }
    }
    return fence ? fence.math : codeTicks === 0 && (inDisplayMath || inInlineMath);
}

/**
 * Check if the cursor position is inside a math context.
 *
 * Strategy 1: Uses the CM6 syntax tree as the primary check.
 * - Detects math and latex nodes.
 * - Inspects fenced code blocks (recognizing math/latex code blocks while ignoring other languages).
 * - Avoids false positives inside inline code.
 *
 * Strategy 2: Robust text-based delimiter scanning as fallback.
 * - Handles multi-line $$...$$ display math.
 * - Handles inline $...$ while respecting escaped \$ signs.
 * - Handles ```math code blocks.
 */
export function isInMathContext(state: EditorState, pos: number): boolean {
    // Strategy 1: CM6 syntax tree check
    try {
        const tree = syntaxTree(state);
        if (tree) {
            let node = tree.resolveInner(pos, -1);
            let fencedCodeNode: typeof node | null = null;
            let foundMathNode = false;
            let foundNonMathCode = false;

            while (node) {
                const name = node.name.toLowerCase();
                if (name.includes("math") || name.includes("latex")) {
                    foundMathNode = true;
                    break;
                }
                if (name === "fencedcode" || name === "codeblock") {
                    fencedCodeNode = node;
                    break;
                }
                if (name === "inline-code" || name === "inlinecode") {
                    foundNonMathCode = true;
                    break;
                }
                if (!node.parent || node.parent === node) break;
                node = node.parent;
            }

            if (foundMathNode) {
                return true;
            }

            if (foundNonMathCode) {
                return false;
            }

            if (fencedCodeNode) {
                const codeInfo = fencedCodeNode.getChild("CodeInfo");
                if (codeInfo) {
                    const infoText = state
                        .sliceDoc(codeInfo.from, codeInfo.to)
                        .trim()
                        .toLowerCase();
                    if (infoText === "math" || infoText === "latex") {
                        return true;
                    }
                } else {
                    const firstLine = state.doc
                        .lineAt(fencedCodeNode.from)
                        .text.trim()
                        .toLowerCase();
                    if (
                        firstLine.startsWith("```math") ||
                        firstLine.startsWith("```latex") ||
                        firstLine.startsWith("~~~math") ||
                        firstLine.startsWith("~~~latex")
                    ) {
                        return true;
                    }
                }
                return false;
            }
        }
    } catch {
        // Fall back to text scanner on error
    }

    // Strategy 2: Text-based delimiter scanning fallback
    const docText = state.doc.sliceString(0, pos);
    const line = state.doc.lineAt(pos);
    const lineTextBefore = state.doc.sliceString(line.from, pos);
    return isMathContextText(docText, lineTextBefore);
}
