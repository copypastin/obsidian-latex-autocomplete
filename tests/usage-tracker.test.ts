import test from "node:test";
import assert from "node:assert/strict";
import { UsageTracker, PluginStorage } from "../src/usage-tracker";

function createMockStorage(initialData: any = {}): {
    storage: PluginStorage;
    getData: () => any;
} {
    let stored = JSON.parse(JSON.stringify(initialData));
    return {
        storage: {
            loadData: async () => JSON.parse(JSON.stringify(stored)),
            saveData: async (data: any) => {
                stored = JSON.parse(JSON.stringify(data));
            },
        },
        getData: () => stored,
    };
}

test("UsageTracker: initial score is 0 for unrecorded commands", () => {
    const { storage } = createMockStorage();
    const tracker = new UsageTracker(storage);
    assert.strictEqual(tracker.getBoostScore("\\frac"), 0);
    assert.strictEqual(tracker.getUsage("\\frac"), undefined);
});

test("UsageTracker: recordUsage increases count and updates timestamp", () => {
    const { storage } = createMockStorage();
    const tracker = new UsageTracker(storage);

    const before = Date.now();
    tracker.recordUsage("\\frac");
    const after = Date.now();

    const usage = tracker.getUsage("\\frac");
    assert.ok(usage);
    assert.strictEqual(usage.count, 1);
    assert.ok(usage.lastUsed >= before && usage.lastUsed <= after);

    tracker.recordUsage("\\frac");
    assert.strictEqual(tracker.getUsage("\\frac")?.count, 2);
});

test("UsageTracker: frequency ranking boosts higher count commands", () => {
    const { storage } = createMockStorage();
    const tracker = new UsageTracker(storage);

    // Record \frac 5 times
    for (let i = 0; i < 5; i++) {
        tracker.recordUsage("\\frac");
    }

    // Record \alpha 1 time
    tracker.recordUsage("\\alpha");

    const fracScore = tracker.getBoostScore("\\frac");
    const alphaScore = tracker.getBoostScore("\\alpha");

    assert.ok(
        fracScore > alphaScore,
        `Expected fracScore (${fracScore}) > alphaScore (${alphaScore})`,
    );
    // Both should have significant scores due to recent usage + frequency
    assert.ok(fracScore > 200);
    assert.ok(alphaScore > 200);
});

test("UsageTracker: recency decay lowers score for older usages", async () => {
    const { storage } = createMockStorage({
        usageData: {
            "\\old": {
                count: 1,
                // 10 days ago (2 half-lives of 5 days)
                lastUsed: Date.now() - 10 * 24 * 60 * 60 * 1000,
            },
            "\\recent": {
                count: 1,
                lastUsed: Date.now(),
            },
        },
    });

    const tracker = new UsageTracker(storage);
    await tracker.load();

    const recentScore = tracker.getBoostScore("\\recent");
    const oldScore = tracker.getBoostScore("\\old");

    assert.ok(
        recentScore > oldScore,
        `Expected recentScore (${recentScore}) > oldScore (${oldScore})`,
    );
    // For 2 half-lives, recency portion drops from ~200 to ~50
    assert.ok(oldScore < 100);
});

test("UsageTracker: reset clears all recorded data", async () => {
    const { storage, getData } = createMockStorage();
    const tracker = new UsageTracker(storage);

    tracker.recordUsage("\\sum");
    tracker.recordUsage("\\prod");
    assert.ok(tracker.getBoostScore("\\sum") > 0);

    await tracker.reset();

    assert.strictEqual(tracker.getBoostScore("\\sum"), 0);
    assert.strictEqual(tracker.getBoostScore("\\prod"), 0);
    assert.strictEqual(tracker.getUsage("\\sum"), undefined);
    assert.deepStrictEqual(getData().usageData, {});
});

test("UsageTracker: persistence load and save", async () => {
    const { storage } = createMockStorage();
    const tracker1 = new UsageTracker(storage);

    tracker1.recordUsage("\\int");
    tracker1.recordUsage("\\int");
    await tracker1.save();

    // Create a new instance that loads from same storage
    const tracker2 = new UsageTracker(storage);
    await tracker2.load();

    const usage = tracker2.getUsage("\\int");
    assert.ok(usage);
    assert.strictEqual(usage.count, 2);
    assert.ok(tracker2.getBoostScore("\\int") > 0);
});
