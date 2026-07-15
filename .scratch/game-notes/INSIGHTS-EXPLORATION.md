# Game Notes → Insights: exploration + findings (deferred)

**Status:** exploration only — no product code written. **Decision deferred** to a
session **after the 2026 All-Star break** (games resume ~July 17, 2026). This doc +
the `extract-explore.mjs` harness are the handoff.

## The question

Today the parsed Game Notes ("What's Brewing", `src/api/whatsBrewing.js`) are only
reachable behind a click — a modal on the lineup page. Users won't open that every
game. Can we get more mileage by surfacing the *good* content where people already
look — the callouts / Insights areas, team pages, player pages — instead of a
click-through?

Two candidate values were identified for the notes (beyond the modal):

1. **Curation signal.** If a club's PR staff wrote about a fact we *also* compute
   (a hot-hand line, a leader), that's evidence it's worth showing — use it to nudge
   the worthiness score of the callout we already generate (`callout-notes.js`).
2. **Non-computable color.** Franchise/matchup trivia, career-milestone-vs-legend,
   drafts, human interest — content the MLB stats feed does **not** contain. This is
   the genuinely additive slice, and it's spoiler-safe (all prior-history color).

## Key architectural facts (don't relearn these)

- **There is no database.** bbsbh is no-backend (root `CLAUDE.md`). "Push results to
  the database" = regenerate a committed `public/data/*.json` and let the app fetch
  it same-origin — the build-time-fetch pattern every `gen-*.mjs` uses.
- **The nightly slot already exists:** `.github/workflows/update-nightly-data.yml`.
  A production build is a new `scripts/gen-game-notes-insights.mjs` wired into it
  (or a sibling workflow), **not** a Claude Code scheduled agent (a deterministic
  pipeline wants a cron + script, not an agent loop).
- **Runtime = a metered Anthropic API key** stored as a GitHub secret
  (`ANTHROPIC_API_KEY`). This is separate from an interactive Claude Code
  subscription — the subscription is for interactive dev, the API is for unattended
  production infra. (The subscription *can't* cleanly power it: headless OAuth
  refresh breaks on a cron, and it would draw on the interactive usage pool.)
  Exploration/prototyping like this doc, by contrast, is fine on the subscription.

## Method

For two clubs — **Brewers (158)**, a stats-forward template, and **Padres (135)**, a
punny narrative template — extracted the last 5 days of blurbs with the shipped
`extractForTeam` parser, then classified every blurb with **Claude Haiku**
(`claude-haiku-4-5`) — the same cheap model a production job would use. Taxonomy:
`category`, `spoilerTier` (timeless / standing / result), `additive` (true iff NOT
derivable from the stats feed), `subject`.

Reproduce: `node .scratch/game-notes/extract-explore.mjs <teamId> <page> <out.json>`
then hand the JSON to a Haiku agent with the classification schema (see the prompt
used in this session; the two most important outputs are `additive` and
`spoilerTier`, and the headline metric is **timeless AND additive** = safe anywhere
*and* not already computed).

## Findings

| Metric | Brewers (stats) | Padres (narrative) |
| --- | --- | --- |
| Blurbs/day | 9.6 | ~7.4 |
| **Timeless + additive** (safe anywhere, not computable) | 19% · ~1.8/day | **27% · ~2.0/day** |
| Redundant with what we already compute | 75% | ~65% |
| Hard-spoiler recaps ("dropped Game 1, 5-3") | 6% | **22%** |
| Parse quality | clean | **messy** (prospect notes / stat tables spliced into blurbs) |

**1. Quantity of the additive-and-safe slice is ~2 items/club/day either way** —
modest. Across 30 clubs that's ~60 evocative items/day league-wide, which *is* enough
for a league-wide feed even though per-club it's thin.

**2. Quality varies enormously.** Brewers additive content = mostly transactions +
doubleheader history (dry; and transactions are better pulled structured from the
stats API anyway). Padres additive content = *charming*: Joe Musgrove hitting 10 yrs
service time (+ the first no-hitter in franchise history), Tatis's 147 career SB tied
with Ozzie Smith for 5th all-time as a Padre, the bilingual City Connect uniform
story, a just-drafted HS pitcher, an All-Star selection. The narrative clubs carry
the feature.

**3. Richer clubs parse messier — this settles the architecture.** In the Padres
output a prospect note is spliced mid-sentence into a Tatis blurb and a leaderboard
table into the Mason Miller blurb. Displaying those blurb bodies verbatim would look
broken. Haiku read *through* the mess and classified by primary subject fine. So the
right design is **feed the LLM the raw extracted text and have it emit the clean
fact** (extractive/attributed) — which is both higher quality **and sidesteps the
whole per-club geometry whack-a-mole** the parser is prone to. The 30 bespoke CONFIG
entries are needed for pretty verbatim display, *not* for this.

**4. Spoiler filtering matters more for narrative clubs** (22% vs 6% recaps) but
Haiku tiered them correctly — a solved problem, not a blocker. Only `timeless` (and
maybe `standing`) may render on always-open surfaces; `result` recaps must be
excluded (they'd spoil an unwatched recent game).

**5. Haiku is sufficient** and cheap: ~$5–11/month for all 30 clubs nightly
(halve with the Batch API). Cost was never the constraint.

## Recommendation (for the revisit)

Three options, in priority order:

- **Build it (leaning yes).** Nightly LLM-extract-from-raw-text pass (Haiku) →
  `public/data/game-notes-insights.json` holding the timeless-additive facts
  (franchise/matchup trivia, career-milestone-vs-legend, cultural/human-interest).
  Surface **attributed** ("Per the Padres' notes: …") as a small **league-wide
  "Around the League / From the Notes" feed** + a **player/team-page garnish**. Skip
  transactions/debuts as PDF content (get them structured from the API). Natural home
  is the league feed, not a per-club feature expected to be rich nightly.
- **Curation-signal only.** No new display surface; use the same pass to boost the
  worthiness of callouts we already compute. Cheapest, lowest-risk.
- **Shelve.** The per-club slice (~2/day, dry for stats clubs) is too thin to justify
  a pipeline; revisit if priorities change.

Cross-cutting: whichever we pick, prefer LLM-over-raw-text (point 3) so we stop
depending on pixel-perfect geometry parsing to get value from these PDFs.

## Also worth folding in (from the earlier holistic review)

The whack-a-mole in `whatsBrewing.js` has two root causes independent of this feature:
silent failure (a broken parse → `[]` → looks intentional) and single-day
calibration against a drifting template. A **retention corpus** (save the PDFs, run
the parser across N days, flag anomalies + freeze golden outputs) would make breakage
observable and testable. The nightly LLM pass above can double as the "is this parse
right?" oracle over that corpus.

## Harness in this folder

- `extract-explore.mjs <teamId> <page> <out.json>` — fetch a club's last 5 archived
  PDFs (URLs from `public/data/game-notes.json`), extract blurbs via the shipped
  `extractForTeam`, write `[{date, title, blurbs:[{title, body}]}]`. Most punny clubs
  are page 1 (135 Padres, 113 Reds, 112 Cubs, 114 Guardians). PDFs are reachable from
  this sandbox (img.mlbstatic.com, CORS-open).
