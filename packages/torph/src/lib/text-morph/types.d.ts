export interface TextMorphOptions {
    debug?: boolean;
    element: HTMLElement;
    locale?: Intl.LocalesArgument;
    scale?: boolean;
    duration?: number;
    ease?: string;
    disabled?: boolean;
    respectReducedMotion?: boolean;
    onAnimationStart?: () => void;
    onAnimationComplete?: () => void;
}
