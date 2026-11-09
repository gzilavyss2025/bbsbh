# Night mode is offered, not automatic

**Status:** Accepted (Gary, 2026-11-09 interview). Amends ADR-0130 decision 1 ("Trigger").
**Date:** 2026-11-09

## Context

ADR-0130 made the app follow the device's dark mode by default. Gary does not want a dark
device to switch the app dark by itself. The person should be asked first.

## Decision

1. **No choice yet means light.** Until the person saves an Appearance, `<html>` gets
   `data-theme="light"`, even on a dark device. "No choice" is an absent `appearance` field in
   the preference document (`usePreferences().has`). A saved `system` still follows the device.
   The rule is `themeAttribute(mode, chosen)` in `src/hooks/preferences/effectiveTheme.js`; the
   pre-paint script in `index.html` copies it.
2. **The bar.** `src/components/account/NightModeBar.jsx` shows above every route when the
   device is in dark mode, no Appearance is saved, and no snooze is live. It reacts live to the
   device switching modes. Copy: "We noticed you have Dark Mode on. Use it here too?"
   - **Dark Mode** saves `system` (follow the device from now on).
   - **Light Mode** saves `light`. The bar never shows again.
   - **✕** snoozes it for 48 hours on this device only (`localStorage`
     `bbsbh:nightbar:snoozedUntil`). Clearing site data brings it back sooner.
3. **My Tally** shows Light as selected while no Appearance is saved, because that is what the
   person sees.

## Consequences

People who already saved an Appearance see no change. People who never touched it and have a
dark device go from automatic dark to light plus the bar, once.
