# Callouts — the full catalog, gates, and worthiness rubric

Every season-context "call-out" the app can show during a game, in one place:
what triggers each family, where it renders, what data feeds it, the
noteworthiness gate that keeps it from firing on noise, and the worthiness
score that ranks it against the others. The spoiler rules that govern *tense*
(what a note may fold in, per surface) are ADR-0014; this file is the catalog
those rules apply to.

## The three surfaces

| Surface | Module | Tense |
| --- | --- | --- |
| Innings-view play cards | `buildCallouts` (`src/api/callout-notes.js`) via `PlayByPlay` | Entering + revealed plays only ("that's No. 16 this season") |
| Pre-half strip (above each half's seal) | `buildPreHalfCallouts` (`src/api/prehalf-callouts.js`) via `PreHalfCallouts` | Entering; the leading-after note restates already-revealed score |
| Box score Insights roll-up | `computeGameCalloutNotes` (`src/api/callout-notes.js`) via `BoxScore` | Result-aware once Final ("moved to 18-2", "just the 2nd loss in 7 games") |

A fourth, adjacent surface — the always-open Pitchers table notes
(`src/api/pitcher-callouts.js`) — predates the worthiness system and stays a
plain string list; the lineup pages' milestone pill (`milestoneTextFor`)
likewise. Both read the same nightly bundle.

## Worthiness

Every note carries `score` (0–100) = family base + magnitude bonus, clamped —
the callouts sibling of the three stars' blended performance score
(ADR-0013). The Insights card sorts by it, shows the top `INSIGHTS_SHOWN`
(6), and folds the rest behind Show more; the pre-half strip sorts and caps
at `PREHALF_MAX` (2). Play cards don't re-rank — a card rarely holds more
than a couple of notes, each already sitting on the play it belongs to.

Bases encode how rare/dramatic a family is; bonuses reward how far past its
own floor this instance landed. `skew(w,l)` below is the record's distance
from .500 (0–0.5). Tune bases in `SCORE_BASE` (`callout-notes.js`) and this
table together.

| Family | Base | Bonus |
| --- | --- | --- |
| leadReversal | 85 | + 20 × skew |
| birthdayStats | 60 | — |
| birthday | 55 | — |
| homerRec | 55 | + 40 × skew |
| onBaseEnded | 50 | + min(15, streak − 8) |
| onBaseExtended | 45 | + min(15, streak+1 − 8) |
| onBaseRiding | 40 | + min(15, streak − 8) |
| leadHeld / leadAfterLive | 40 | + 40 × skew |
| starterRec | 40 | + 40 × skew |
| vsTeam | 40 | + min(15, 15 × (angle strength − 1)) |
| leader (hits/SB) | 35 | + min(15, count / 4) |
| leader (pitcher K) | 35 | + min(15, count / 12) |
| sbStreak | 35 | + min(10, run − 4) |
| runsScored | 35 | + 40 × skew |
| runsAllowed | 35 | + 40 × skew |
| comeback | 30 | + 60 × win% (resilience, not lopsidedness) |
| scoringFirst / oppScoringFirst | 30 | + 100 × deviation from league norm |
| inningRunDiff | 30 | + min(20, margin / 2) |
| risp / platoon | 25 | — |
| tto | 15 | — |

## The families

Data families are precomputed nightly by `scripts/gen-callouts.mjs` into
`public/data/callouts/<MMDDYYYY>.json` (bundle shape: `src/api/callouts.js`).
"Progress" means `computeCalloutProgress`'s per-play in-game counts.

### Player, on the play it happens

- **leader** — the batter (or the pitcher who just struck him out, or the
  runner who just stole) came in leading his club in that category
  (`leaders`/`pitcherLeaders`, rank 1 via the app's own `computeLeaders`).
  Count folds in tonight through this play: "Leads the Brewers in doubles —
  that's No. 16 this season." Gate: he's the rank-1 leader; zero-count
  leaders don't exist (computeLeaders drops zeroes).
- **homerRec** — he homered and his club's record when he does is lopsided
  (`homerRecords`; precompute gate ≥ 5 such games, win% ≥ .700 or ≤ .300).
  Play card: "Entering tonight, the Brewers are 5-1 when he goes deep."
  Roll-up, Final: folded — "just the 2nd loss in 7 games… (now 5-2)".
- **onBaseRiding / onBaseExtended / onBaseEnded** — his on-base streak
  (`streaks.onBase`, precompute floor 8 games; h+bb+hbp definition on both
  sides of the join). Riding: first-PA card while he hasn't reached yet.
  Extended: the play where he first reaches — "extends his streak to 15
  straight games." Ended: roll-up only, Final only — he had a PA and never
  reached. All three share a dedupeKey, so the roll-up keeps the last word.
- **sbStreak** — his unbroken steal run (`streaks.stolenBase`, floor 4);
  first-PA card entering, updated on each steal ("that's 7 straight…") while
  he hasn't been caught tonight (progress tracks CS/pickoff-CS).
- **risp / platoon** — season RISP and vs-L/vs-R lines (`situational`,
  ≥ 15 PA per split), once on his first PA.
- **birthday / birthdayStats** — slate-date birthday flag + his career line
  ON his birthday (`birthdays`/`birthdayStats`, ≥ 2 games and ≥ 5 AB).
- **vsTeam** — career vs tonight's opponent, only on a notable angle
  (AVG deviation / HR share / XBH rate / BB rate) judged against his own
  season+career baselines (`hitterLines`); the strictest family — see the
  long comment on `buildVsTeamNote`. Roll-up caps the family at
  `VS_TEAM_ROLLUP_MAX` (3) by score.
- **tto** — third-plus look at the same pitcher tonight (pure feed math).
- **milestone** — staging-pill only ("4 H shy of 2,000"), `milestones`.

### Team, on the play it happens

- **scoringFirst / oppScoringFirst** — fires on the play that scored the
  game's first run, as TWO separate one-club cards: the scorer's record when
  scoring first, the conceder's when the opponent does. Gate: ≥ 10 games and
  win% ≥ .08 away from the league norm for that situation (~.66 scoring
  first, ~.34 conceding) — a banal record earns no card, in either
  direction. Roll-up folds tonight in once Final.

### Pre-half strip (entering the half)

- **starterRec** — 1st inning only, on the half where that club's starter
  takes the mound (top = home's, bottom = away's): the CLUB's W-L in his
  starts (`starterRecords[id].teamStarts`, ≥ 3 starts) — independent of his
  personal decisions. Roll-up restates it folded once Final, keyed to the
  actual (not probable) starters.
- **leadAfterLive** — top of inning N ≥ 7 (checkpoints 6–9): whoever leads
  tonight after N−1 + their season record at that checkpoint
  (`leadAfterFull`, ≥ 5 games). Self-gates on `revealedThrough` covering
  inning N−1 (ADR-0014).
- **inningRunDiff** — entering an inning's top half: either club's season
  runs for/against in that inning (`inningRuns`) when noteworthy — ≥ 15
  games sampled, margin ≥ 12, and a 2× dominance ratio. Roll-up shows each
  club's single most lopsided inning, tonight's runs folded once Final.

### Whole-game (roll-up only)

- **leadReversal** — led after a late checkpoint with a lopsided
  season record there (`leadAfter`, precompute-gated ≥ 5 games / .85), lost
  anyway: "were 43-0 when leading after the 8th — until tonight." Latest
  checkpoint only.
- **leadHeld** — Final only: the winner led after checkpoint N and closed —
  "moved to 18-2 when leading after the 8th" (`leadAfterFull`, ungated —
  post-game the moved-to fact is the point). Latest checkpoint only.
- **runsScored** — highest bucket (4/6/8+) tonight's own final clears, ≥ 5
  games sampled; folded once Final.
- **runsAllowed** — allowed 4+ by checkpoint inning 5–8, precompute-gated to
  a losing-lopsided record; latest checkpoint only; folded once Final.
- **comeback** — trailed by 3+ at some point tonight → season record in such
  games (≥ 5 sampled); folded once Final.

## Extending

Per CLAUDE.md's standing rule: new record/streak/split families extend
`gen-callouts.mjs` (never a parallel generation path); anything computable
from data already on hand computes live. When adding a family, give it a
`kind`, a `dedupeKey` if it can restate itself, a `SCORE_BASE` row (and a
line in the rubric table above), and decide its tense per ADR-0014's rule
before picking its surface.
