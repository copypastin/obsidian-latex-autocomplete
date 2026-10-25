export function renderMath(source: string, display: boolean): HTMLElement {
    const el = {
        textContent: source,
        className: display ? "math math-block" : "math math-inline",
    } as any;
    return el;
}

export function finishRenderMath(): Promise<void> {
    return Promise.resolve();
}

export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
export class Notice {}
