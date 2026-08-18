Status: resolved

# Highlight sheet renders UNDER the floating bar, making the clip unwatchable

## Summary

Reported from an iPhone (screenshot, 2026-07-26): opening a "▶ Watch" clip on
a revealed at-bat gives a sheet whose video has the floating Refresh pill
sitting in the middle of it, the "Next at-bat / Rest of half" reveal bar
drawn across the bottom of the sheet, and the clip's caption washed out by
that bar's fade-to-canvas gradient. Taps aimed at the bottom of the player —
including its own scrubber — land on the page chrome behind the sheet instead.

## Root cause

`.scrim` is `position: fixed; z-index: 100`, which is above `.pagenav`'s
z-index 20 **only in the root stacking context**. `HighlightSheet` is declared
inside `PlayByPlay` → `HalfInning` → `InningPage`, and `InningPageTurn` wraps
every half-inning page in `.turnscene`, which sets `isolation: isolate`
deliberately (so an in-flight page turn can never paint over the floating
bar — see ADR-0024's scene layering). That isolation traps every descendant
z-index inside the scene, the scrim's 100 included, so the whole dialog paints
below the fixed chrome. `.turnscene__layer--active` also picks up
`will-change: clip-path` mid-turn, which would re-root a fixed child's
containing block on top of that.

Nothing about the sheet's own CSS was wrong — raising its z-index further
would have changed nothing, since the comparison never reaches the root
context.

## Fix

New `src/components/ModalPortal.jsx` — a one-line `createPortal(children,
document.body)` wrapper carrying the explanation — applied to every `.scrim`
dialog declared inside a half-inning page:

- `HighlightSheet` (`HighlightSheet.jsx`) — the reported bug.
- `StrikeZoneModal` (`StrikeZone.jsx`) — same subtree, same defect: the
  centered pitch-zone modal's lower half sat under the reveal bar.
- `PitchColorsModal` (`StrikeZone.jsx`) — same, on the wide layout where the
  "Pitch colors" key is visible.

Portalling leaves `.turnscene`'s layering untouched, and React events still
travel the React tree, so each dialog's backdrop-tap handler, Escape listener,
and focus hand-off keep working unchanged. A pointer to `ModalPortal.jsx` was
added to `.turnscene`'s comment block in `index.css` so the next person to add
a dialog here finds the trap before shipping it.

Dialogs declared outside a half-inning page (BallparkModal, SiteMenu, the
GameView sketch modal, …) were never affected — they already render in the
root stacking context.

## Verification

`e2e/inning-modal-stacking.spec.js` (new), anchored on the pinned 2026-07-07
MIL@STL g2 game whose top of the 1st carries two highlight clips. Asserts each
dialog escapes `.turnscene` (`body > .scrim`) and then hit-tests the clip's
top edge, middle, bottom edge, and caption so a future regression that merely
*looks* fine can't pass — `toBeVisible()` is happy with a fully covered
element. Three of its four tests fail on the pre-fix code and all four pass
after; the fourth pins the backdrop-tap dismiss + focus-return across the
portal boundary.

Also re-ran `npm run lint`, `npm test` (668 pass), and `npm run build`.

## Comments

2026-08-18: Closed out during issue-tracker triage — this shipped (highlights-cascade PRs #586-589, #601: src/api/highlights.js, HighlightSheet.jsx, ModalPortal.jsx, HighlightClipCard.jsx, Team/PlayerHighlightsRail all present in src/). No GitHub issue needed.
