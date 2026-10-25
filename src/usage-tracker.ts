export interface UsageData {
    /** Number of times this command has been used */
    count: number;
    /** Timestamp of last use (ms since epoch) */
    lastUsed: number;
}

export interface UsageStore {
    [command: string]: UsageData;
}

export interface PluginStorage {
    loadData(): Promise<any>;
    saveData(data: any): Promise<void>;
}

/**
 * Tracks command usage for recency + frequency ranking.
 * Persists data through Obsidian's plugin data storage.
 */
export class UsageTracker {
    private data: UsageStore = {};
    private plugin: PluginStorage;
    private dirty = false;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(plugin: PluginStorage) {
        this.plugin = plugin;
    }

    async load(): Promise<void> {
        const saved = await this.plugin.loadData();
        if (saved && saved.usageData) {
            this.data = saved.usageData;
        }
    }

    async save(): Promise<void> {
        if (!this.dirty) return;
        const existing = (await this.plugin.loadData()) || {};
        existing.usageData = this.data;
        await this.plugin.saveData(existing);
        this.dirty = false;
    }

    /**
     * Record a command usage. Debounces saves to avoid excessive disk writes.
     */
    recordUsage(command: string): void {
        if (!this.data[command]) {
            this.data[command] = { count: 0, lastUsed: 0 };
        }
        this.data[command].count++;
        this.data[command].lastUsed = Date.now();
        this.dirty = true;

        // Debounced save
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => this.save(), 5000);
        if (
            typeof this.saveTimeout === "object" &&
            "unref" in this.saveTimeout &&
            typeof (this.saveTimeout as any).unref === "function"
        ) {
            (this.saveTimeout as any).unref();
        }
    }

    /**
     * Get a boost score for a command based on usage history.
     * Returns a value between 0 and 500.
     *
     * Formula: frequency_score + recency_score
     * - frequency_score: log2(count + 1) * 30, capped at 300
     * - recency_score: exponential decay based on time since last use
     *   200 * exp(-timeSinceLastUse / (7 * 24 * 60 * 60 * 1000))
     *   (half-life of about 5 days)
     */
    getBoostScore(command: string): number {
        const usage = this.data[command];
        if (!usage) return 0;

        // Frequency score: logarithmic scaling, capped at 300
        const freqScore = Math.min(300, Math.log2(usage.count + 1) * 30);

        // Recency score: exponential decay with ~5 day half-life
        const timeSinceLastUse = Date.now() - usage.lastUsed;
        const halfLifeMs = 5 * 24 * 60 * 60 * 1000; // 5 days
        const decayRate = Math.LN2 / halfLifeMs;
        const recencyScore = 200 * Math.exp(-decayRate * timeSinceLastUse);

        return freqScore + recencyScore;
    }

    /**
     * Get usage data for a specific command.
     */
    getUsage(command: string): UsageData | undefined {
        return this.data[command];
    }

    /**
     * Reset all usage data.
     */
    async reset(): Promise<void> {
        this.data = {};
        this.dirty = true;
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        await this.save();
    }
}
