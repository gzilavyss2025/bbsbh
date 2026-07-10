# Game Notes → What's Brewing: extend the parser to the other 28 clubs

The lineup page's **Game notes** button opens an in-app modal of the punny
narrative blurbs parsed out of a club's pre-game Game Notes PDF — but only for
**calibrated** clubs. So far: Brewers (158, `column` layout) and Pirates (134,
`flow`). Every other club just links out to the raw PDF. Goal: calibrate the rest.

- Parser + per-club `CONFIG`: `src/api/whatsBrewing.js`
- How the parse works / two layouts / Node harness: `docs/whats-brewing.md`
- Modal: `src/components/WhatsBrewingModal.jsx`; button: `GameNotesButton` in
  `src/screens/TeamInfo.jsx` (gated on `hasWhatsBrewing(teamId)`)

## Start here: `CALIBRATION.md`

The upfront font/geometry read-off for all 28 remaining clubs is done — narrative
**page**, **body/head font** tests, **geometry**, sample **titles**, **caveats**,
and a GREEN/YELLOW/RED tiering. It also spells out **two parser changes** to make
first:

1. **`parsePdf` only reads page 1**, but ~10 clubs put the punny blurbs on **page
   2** (the "TODAY'S STARTER" page). Add a per-club `page` (or `pages`) to `CONFIG`
   and thread it into `getPage`.
2. **Nearly every club is "flow-bold"** — body = a family (possibly split across
   subsets), heads = the **bold weight** of that family at the left margin. Add a
   `flow` variant driven by explicit body/head font regexes (`body = family AND NOT
   head`), reusing the Pirates' geometry knobs (`columnMaxX` / `rightTableMinX` /
   `tableLeader`) for table exclusion since most clubs have no Gotham anchor.

## Tools (portable — run from repo root)

```
node .scratch/game-notes/fetch-note.mjs 111            # fetch Red Sox latest -> 111.pdf
node .scratch/game-notes/profile-notes.mjs 111.pdf 111 BOS 1   # fonts + geometry, page 1
node .scratch/game-notes/page-scan.mjs 111.pdf         # which page has the narrative
node .scratch/game-notes/flowbold-test.mjs 111.pdf '/FrutigerLT-Cn/' '/FrutigerLT-BlackCn/' 55
```

PDFs aren't committed (large + the "latest" changes daily); `fetch-note.mjs` pulls
a fresh one from the URL in `public/data/game-notes.json`. Templates are
date-stable, so a fresh PDF still matches `CALIBRATION.md`.

## Suggested order

Make the two parser changes → calibrate **BOS + NYM** as pilots (cleanest) →
work the GREEN tier → then YELLOW. Verify each club with the `extractForTeam` Node
harness (`docs/whats-brewing.md`) before wiring — the parse fails silently to `[]`,
so eyeball the extracted `{title, body}` per club. Keep each club's change scoped;
list touched files in the PR.
