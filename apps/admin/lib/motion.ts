/** Every shared-layout indicator: pill tabs, tab bar, nav rail. */
export const TAB_SPRING = { type: "spring", stiffness: 350, damping: 30 } as const;
/** Dialogs and sheets. */
export const DIALOG_SPRING = { type: "spring", stiffness: 320, damping: 34, mass: 0.8 } as const;
/** Toasts and banners sliding in. Exit is a plain fade. */
export const BANNER_SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;
/** House ease-out. CSS twin: --ease-out-quint. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.45, 0.05, 0.2, 1] as const;
