// The two WPA constants that a non-WPA caller needs, kept in a leaf module with
// NO imports of its own.
//
// This file exists for a bundle reason, not a design one. src/lib/milbColors.js
// needs exactly these two values, and milbColors is on the eager first-paint
// path (lib/headerTheme.js -> SiteHeader). Importing them from wpaLogo.js and
// wpaBandColors.js pulled both of those modules — and, through wpaLogo.js,
// the whole of data/wpa-tuning.json — into the entry graph, so every first
// visit downloaded the per-team win-probability logo tuning for all 30 clubs
// before painting a slate that does not draw a WPA chart at all.
//
// wpaLogo.js and wpaBandColors.js both re-export their value from here, so
// every existing import site keeps working and the WPA modules stay the place
// you look for WPA things. Keep this file dependency-free — an import here
// would put whatever it reaches straight back onto the eager path.

// Global layout defaults for the win-probability chart's logo wallpaper. The
// prose explaining what each number does lives with the rendering code in
// wpaLogo.js, which reads them back out of this object; the Team Color Lab
// seeds its per-team controls from the same values.
export const WPA_LOGO_DEFAULTS = {
  size: 20,
  rotate: -14,
  offsetX: 8,
  offsetY: 6,
  paddingX: 4,
  paddingY: 4,
  rowShift: 0,
}

// The pinstripe line color at its default weight — the same literal
// mainTreatmentPinstripeColor/treatmentPinstripeColor (teams.js) fall back to,
// so a pinstriped WPA band always matches a pinstriped logo-box tile exactly
// unless a team/treatment explicitly picks its own line color.
export const DEFAULT_PINSTRIPE_COLOR = 'rgba(0, 0, 0, 0.16)'
