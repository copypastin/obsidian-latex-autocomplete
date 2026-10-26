import { Plugin } from "obsidian";
import { Extension } from "@codemirror/state";
import {
    LatexAutocompleteSettings,
    DEFAULT_SETTINGS,
    LatexAutocompleteSettingTab,
} from "./settings";
import { UsageTracker } from "./usage-tracker";
import { createLatexAutocomplete } from "./autocomplete";
import type { LatexSuitePlugin } from "./latex-suite";

export default class LatexAutocompletePlugin extends Plugin {
    settings: LatexAutocompleteSettings = DEFAULT_SETTINGS;
    usageTracker: UsageTracker = new UsageTracker(this);
    private editorExtension: Extension[] = [];

    async onload(): Promise<void> {
        console.log("Loading LaTeX Autocomplete plugin");

        // Load settings
        await this.loadSettings();

        // Load usage data
        await this.usageTracker.load();

        // Add settings tab
        this.addSettingTab(new LatexAutocompleteSettingTab(this.app, this));

        // Create and register the editor extension
        this.updateEditorExtension();
        this.registerEditorExtension(this.editorExtension);

        // Add a command to reset usage data
        this.addCommand({
            id: "reset-usage-data",
            name: "Reset autocomplete usage data",
            callback: async () => {
                await this.usageTracker.reset();
                // @ts-ignore
                new (await import("obsidian")).Notice("LaTeX Autocomplete: Usage data reset");
            },
        });
    }

    onunload(): void {
        console.log("Unloading LaTeX Autocomplete plugin");
        this.usageTracker.save();
    }

    async loadSettings(): Promise<void> {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
    }

    async saveSettings(): Promise<void> {
        const data = (await this.loadData()) || {};
        data.settings = this.settings;
        await this.saveData(data);
        // Rebuild the extension when settings change
        this.updateEditorExtension();
    }

    private updateEditorExtension(): void {
        this.editorExtension.length = 0;
        this.editorExtension.push(
            createLatexAutocomplete(this.settings, this.usageTracker, () => {
                // Resolve at use time so either plugin can be enabled first.
                const manager = (
                    this.app as typeof this.app & {
                        plugins?: { getPlugin(id: string): LatexSuitePlugin | null | undefined };
                    }
                ).plugins;
                return manager?.getPlugin("obsidian-latex-suite");
            }),
        );
        this.app.workspace.updateOptions();
    }
}
