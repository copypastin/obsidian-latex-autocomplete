import { App, PluginSettingTab, Setting } from "obsidian";
import type LatexAutocompletePlugin from "./main";

export interface LatexAutocompleteSettings {
    /** Whether the plugin is enabled */
    enabled: boolean;
    /** Minimum characters after \ before showing suggestions */
    minChars: number;
    /** Maximum number of suggestions to show */
    maxSuggestions: number;
}

export const DEFAULT_SETTINGS: LatexAutocompleteSettings = {
    enabled: true,
    minChars: 0,
    maxSuggestions: 20,
};

export class LatexAutocompleteSettingTab extends PluginSettingTab {
    plugin: LatexAutocompletePlugin;

    constructor(app: App, plugin: LatexAutocompletePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "LaTeX Autocomplete Settings" });

        new Setting(containerEl)
            .setName("Enable autocomplete")
            .setDesc("Toggle LaTeX autocomplete on or off")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
                    this.plugin.settings.enabled = value;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Minimum characters")
            .setDesc(
                "Minimum number of characters to type after \\ before showing suggestions (0 = show immediately)",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(0, 3, 1)
                    .setValue(this.plugin.settings.minChars)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.minChars = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Maximum suggestions")
            .setDesc("Maximum number of suggestions to show in the dropdown")
            .addSlider((slider) =>
                slider
                    .setLimits(5, 50, 5)
                    .setValue(this.plugin.settings.maxSuggestions)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.maxSuggestions = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
