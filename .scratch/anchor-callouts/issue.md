Title: Anchor callouts: pair a season cohort count with a well-known number
Label: needs-triage (open decisions below; not ready-for-agent)

## Idea

A note on a player's card says how many players cleared a milestone this season. It then compares
that count to a number everyone knows. Example: "One of 11 pitchers with a shutout, fewer than the
12 people who have walked on the moon."

## Why

A bare "11" tells the reader little. A known number gives it a feel. The form comes from the
Rivera line: 12 people have walked on the moon and only 11 scored an earned run off him in the
postseason (CNA, Jan 2019; the "11" is not confirmed). The idea came from a research session on
2026-11-03 about the Brewers' title season. The long-form design is in
`.scratch/anchor-callouts/spec.md`.

## Decisions

- Gary, 2026-11-03: build the structure for anchor callouts, even if it waits as an issue.
- Gary, 2026-11-03: the anchors are well-known counts a general reader knows, not only baseball ones.
- Gary, 2026-11-03: a callout is a moment in time. It is true on the day it is minted and stays
  accurate as of that date. Each note stores its date. The text shows the date only when it
  helps (not on every note); the rule is below. The cohort file is one dated snapshot per day.
- Gary, 2026-11-03: a note can outlive its game. It may stay on the player's detail page for the
  rest of the season, and its wording ages: "In May, ..." by September.
- Inference (not yet decided by Gary): cohorts are one season and MLB only.
- Inference: the registry holds only sourced, dated anchors. Excluded ones: EGOT, Challenger Deep,
  space travelers, living ex-presidents, Everest, Comaneci. Reasons are in `anchors.seed.json`.
- Inference: use the entering-tonight tense (ADR-0014, ADR-0088). No result-aware wording in v1.

## Where it lives

Inference: names are proposals.
- `scripts/gen-cohorts.mjs` writes `public/data/cohorts/MMDDYYYY.json` each night, one file per day. A probe that already
  reproduces the 2026 counts: `.scratch/anchor-callouts/cohorts.probe.mjs`.
- `src/lib/anchors/anchors.json` (seed: `.scratch/anchor-callouts/anchors.seed.json`) and a pure
  `pick.js`.
- `public/data/cohorts-minted.json`: append-only, written by the same generator. It records the first
  day a player clears a milestone. The player detail page reads it (slice 5, wireframe first).
- A `cohort` note family in `src/api/callout-notes/`, scored with `SCORE_BASE` and `magnitudeOf`.
  First surface: `src/api/between-innings.js`.
- Cron wiring needs three edits to `update-nightly-data.yml` and a stamp in
  `check-data-freshness.mjs` (`scripts/CLAUDE.md`).

## Spoiler-rule check

The first surface is Between Innings. The cohort counts end the day before the slate. The file has
no score and no result. Inference: the reader is spoiler-free in `src/api/spoiler-manifest.json`.
ADRs: 0001, 0014, 0088. A live version on the player page is an open page (ADR-0034).

## Done means

- [ ] The 2026 counts come out of one generator run: 11 shutouts, 9 with 100 RBI, 13 with 200 K,
      11 with 30 saves, 17 with 20 HR and 20 SB.
- [ ] `pick` returns: 11 -> moon "fewer than"; 9 -> Supreme Court "as many as"; 13 -> Triple Crown
      horses "more than".
- [ ] A test fails if an anchor has no source or no date, or uses an excluded id.
- [ ] A Brewers game card shows the note at 390 px with `?nointro` (route and `gamePk`: choose
      from `docs/test-games.md`).
- [ ] `npm run lint` and `npm test` pass.

## Not decided

1. Is the aging rule right? No date on a game's own card, month name when older, year when older
   than the season.
2. How long does a minted note stay on the player page, and how many show at once?
3. Show a plain cohort note when no anchor fits?
4. One anchor note per card, or more?
5. Tone: is a joke about another club's fans fine?
6. Allow anchors that can change (Triple Crown winners, presidents) with a 180-day expiry?

## Out of scope

All-time cohorts and "first ever" claims. Result-aware wording. A new screen.

## Blocked by / Related

Slice 5 (player page line) needs a wireframe Artifact first. Related: `docs/callouts.md`,
`docs/peer-sites.md` (the "expected score" gap).
