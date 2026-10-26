/**
 * Result of a fuzzy match operation.
 */
export interface FuzzyMatchResult {
    /** Whether the query matched */
    matched: boolean;
    /** Score (higher is better). Based on consecutive matches, start-of-word matches, etc. */
    score: number;
    /** Indices of matched characters in the target string */
    matchIndices: number[];
}

/**
 * Perform a fuzzy match of `query` against `target`.
 *
 * Scoring:
 * - Consecutive character matches get a bonus
 * - Matching at the start of the string gets a bonus
 * - Matching at the start of a word (after - _ or uppercase) gets a bonus
 * - Exact prefix match gets the highest bonus
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatchResult {
    const queryLower = query.toLowerCase();
    const targetLower = target.toLowerCase();

    if (queryLower.length === 0) {
        return { matched: true, score: 0, matchIndices: [] };
    }

    if (queryLower.length > targetLower.length) {
        return { matched: false, score: 0, matchIndices: [] };
    }

    // Check for exact prefix match (highest priority)
    if (targetLower.startsWith(queryLower)) {
        const indices = Array.from({ length: queryLower.length }, (_, i) => i);
        const exactBonus = targetLower === queryLower ? 100 : 0;
        const lengthBonus = Math.max(0, 50 - targetLower.length);
        return {
            matched: true,
            score: 1000 + queryLower.length * 10 + exactBonus + lengthBonus,
            matchIndices: indices,
        };
    }

    // Fuzzy match
    const matchIndices: number[] = [];
    let queryIdx = 0;
    let score = 0;
    let lastMatchIdx = -2;

    for (
        let targetIdx = 0;
        targetIdx < targetLower.length && queryIdx < queryLower.length;
        targetIdx++
    ) {
        if (targetLower[targetIdx] === queryLower[queryIdx]) {
            matchIndices.push(targetIdx);

            // Consecutive match bonus
            if (targetIdx === lastMatchIdx + 1) {
                score += 15;
            }

            // Start of string bonus
            if (targetIdx === 0) {
                score += 25;
            }

            // Start of word bonus (after separator or camelCase boundary)
            if (targetIdx > 0) {
                const prevChar = target[targetIdx - 1];
                if (prevChar === "-" || prevChar === "_" || prevChar === " " || prevChar === "\\") {
                    score += 20;
                }
                // camelCase boundary
                if (
                    prevChar === prevChar.toLowerCase() &&
                    target[targetIdx] === target[targetIdx].toUpperCase()
                ) {
                    score += 15;
                }
            }

            // Base score for each match
            score += 10;

            lastMatchIdx = targetIdx;
            queryIdx++;
        }
    }

    const matched = queryIdx === queryLower.length;

    if (!matched) {
        return { matched: false, score: 0, matchIndices: [] };
    }

    // Bonus for shorter targets (more relevant matches)
    score += Math.max(0, 50 - targetLower.length);

    return { matched, score, matchIndices };
}

/**
 * Score a LaTeX command against a query by matching against both
 * the command name and description, returning the best score.
 */
export function scoreCommand(
    query: string,
    command: string,
    description: string,
): FuzzyMatchResult {
    const commandResult = fuzzyMatch(query, command);
    const descResult = fuzzyMatch(query, description);

    // Boost command name matches over description matches
    if (commandResult.matched) {
        commandResult.score += 100;
        // LaTeX names are case-sensitive. Each bonus exceeds the maximum
        // usage boost (500), so history cannot turn \Omega into \omega or
        // replace a fully typed command with a longer template.
        if (query.length > 0 && command.startsWith(query)) {
            commandResult.score += 600;
            if (command === query) commandResult.score += 600;
        }
    }

    if (commandResult.score >= descResult.score) {
        return commandResult;
    }
    return descResult;
}
