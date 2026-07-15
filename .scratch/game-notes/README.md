# Game Notes → What's Brewing: extend the parser to the other 28 clubs

The lineup page's **Game notes** button opens an in-app modal of the punny
narrative blurbs parsed out of a club's pre-game Game Notes PDF — but only for
**calibrated** clubs. Done so far: Brewers (158, `column`), Pirates (134, `flow`),
and the 12 **GREEN**-tier `flow-bold` clubs (BOS, NYM, MIA, PHI, LAD, ATH, HOU, KC,
LAA, SEA, MIN, NYY). Every other club still just links out to the raw PDF. Goal:
calibrate the remaining **YELLOW** (11) and **RED** (5) tiers — see `CALIBRATION.md`.

- Parser + per-club `CONFIG`: `src/api/whatsBrewing.js`
- How the parse works / three layouts / Node harness: `docs/whats-brewing.md`
- Modal: `src/components/WhatsBrewingModal.jsx`; button: `GameNotesButton` in
  `src/screens/TeamInfo.jsx` (gated on `hasWhatsBrewing(teamId)`)

**Mid-review right now?** Read `SESSION-HANDOFF.md` first — it has the exact
state of an in-progress GREEN-tier QA pass (PR #174), which clubs are fixed vs.
still-known-broken, and the bug-class playbook, so you don't re-derive any of it.

## GREEN tier gotcha: a fixed `columnMaxX` word-cutoff is fragile

`extractFlowBoldZone` used to drop any word past a flat per-club `columnMaxX` —
calibrated tight (150pt) to keep an adjacent same-baseline sidebar/table out. That
also silently chops off legitimate wrapped prose that shares a baseline with one
(a bolded name at the end of a Hall-of-Famer list, e.g.), since a genuine
second-column box can start anywhere from ~210pt to ~460pt depending on the club —
there's no one safe width. Fixed with a **per-line dynamic cutoff**
(`lineMarkerCutoff`): scan each baseline for a genuine ALL-CAPS (colon-aware,
multi-word-or-longish) head-font marker — a real box title like "IN THE DUGOUT:" —
and truncate only there; a plain mixed-case bold player name never trips it. Widen
`columnMaxX` per club only after confirming (via a geometry scan for a *recurring*
second-column x-cluster across many lines) that it's genuinely safe — a single
verified name doesn't mean the whole page is single-column; several clubs turned
out to be real two/three-column layouts where blind widening leaked whole stat
tables in as "body" text. `snapSuperscriptOrdinals` fixes a related but distinct
bug: superscript "2nd"/"3rd"/"96th" suffixes sit a few pt above their baseline,
clearing the line-grouping tolerance and reordering ("since **nd** ranks T-2").

## Start here: `CALIBRATION.md`

The upfront font/geometry read-off for the 16 remaining (YELLOW + RED) clubs is
done — narrative **page**, **body/head font** tests, **geometry**, sample
**titles**, **caveats**, and the tiering. The two parser changes it originally
called for (per-club `page`, the `flow-bold` layout) already landed with the GREEN
tier; start from that CONFIG shape for each new club, not from scratch.

## Tools (portable — run from repo root)

```
node .scratch/game-notes/fetch-note.mjs 111            # fetch Red Sox latest -> 111.pdf
node .scratch/game-notes/profile-notes.mjs 111.pdf 111 BOS 1   # fonts + geometry, page 1
node .scratch/game-notes/page-scan.mjs 111.pdf         # which page has the narrative
node .scratch/game-notes/flowbold-test.mjs 111.pdf '/FrutigerLT-Cn/' '/FrutigerLT-BlackCn/' 55
node .scratch/game-notes/verify-all.mjs                 # extractForTeam over every calibrated club's fetched PDF, dumps {title, body} to eyeball
node .scratch/game-notes/verify-one.mjs 111.pdf 111 1    # same, one club/page at a time
node .scratch/game-notes/dump-near.mjs 111.pdf 1 "Ripken"  # raw x/y/font for every item matching a substring + its baseline neighbors — the go-to for "why did this word vanish"
node .scratch/game-notes/column-scan.mjs                 # per-club xMin histogram of body/head lines, to find a REAL recurring 2nd-column start vs. a one-off wrap overrun
node .scratch/game-notes/dropped-names-scan.mjs           # flags mixed-case bold runs sitting past the current columnMaxX — the "dropped bold name" smell test
```

PDFs aren't committed (large + the "latest" changes daily); `fetch-note.mjs` pulls
a fresh one from the URL in `public/data/game-notes.json`. Templates are
date-stable, so a fresh PDF still matches `CALIBRATION.md`. `verify-all.mjs` /
`column-scan.mjs` / `dropped-names-scan.mjs` expect PDFs already fetched into
`.scratch/game-notes/pdfs/{teamId}.pdf` (gitignored — re-fetch per session).

## Suggested order

Work the YELLOW tier, hardest-wrinkle-last (see the tier table in
`CALIBRATION.md`), then RED (do last / maybe skip — genuinely harder templates).
Verify each club with `verify-one.mjs` (or the `extractForTeam` Node harness in
`docs/whats-brewing.md`) before wiring — the parse fails silently to `[]`, so
eyeball the extracted `{title, body}` per club, AND run `dropped-names-scan.mjs`
against it — a clean-looking title list can still be silently dropping mid-sentence
bold names. Keep each club's change scoped; list touched files in the PR.
