Title: Anchor callouts: pair a season count with a well-known number
Label: needs-triage (open decisions below; not ready-for-agent)

## Idea

A note on a player's card says how many players had met a milestone by that day. It then compares
that count to a number everyone knows. Example: "One of 11 pitchers with a shutout, fewer than
the 12 people who have walked on the moon."

## Why

A bare "11" tells the reader little. A known number gives it a feel. The form comes from the
Rivera line: 12 people have walked on the moon and only 11 scored an earned run off him in the
postseason (CNA, Jan 2019; the "11" is not confirmed). The idea came from a research session on
2026-11-03 about the Brewers' title season. The long-form design is in
`.scratch/anchor-callouts/spec.md`.

## Decisions

- Gary, 2026-11-03: build the structure for anchor callouts, even if it waits as an issue.
- Gary, 2026-11-03: anchors are well-known counts a general reader knows, not only baseball ones.
- Gary, 2026-11-03: a callout is a moment in time. It is true on the day it is minted and stays
  accurate as of that date.
- Gary, 2026-11-03: the text shows a date only when it helps, never on every note.
- Gary, 2026-11-03: a note can outlive its game, and its wording ages ("In May, ..." by September).
- Gary, 2026-11-03: the store is named `nuggets` (he suggested "nuggets" or "notes"; "notes" collides with 219 files).
- Gary, 2026-11-03: nine open questions answered. Aging: none on a game's own card, month name when
  older, year when older than the season. Game card window: 7 days. Player page: the season, then a
  career view. Thresholds: a curated list in code. Plain note with no anchor: yes when the count is
  small. Only the top-ranked nugget on a card gets an anchor; the rest show as plain counts. Tone: any sourced anchor, including team-flavored ones.
  Anchors that can change: allowed with a 180-day expiry. Postseason: its own ladder of four kinds, later. Career view: a section on the player page.
  Plain-note cutoff: depends on the span and the stat (a bigger number is fine for a longer span).
- Inference: the store holds nuggets. A nugget is the first day a player's season total met a
  threshold, with how many players had by then and the anchor, frozen. The count on any past day is
  the number of nuggets up to that day, so no daily snapshot is needed. 
- Inference: counting stats, regular season, MLB only, in v1.
- Inference: entering-tonight tense (ADR-0014, ADR-0088). No result-aware wording in v1.

## Where it lives

Inference: names are proposals.
- `public/data/nuggets/{season}.json`: append-only, one file per season, frozen when the season
  ends. Written nightly by `scripts/gen-nuggets.mjs`. The crossing date comes from each new
  crosser's game log. Probe: `.scratch/anchor-callouts/nuggets.probe.mjs` (66 nuggets across
  6 thresholds in 4.9 s on 2026-11-03; counts match the season totals).
- `src/lib/nuggets/thresholds.js`: the named lines as data, shared by the generator and the app.
  Each line carries a `span` (season, last 10 seasons, history) and a `plainMax` cutoff.
- `src/lib/anchors/anchors.json` (seed: `.scratch/anchor-callouts/anchors.seed.json`) and a pure
  `pick.js`.
- `src/api/nuggets.js` reader, then a `nugget` note family in `src/api/callout-notes/`, scored
  with `SCORE_BASE` and `magnitudeOf`. First surface: `src/api/between-innings.js`.
- Cron wiring needs three edits to `update-nightly-data.yml` and a stamp in
  `check-data-freshness.mjs` (`scripts/CLAUDE.md`).
- Docs: an ADR, a `CONTEXT.md` term (Nugget), and rows in `docs/callouts.md`.

## Spoiler-rule check

A nugget's date is a game date, so the date is the spoiler. On the four scoring surfaces the
reader returns only nuggets dated before the game's date, and a test pins it. The store holds no
score. The player detail page is open (ADR-0034). ADRs: 0001, 0014, 0034, 0088.

## Done means

- [ ] A backfill of 2026 gives the probe's dates, and a second run adds nothing.
- [ ] `pick` returns: 11 -> moon "fewer than"; 9 -> Supreme Court "as many as"; 13 -> Triple Crown
      horses "more than".
- [ ] A test fails if an anchor has no source or no date, or uses an excluded id.
- [ ] A test fails if a nugget dated on a game's own date reaches a scoring surface.
- [ ] A Brewers game card shows the note at 390 px with `?nointro` (route and `gamePk`: choose
      from `docs/test-games.md`).
- [ ] `npm run lint` and `npm test` pass.

## Not decided

1. The postseason numbers: which exact lines for the four kinds?
2. How does a streak (scoreless relief innings) get a crossing date and a count?
3. Starting `plainMax` per span (Inference: season 15, last 10 seasons 50, history 100).
4. Is the season-totals call right for early-era seasons? Check against Baseball-Reference.

## Out of scope

Rate stats and "qualified" lists. "First ever" claims. Result-aware wording. A new screen.
Counts over longer spans (last 10 seasons, history) are a later slice, not v1 (see spec, "Spans").

## Blocked by / Related

Slice 5 (player page list) needs a wireframe Artifact first. Notes and probes: PR #2804.
Related: `docs/callouts.md`,
`gen-rookies.mjs` (the same "crossed" idea, for a career limit).
