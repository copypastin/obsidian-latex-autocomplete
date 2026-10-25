import test from "node:test";
import assert from "node:assert/strict";
import { fuzzyMatch, scoreCommand } from "../src/fuzzy-match";

test("fuzzyMatch: exact prefix match", () => {
    const result = fuzzyMatch("frac", "frac");
    assert.strictEqual(result.matched, true);
    assert.ok(result.score >= 1000, `Expected score >= 1000, got ${result.score}`);
    assert.deepStrictEqual(result.matchIndices, [0, 1, 2, 3]);
});

test("fuzzyMatch: case insensitivity", () => {
    const result1 = fuzzyMatch("FRAC", "frac");
    const result2 = fuzzyMatch("frac", "FRAC");
    const result3 = fuzzyMatch("FrAc", "fRaC");
    assert.strictEqual(result1.matched, true);
    assert.strictEqual(result2.matched, true);
    assert.strictEqual(result3.matched, true);
    assert.strictEqual(result1.score, result2.score);
});

test("fuzzyMatch: subsequence fuzzy matching", () => {
    const result = fuzzyMatch("alp", "alpha");
    assert.strictEqual(result.matched, true);
    assert.deepStrictEqual(result.matchIndices, [0, 1, 2]);

    const nonConsecutive = fuzzyMatch("apa", "alpha");
    assert.strictEqual(nonConsecutive.matched, true);
    assert.deepStrictEqual(nonConsecutive.matchIndices, [0, 2, 4]);
});

test("fuzzyMatch: empty query matches everything with score 0", () => {
    const result = fuzzyMatch("", "anything");
    assert.strictEqual(result.matched, true);
    assert.strictEqual(result.score, 0);
    assert.deepStrictEqual(result.matchIndices, []);
});

test("fuzzyMatch: query longer than target fails", () => {
    const result = fuzzyMatch("longquery", "short");
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.score, 0);
    assert.deepStrictEqual(result.matchIndices, []);
});

test("fuzzyMatch: non-matching query fails", () => {
    const result = fuzzyMatch("xyz", "alpha");
    assert.strictEqual(result.matched, false);
    assert.strictEqual(result.score, 0);
});

test("fuzzyMatch: consecutive matches score higher than non-consecutive", () => {
    // "abc" in "abcdef" (consecutive) vs "abc" in "axbycz" (separated)
    const consecutive = fuzzyMatch("abc", "abcdef");
    const separated = fuzzyMatch("abc", "axbycz");
    assert.strictEqual(consecutive.matched, true);
    assert.strictEqual(separated.matched, true);
    assert.ok(consecutive.score > separated.score);
});

test("fuzzyMatch: start-of-word boundary bonus", () => {
    // "eq" matching start of word after delimiter in "diff-eq"
    const wordBoundary = fuzzyMatch("eq", "diff-eq");
    assert.strictEqual(wordBoundary.matched, true);
    assert.deepStrictEqual(wordBoundary.matchIndices, [5, 6]);
});

test("fuzzyMatch: shorter target bonus when matching same characters", () => {
    const shortTarget = fuzzyMatch("int", "int");
    const longTarget = fuzzyMatch("int", "intersection");
    assert.ok(shortTarget.score > longTarget.score);
});

test("scoreCommand: boosts command name over description", () => {
    // Query "int" matches command "int" (with +100 command bonus)
    // and matches description "Integral"
    const result = scoreCommand("int", "int", "integral");
    assert.strictEqual(result.matched, true);
    assert.ok(result.score >= 1100);
});

test("scoreCommand: matches against description when command doesn't match", () => {
    // Query "fraction" does not match command "frac", but matches description "Fraction"
    const result = scoreCommand("fraction", "frac", "Fraction");
    assert.strictEqual(result.matched, true);
    assert.ok(result.score > 0);
});

test("scoreCommand: ranking comparison for commands", () => {
    const scoreFrac = scoreCommand("frac", "frac", "Fraction");
    const scorePartial = scoreCommand("frac", "partial", "Partial derivative");
    assert.ok(scoreFrac.score > scorePartial.score);
});
