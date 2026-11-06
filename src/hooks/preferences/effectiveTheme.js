// Pure rules for the Appearance preference (ADR-0130), kept apart from the hook
// so the unit suite can pin them.

// 'system' follows the phone's prefers-color-scheme; 'light' / 'dark' override it.
export const effectiveTheme = (mode, systemDark) =>
  mode === 'light' || mode === 'dark' ? mode : systemDark ? 'dark' : 'light'

// What <html data-theme> holds. 'system' holds nothing, so the CSS media query decides.
export const themeAttribute = (mode) => (mode === 'light' || mode === 'dark' ? mode : null)
