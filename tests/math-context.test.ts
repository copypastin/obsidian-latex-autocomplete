import test from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { isInMathContext, isMathContextText, isEscaped } from "../src/math-context";

test("isEscaped: correctly detects backslash escaping", () => {
    assert.strictEqual(isEscaped("$", 0), false);
    assert.strictEqual(isEscaped("hello $", 6), false);
    assert.strictEqual(isEscaped("\\$", 1), true);
    assert.strictEqual(isEscaped("cost: \\$50", 7), true);
    assert.strictEqual(isEscaped("\\\\$", 2), false); // 2 backslashes = unescaped $
    assert.strictEqual(isEscaped("\\\\\\$", 3), true); // 3 backslashes = escaped $
    assert.strictEqual(isEscaped("\\\\\\\\$", 4), false); // 4 backslashes = unescaped $
});

test("isMathContextText: inline math detection", () => {
    // Inside inline math
    assert.strictEqual(isMathContextText("Let $x = \\alpha"), true);
    assert.strictEqual(isMathContextText("Formula $\\frac{1}{2}"), true);

    // Outside inline math (closed)
    assert.strictEqual(isMathContextText("Let $x = 1$ and now plain text"), false);

    // Multiple inline math segments
    assert.strictEqual(isMathContextText("$a$ text $b$ text $c"), true);
    assert.strictEqual(isMathContextText("$a$ text $b$ text $c$ done"), false);
});

test("isMathContextText: escaped dollar signs are not delimiters", () => {
    assert.strictEqual(isMathContextText("The price is \\$50 and not math"), false);
    assert.strictEqual(isMathContextText("Total is \\$10 and \\$20 today"), false);
    assert.strictEqual(isMathContextText("Price \\$50 but math is $x + 1"), true);
});

test("isMathContextText: display math single-line and multi-line", () => {
    // Unclosed single-line display math
    assert.strictEqual(isMathContextText("$$E = mc^2"), true);

    // Closed single-line display math
    assert.strictEqual(isMathContextText("$$E = mc^2$$ plain text"), false);

    // Multi-line display math (inside)
    const multilineInside = ["Some text before", "$$", "\\int_{0}^{1} f(x) dx"].join("\n");
    assert.strictEqual(isMathContextText(multilineInside), true);

    // Multi-line display math (closed)
    const multilineClosed = [
        "Some text before",
        "$$",
        "\\int_{0}^{1} f(x) dx",
        "$$",
        "Some text after",
    ].join("\n");
    assert.strictEqual(isMathContextText(multilineClosed), false);
});

test("isMathContextText: fenced code blocks", () => {
    // ```math code block
    const mathBlock = ["```math", "\\alpha + \\beta"].join("\n");
    assert.strictEqual(isMathContextText(mathBlock), true);

    // ```latex code block
    const latexBlock = ["```latex", "\\frac{a}{b}"].join("\n");
    assert.strictEqual(isMathContextText(latexBlock), true);

    // ```python code block (should NOT be math context)
    const pythonBlock = ["```python", "x = '$not_math'"].join("\n");
    assert.strictEqual(isMathContextText(pythonBlock), false);

    // Closed math block followed by text
    const closedMathBlock = ["```math", "\\alpha", "```", "plain text"].join("\n");
    assert.strictEqual(isMathContextText(closedMathBlock), false);

    // List-embedded code fence (e.g. - ```code ... ```) followed by math
    const listFenceDoc = ["- ```python", "  x = 10", "  ```", "- Some notes", "${} \\fr {}$"].join(
        "\n",
    );
    assert.strictEqual(isMathContextText(listFenceDoc, "${} \\fr"), true);
});

test("isMathContextText: inline code prevents math triggering", () => {
    assert.strictEqual(isMathContextText("`const $var = 1;` plain text"), false);
    assert.strictEqual(isMathContextText("`inline code` and now $x = 1"), true);
});

test("isMathContextText: negative cases", () => {
    assert.strictEqual(isMathContextText("Just plain markdown text"), false);
    assert.strictEqual(isMathContextText(""), false);
    assert.strictEqual(isMathContextText("\\alpha outside math"), false);
});

test("isInMathContext with EditorState", () => {
    // Test inside inline math
    const doc1 = "Here is $x = \\alpha$ and more";
    const state1 = EditorState.create({ doc: doc1 });
    // Position 12 is inside $x = \alpha$
    assert.strictEqual(isInMathContext(state1, 12), true);
    // Position 24 is outside
    assert.strictEqual(isInMathContext(state1, 24), false);

    // Test inside multi-line display math
    const doc2 = "$$\n\\frac{1}{2}\n$$";
    const state2 = EditorState.create({ doc: doc2 });
    // Inside the display math block (line 2)
    assert.strictEqual(isInMathContext(state2, 5), true);

    // Test escaped dollar in EditorState
    const doc3 = "Price is \\$50 and \\$20";
    const state3 = EditorState.create({ doc: doc3 });
    assert.strictEqual(isInMathContext(state3, doc3.length), false);
});

test("math context: closed math is active before its closing delimiter, and inactive after it", () => {
    for (const doc of ["${}\\fr{}$", "$$\n\\fr\n$$"]) {
        const state = EditorState.create({ doc });
        assert.equal(isInMathContext(state, doc.indexOf("\\fr") + 3), true);
        assert.equal(isInMathContext(state, doc.length), false);
    }
});

test("math context: dollar delimiters in completed code fences do not leak into later text", () => {
    for (const language of ["js", "math", "latex", ""]) {
        const prefix = `\`\`\`${language}\n$$\n\`\`\`\n`;
        assert.equal(isMathContextText(prefix + "plain \\fr"), false, language);
        assert.equal(isMathContextText(prefix + "$\\fr"), true, language);
    }
});

test("math context: ignores display delimiters in single and multiple backtick code spans", () => {
    for (const prefix of ["`$$`", "``a ` $$ b``", "```inline $$ code```"]) {
        assert.equal(isMathContextText(prefix + " plain \\fr"), false, prefix);
        assert.equal(isMathContextText(prefix + " $\\fr"), true, prefix);
    }
});

test("math context: backticks inside math do not become Markdown code", () => {
    assert.equal(isMathContextText("$x` + \\fr"), true);
    assert.equal(isMathContextText("$$x` + \\fr"), true);
});

test("math context: a supplied cursor-line prefix excludes closing delimiters", () => {
    assert.equal(isMathContextText("${}\\fr{}$", "${}\\fr"), true);
    assert.equal(isMathContextText("$$\\fr$$", "$$\\fr"), true);
});

test("math context: an unfinished inline code span on an earlier line does not suppress later math", () => {
    assert.equal(isMathContextText("An unfinished `code span\n$\\fr"), true);
});
