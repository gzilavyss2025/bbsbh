# Callouts — the full catalog, gates, and worthiness rubric

Every season-context "call-out" the app can show during a game, in one place:
what triggers each family, where it renders, what data feeds it, the
noteworthiness gate that keeps it from firing on noise, and the worthiness
score that ranks it against the others. The spoiler rules that govern *tense*
(what a note may fold in, per surface) are ADR-0014; this file is the catalog
those rules apply to.

Coverage: the nightly bundle spans MLB **and the four full-season MiLB levels**
(AAA/AA/A+/A). Career-derived families (vs-team baselines, milestones,
birthday career lines) and the standings splits (one-run / extra-inning
records) stay MLB-only — a MiLB bundle simply lacks those keys and the notes
never fire.

## The four surfaces

| Surface | Module | Tense |
| --- | --- | --- |
| Innings-view play cards | `buildCallouts` (`src/api/callout-notes.js`) via `PlayByPlay` | Entering + revealed plays only ("that's No. 16 this season") |
| Pre-half strip (above each half's seal) | `buildPreHalfCallouts` (`src/api/prehalf-callouts.js`) via `PreHalfCallouts` | Entering; the leading-after + times-through notes restate already-revealed material |
| Margin Notes (always open, spans both teams' pitchers) | `buildMarginNotes` (`src/api/pitcher-callouts.js`) via `MarginNotes` | Entering-tonight season aggregates + live health reads (laboring, velo decay), never result-aware — same footing as the pre-half strip |
| Box score Insights roll-up | `computeGameCalloutNotes` (`src/api/callout-notes.js`) via `BoxScore` | Result-aware once Final, narrated with tonight's own events ("Struck out 7 tonight and leads…", "Went 0-for-3 tonight, snapping…") |

Margin Notes replaced the old Pitchers-table note list, which used to sit
unscored (a plain string per row, every qualifying note shown regardless of
how interesting it was) — it now joins the worthiness system, scored and
capped the same way the pre-half strip is. The lineup pages' milestone pill
(`milestoneTextFor`) is the one remaining surface that still predates
worthiness scoring — it's a single fact per player, not a ranked list, so it
has no need for one.

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
| marathonAb | 45 | + min(15, 3 × (fouls − 6)) |
| onBaseRiding | 40 | + min(15, streak − 8) |
| leadHeld / leadAfterLive | 40 | + 40 × skew |
| bothScoreless | 42 | + 40 × skew |
| tiedAfter / tiedAfterLive | 40 | + 40 × skew |
| starterRec | 40 | + 40 × skew |
| bullpenThin | 40 | + min(10, 5 × (relievers down − 2)) |
| vsTeam | 40 | + min(15, 15 × (angle strength − 1)) |
| leader (hits/SB) | 35 | + min(15, count / 4) |
| leader (pitcher K) | 35 | + min(15, count / 12) |
| sbStreak | 35 | + min(10, run − 4) |
| foulVolume | 35 | + min(15, fouls − expected) |
| runsScored | 35 | + 40 × skew |
| runsAllowed | 35 | + 40 × skew |
| oneRun / extraInnings | 35 | + 40 × skew |
| tto (with a season split) | 35 | + min(15, 100 × AVG gap) |
| scorelessThrough | 34 | + 40 × skew |
| ttoPitches | 30 | + min(15, 10 × per-PA climb) |
| pitchPace | 32 | + min(15, \|tonight − avg\| / 2) |
| comeback | 30 | + 60 × win% (resilience, not lopsidedness) |
| scoringFirst / oppScoringFirst | 30 | + 100 × deviation from league norm |
| inningRunDiff | 30 | + min(20, margin / 2) |
| dayOfWeek | 30 | + 40 × skew |
| foulSpoiler | 30 | + (11 − rank); roll-up restatement adds + min(6, tonight − 3) |
| risp / platoon | 25 | — |
| tto (plain trip fact) | 20 | — |

Margin Notes' own family bases (`src/api/pitcher-callouts.js`'s local
`SCORE_BASE` — self-contained rather than imported from `callout-notes.js`,
same precedent the pre-half strip sets):

| Family | Base | Bonus |
| --- | --- | --- |
| laboring | 48 | + min(15, 30 × (ratio − 1)) |
| veloDecay | 46 | + min(15, 6 × (drop − 1.5)) |
| penFatigue | 42 | — |
| workload | 38 | — |
| backToBack | 36 | — |
| leverage | 34 | + min(15, 100 × (gap − 0.06)) |
| tenK | 33 | — |
| scorelessStreak | 32 | + min(15, streak − 1) |
| sixIp | 28 | — |
| homeAway | 30 | — |
| cgShutout | 25 | — |
| recentAppearances | 20 | — |

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
  leaders don't exist (computeLeaders drops zeroes). Roll-up, Final: restated
  with tonight's own tally leading — "Struck out 7 tonight and leads the
  Braves with 117 strikeouts this season", "Doubled twice tonight — now 16
  this season, most on the Brewers" (`leaderTonightText`).
- **homerRec** — he homered and his club's record when he does is lopsided
  (`homerRecords`; precompute gate ≥ 5 such games, win% ≥ .700 or ≤ .300).
  Play card: "Entering tonight, the Brewers are 5-1 when he goes deep."
  Roll-up, Final: folded — "just the 2nd loss in 7 games… (now 5-2)".
- **onBaseRiding / onBaseExtended / onBaseEnded** — his on-base streak
  (`streaks.onBase`, precompute floor 8 games; h+bb+hbp definition on both
  sides of the join; `streaks.onBaseStart` carries the streak's first game).
  Riding: first-PA card while he hasn't reached yet. Extended: the play where
  he first reaches — "extends his streak to 15 straight games" (the roll-up
  restates it with its arc: "…is now 15 straight games, dating to 6/10").
  Ended: roll-up only, Final only — he had a PA and never reached — told with
  tonight's line: "Went 0-for-3 tonight, snapping a 10-game on-base streak
  that began 6/25." All three share a dedupeKey, so the roll-up keeps the
  last word.
- **sbStreak** — his unbroken steal run (`streaks.stolenBase`, floor 4);
  fires only on the play he actually steals ("that's 7 straight…") while he
  hasn't been caught tonight (progress tracks CS/pickoff-CS) — no entering
  card on his first PA, since the streak has nothing to do with whatever that
  PA produces. Roll-up, Final: only earns a card when something happened on
  the bases — "Stole a base in the 4th and has now stolen 10 straight without
  being caught," or "Was caught stealing in the 6th, ending a run of 9
  straight steals"; a game with no attempt earns no card, live or in the
  roll-up.
- **risp / platoon** — season RISP and vs-L/vs-R lines (`situational`,
  ≥ 15 PA per split). Gate: the split average also has to deviate from his
  own season average by ≥ `SPLIT_AVG_DEVIATION` (.05) — an ordinary split
  that just tracks his overall line doesn't clear the bar, same shape as
  `AVG_DEVIATION_THRESHOLD` gating `vsTeam` below. `platoon` fires once, on
  his first PA (a pitcher's throwing hand is live on every plate appearance).
  `risp` fires once, on his first PA with a runner ACTUALLY on 2nd or 3rd
  (`firstRispPAIndexByBatter` in `api/playbyplay.js`) — a bases-empty PA gets
  no card, since "hitting .349 with RISP" reads as a non sequitur with nobody
  on.
- **marathonAb** — he fouled off 6+ pitches in this one at-bat, read straight
  off the revealed play's own pitch codes (`foulCountsFromCodes`,
  `callout-notes.js` — the strike count is re-simulated from the codes, and a
  two-strike foul tip is excluded, same rule as `derive.js`/`gen-fouls.mjs`).
  Play-card exclusive — the roll-up's thinner entries carry no pitch codes,
  and the moment is the story. With 3+ genuine two-strike fouls the card adds
  the historical odds (SABR BRJ 2018: .291 hit probability for foul-reached
  two-strike counts vs .102 otherwise).
- **foulSpoiler** — a league top-10 fouls-per-game batter steps in for his
  first PA ("MLB's No. 2 pitch-spoiler — 4.1 foul balls a game this season"),
  from the nightly `foulSpoilers` join (gen-callouts.mjs reads
  `public/data/fouls.json`; qualification is the Foul Tracker page's own
  relative games floor). Roll-up: restated with tonight's tally once he
  actually spoiled a few ("Fouled off 6 tonight — he averages an MLB-best
  4.6 a game", ≥ 3 fouls tonight; same dedupeKey so the last word wins). MLB
  only (the foul sweep is MLB-only).
- **birthday / birthdayStats** — slate-date birthday flag + his career line
  ON his birthday (`birthdays`/`birthdayStats`, ≥ 2 games and ≥ 5 AB).
- **vsTeam** — career vs tonight's opponent, only on a notable angle
  (AVG deviation / HR share / XBH rate / BB rate) judged against his own
  season+career baselines (`hitterLines`); the strictest family — see the
  long comment on `buildVsTeamNote`. Roll-up caps the family at
  `VS_TEAM_ROLLUP_MAX` (3) by score.
- **milestone** — staging-pill only ("4 H shy of 2,000"), `milestones`.
  MLB only (career-based).

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
- **dayOfWeek** — 1st inning, on the top half only (shown once): each club's
  W-L on tonight's day of the week (`dayOfWeek`, keyed 0=Sun…6=Sat from the
  game's official date). "The Brewers are 10-4 on Sundays this season." A pure
  calendar fact — no reveal gate — but only when genuinely one-sided: ≥ 6 games
  and win% ≥ .66 or ≤ .34 (`DOW_MIN_GAMES`/`DOW_LOPSIDED` in callout-notes.js),
  or an ordinary weekday is noise. Roll-up (`buildDayOfWeekNotes`) folds tonight
  in once Final. MLB + MiLB (the linescore sweep covers every level).
- **leadAfterLive** — top of inning N ≥ 7 (checkpoints 6–9): whoever leads
  tonight after N−1 + their season record at that checkpoint
  (`leadAfterFull`, ≥ 5 games). Self-gates on `revealedThrough` covering
  inning N−1 (ADR-0014).
- **tiedAfterLive** — the tied-game sibling of `leadAfterLive`: entering top of
  inning N (checkpoints 6–8 only — a tie after the 9th is extra innings, never
  surfaced up front) when the game is level after N−1, BOTH clubs' season
  record when tied at that checkpoint (`tiedAfterFull`, ≥ 5 games, no
  lopsidedness floor). "The Brewers are 12-9 this season when tied after the
  7th." Same `revealedThrough` self-gate as leadAfterLive (ADR-0014). Roll-up
  (`tiedAfter`, both clubs) folds tonight's result in once Final — "moved to
  13-9…" for the winner, "dropped to 8-11…" for the loser — latest checkpoint
  only, via `buildTiedAfterHeldNotes`.
- **scorelessThrough** — entering top of inning N (checkpoints 1–6) when a club
  is still shut out after N−1: that club's season record when scoreless through
  that inning (`scorelessThroughFull`). "The Brewers are 2-15 when scoreless
  through 6 innings." Numbers-only in the bundle so the roll-up folds tonight
  in; the note layer gates one-sidedness (`SCORELESS_LOPSIDED` .68, either
  direction — an early ~.500 checkpoint means nothing). Same `revealedThrough`
  self-gate as tiedAfterLive (knowing a side is scoreless restates the score).
  Fires for whichever side is at 0 — but NOT when the game itself is 0-0, where
  the bothScoreless framing takes over. Roll-up: `buildScorelessHeldNotes`,
  deepest checkpoint, folded. MLB + MiLB.
- **bothScoreless** — the pitchers'-duel sibling: entering top of inning N
  (checkpoints 2–7) when the GAME is still 0-0 after N−1, BOTH clubs' record in
  such games (`bothScorelessThroughFull`, ≥ 4 games, no lopsidedness floor — a
  rare situation whose record is the point). "The Brewers are 5-3 in games
  still 0-0 after the 7th." Base 42 so it edges tiedAfterLive (the more
  dramatic framing of the same tied-after-N state). Same self-gate; roll-up
  `buildBothScorelessHeldNotes`, deepest 0-0 checkpoint, both clubs, folded.
  MLB + MiLB.
- **inningRunDiff** — entering an inning's top half: either club's season
  runs for/against in that inning (`inningRuns`) when noteworthy — ≥ 15
  games sampled, margin ≥ 12, and a 2× dominance ratio. Roll-up shows each
  club's single most lopsided inning, tonight's runs folded once Final.
- **tto** — the half where the batting side sees the starter a 3rd (or
  later) time (`buildThirdTimeThroughNote`): ONE persistent card above the
  half's seal, replacing the old per-play note that repeated on every card.
  With a season split behind it (`starterRecords[pid].tto`, playLog-derived,
  probable starters only, 3rd-trip bucket ≥ 20 AB): "Batters see Imanaga a
  3rd time this inning — they're hitting .444 off him the 3rd time through
  this season (.242 the 1st time)"; without one, the plain trip fact.
  Counting who has faced him reads this side's PREVIOUS halves' plays —
  revealed material — so it self-gates on `revealedThrough` like the
  leading-after note (ADR-0014), and fires only while the side's starter
  (first pitcher seen = last pitcher seen) is still in.
- **ttoPitches** — the grind-escalation sibling of `tto`, from the same playLog
  split (`starterRecords[pid].tto[trip].ppa` — pitches per PA each time
  through): "Batters make Peralta work more each time through this season — 3.8
  pitches per PA the 1st time, 4.6 the 2nd, 5.3 the 3rd." Fires ONCE, entering
  the half where the order first turns over a 2nd time (trip === 2), so it never
  shares a strip with the 3rd-time AVG card. Shares that card's trip-detection
  (`enteringStarterTrip`) and `revealedThrough` self-gate. Gates: each cited
  trip ≥ 40 PA, and the 2nd time has to cost ≥ 0.4 more pitches per PA than the
  1st (a real climb, not noise); the 3rd trip joins the line only when it keeps
  climbing. Pre-half only. MLB + MiLB.

- **foulVolume** — entering a half, inning 3+: the batting side's foul count
  off the opposing STARTER tonight vs the league's per-pitch foul rate
  (`bundle.foulRate`, from the nightly foul sweep — absent on MiLB bundles,
  which disables the family). "The Cubs have fouled off 19 of Woodruff's 74
  pitches — league average is about 14." Reads strictly-previous halves'
  plays (revealed material), so it shares the times-through card's
  `revealedThrough` self-gate (ADR-0014); fires only while the starter is the
  only pitcher that side has seen. Gates: 50+ pitches, 12+ fouls, ≥ 1.35× the
  expected count.
- **pitchPace** — entering the half right after the starter completes his Nth
  inning (`PACE_INNINGS` = 3): his pitch count tonight through N vs his season
  pace (`starterRecords[pid].pitchPace` = `{n, avg, starts}`, ≥ 4 qualifying
  starts, derived from the SAME playLog as `tto` — no extra fetch). "Through 3
  tonight, Peralta is at 62 pitches — he averages 48 through three this season."
  Reads his strictly-previous halves' pitches (revealed material), so it shares
  the times-through `revealedThrough` self-gate; fires only while the starter is
  the lone pitcher seen and tonight is ≥ 12 pitches off his norm (`PACE_MIN_DIFF`).
  Pre-half only (a pace observation, not a season record — no roll-up sibling).
  MLB + MiLB.
- **bullpenThin** — 1st inning, on the half where the club takes the field:
  how many of its relievers enter the night likely unavailable under the
  workload rules (`buildBullpenThinNote` → `api/workload.js`'s
  `availabilityFor` — 3 straight days, 25+ pitches yesterday, 35+ over three
  days). "Bullpen watch: 3 Brewers relievers are likely down after heavy
  recent work — Uribe, Payamps, Koenig." Backward-looking completed
  appearances only (spoiler-free); self-gated to a slate-current game (the
  workload file describes "now"), same freshness window as TeamInfo's bullpen
  board. Gate: ≥ 2 relievers down.

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
- **oneRun / extraInnings** — Final only, fired only when tonight actually
  WAS that kind of game: the standings splits folded with the result — "Just
  the 4th loss in 19 one-run games for the Brewers (now 15-4)", "The Cubs
  moved to 6-3 in extra innings" (`buildCloseGameNotes`). MLB only (the
  splits come from MLB standings). The slate's Day Highlights margin
  headlines got the same prose treatment ("The Brewers edged the Cubs by a
  single run" — `dayHighlights.js`), distinct from these record cards.

### Margin Notes (always-open, entering-tense, spans both teams)

Renders below the seal, alongside the (now purely numeric) Pitchers stat
grid — `buildMarginNotes` (`src/api/pitcher-callouts.js`) runs every
pitcher who's appeared so far this game (both sides) through
`buildPitcherNotes` plus the health builders below, dedupes by `dedupeKey`
(same latest-wins contract as `callout-notes.js`'s box-score roll-up), and
sorts by score — the builder itself doesn't truncate. `MarginNotes.jsx` shows
the first `MARGIN_NOTES_SHOWN` (5) up front and reveals the rest on tap, the
same "Show N more" pattern as `FormerTeammates`/`InsightsCard`.
`homeAway` only fires for the pitcher who actually started tonight's game
(`isStarter`, position 0 in the team's boxscore pitching order) — a reliever
who also has a starts record on file elsewhere in the rotation must not be
credited with a game he isn't starting.

Alongside the older home/away, CG/shutout, scoreless-streak, 6+ IP and 10-K
notes (`buildPitcherNotes`), relievers get three workload/pattern notes, all
season aggregates joined from the pitcher game-log sweep:

- **workload** — his trailing-window pitch count vs the level's average
  reliever (`starterRecords[id].recentPitches`, `bundle.bullpen`): "Heavy
  recent workload: 52 pitches across 3 appearances in the last 4 days — the
  average reliever threw 16." Gate: ≥ 1.5× the peer average; otherwise the
  plain appearance-count note.
- **backToBack** — he pitched on the slate's eve (`pitchedYesterday`), so
  tonight is no-rest work: "Pitching on back-to-back days — he has a 5.79
  ERA on no rest this season (3.46 otherwise)" (`backToBack`, ≥ 4 outings on
  each side).
- **penFatigue** — he's working a 3rd (or later) consecutive day
  (`workloadFor`, the gen-workload.mjs precompute, threaded in with the
  game's freshness-gated date): "Working a third straight day — 41 pitches
  over his last 3 appearances." The sharpest documented fatigue pattern
  (velo down ~1.5 mph on 3 straight), so it leads; it suppresses the plain
  back-to-back fallback below (the ERA-split version still shows — a
  different fact).
- **leverage** — opponents' AVG with his club ahead vs trailing/tied
  (`leverage`, the API's sah/sbh/sti splits, ≥ 8 IP per bucket, AVG gap
  ≥ .060): "Opponents hit .204 off him with the Sounds ahead this season,
  .301 with them trailing."

The two in-game health signals join the same ranked list (`healthNotes` in
`pitcher-callouts.js`, wrapping `pitcherHealth.js`'s reads) and carry the
highest bases in the family — tonight-specific and the most actionable read
on a pitcher, ahead of every season aggregate above:

- **laboring** — tonight's pitches/inning vs. his own season norm
  (`laboringFor`, workload.json baseline): "Laboring: 24.7 pitches per
  inning tonight — his season norm is 16.1."
- **veloDecay** — fastball-family velocity drop from his first two innings
  to his latest revealed one (`computeVeloDecay`): "Fastball down 2.0 mph
  from his early innings (93.9 → 91.9)."

## Extending

One metric-adjacent family was deliberately NOT built as a callout: the
lineup-strength grade (its receipt card already owns the lineup page — a
callout would restate it). The in-game laboring/velo-decay signals ARE
callouts now (Margin Notes, above) — before the Pitchers table's notes
joined the worthiness system, they were the one exception, kept as plain
Pitchers-table rows since the row they annotate already sat right there.

Per CLAUDE.md's standing rule: new record/streak/split families extend
`gen-callouts.mjs` (never a parallel generation path); anything computable
from data already on hand computes live. When adding a family, give it a
`kind`, a `dedupeKey` if it can restate itself, a `SCORE_BASE` row (and a
line in the rubric table above), and decide its tense per ADR-0014's rule
before picking its surface.

**Names in callout prose read "First Last"** (or surname alone), never the
scorebook's "Last, First" — callout copy is broadcast-voice, not a ledger
row ("Bullpen watch: … — Carmen Mlodzinski, Khristian Curtis", "…of
Woodruff's 84 pitches"). The Last-First convention belongs to the lineup/
roster/pitcher-table *rows* the notes sit beside, not to the notes
themselves.
