// Pure rules for the Appearance preference (ADR-0130), kept apart from the hook
// so the unit suite can pin them. An unsaved Appearance reads as 'light'
// (the field's fallback, ADR-0131), so these rules need no special case for it.

// 'system' follows the phone's prefers-color-scheme; 'light' / 'dark' override it.
export const effectiveTheme = (mode, systemDark) =>
  mode === 'light' || mode === 'dark' ? mode : systemDark ? 'dark' : 'light'

// What <html data-theme> holds. 'system' holds nothing, so the CSS media query decides.
export const themeAttribute = (mode) => (mode === 'light' || mode === 'dark' ? mode : null)

// How long the night-mode bar's ✕ hides it on this device (ADR-0131).
export const NIGHT_SNOOZE_MS = 2 * 24 * 60 * 60 * 1000

export const offerNightMode = ({ chosen, systemDark, snoozedUntil, now }) =>
  !chosen && systemDark && !(snoozedUntil > now)
