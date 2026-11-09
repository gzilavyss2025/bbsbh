// Pure rules for the Appearance preference (ADR-0130, ADR-0131), kept apart from
// the hook so the unit suite can pin them.
//
// `chosen` is whether the person ever saved an Appearance (usePreferences().has).
// Until they do, the page stays light even on a dark device, and the night-mode
// bar offers the switch (ADR-0131). A saved 'system' follows the device.

// 'system' follows the phone's prefers-color-scheme; 'light' / 'dark' override it.
export const effectiveTheme = (mode, systemDark, chosen = true) =>
  mode === 'light' || mode === 'dark' ? mode : chosen && systemDark ? 'dark' : 'light'

// What <html data-theme> holds. A saved 'system' holds nothing, so the CSS media
// query decides; no choice yet holds 'light'.
export const themeAttribute = (mode, chosen = true) =>
  mode === 'light' || mode === 'dark' ? mode : chosen ? null : 'light'

// How long the bar's ✕ hides it on this device.
export const NIGHT_SNOOZE_MS = 2 * 24 * 60 * 60 * 1000

export const offerNightMode = ({ chosen, systemDark, snoozedUntil, now }) =>
  !chosen && systemDark && !(snoozedUntil > now)
