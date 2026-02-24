import type { TextMorphOptions } from "./types";
export type { TextMorphOptions } from "./types";
export declare const DEFAULT_AS = "div";
export declare const DEFAULT_TEXT_MORPH_OPTIONS: {
    readonly debug: false;
    readonly locale: "en";
    readonly duration: 400;
    readonly scale: true;
    readonly ease: "cubic-bezier(0.19, 1, 0.22, 1)";
    readonly disabled: false;
    readonly respectReducedMotion: true;
};
export declare class TextMorph {
    private element;
    private options;
    private data;
    private currentMeasures;
    private prevMeasures;
    private isInitialRender;
    private prefersReducedMotion;
    private mediaQuery?;
    static styleEl: HTMLStyleElement;
    constructor(options: TextMorphOptions);
    destroy(): void;
    private handleMediaQueryChange;
    private isDisabled;
    update(value: HTMLElement | string): void;
    private createTextGroup;
    private measure;
    private updateStyles;
    private addStyles;
    private removeStyles;
    private blocks;
    private blocksFallback;
    private log;
}
