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

## The five surfaces

| Surface | Module | Tense |
| --- | --- | --- |
| Innings-view play cards | `buildCallouts` (`src/api/callout-notes.js`) via `PlayByPlay` | Entering + revealed plays only ("that's No. 16 this season") |
| Pre-half strip (the reference panel's ARMS tab, merged into Margin Notes) | `buildPreHalfCallouts` (`src/api/prehalf-callouts.js`) via `ReferencePanel` | Entering; the leading-after + times-through notes restate already-revealed material |
| Margin Notes (always open, spans both teams' pitchers) | `buildMarginNotes` (`src/api/pitcher-callouts.js`) via `MarginNotes` | Entering-tonight season aggregates + live health reads (laboring, velo decay), never result-aware — same footing as the pre-half strip |
| Between Innings (the console band, any revealed half) | `buildBetweenInnings` (`src/api/between-innings.js`) via `BetweenInnings` | Same entering-tonight families as Margin Notes/the pre-half strip, through a stricter hard allowlist that drops every checkpoint family that reads tonight's score |
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

**Every bonus lands on ONE scale, 0–`MAGNITUDE_MAX` (20).** It did not always:
each family used to stop wherever its author stopped — 10 here, 15 there, 20
somewhere else — so a family whose bonus capped at 10 was ranked almost
entirely by its base, and no instance of a 25-base family could overtake a
40-base one however extreme it was. On a two-slot strip the base WAS the
ranking. `magnitudeOf(raw, full)` in `callout-notes/shared.js` is the one
converter (`skewBonus(w, l)` is the W-L families' shortcut through it): `raw`
is the family's own measure of how big this instance is, `full` the value that
earns the whole 20. Each family kept its old saturation point — only what
saturation is worth changed. The column below names that saturation point, so
"full at X" reads as "an instance at X earns the whole 20".

| Family | Base | Bonus, 0–20 — full credit at |
| --- | --- | --- |
| leadReversal | 85 | a spotless record (skew .5) |
| birthdayStats | 60 | — |
| birthday | 55 | — |
| homerRec | 55 | a spotless record |
| veloPeak | 55 | 5 mph past ELITE_VELO_MPH |
| onBaseEnded | 50 | a 23-game streak (a 14-steal run on the caught-stealing wording) |
| onBaseExtended | 45 | a 23-game streak |
| marathonAb | 45 | 11 fouls in the at-bat |
| onBaseRiding | 40 | a 23-game streak |
| leadHeld / leadAfterLive | 40 | a spotless record |
| bothScoreless | 42 | a spotless record |
| tiedAfter / tiedAfterLive | 40 | a spotless record |
| starterRec | 40 | a spotless record |
| bullpenThin | 40 | 4 relievers down |
| vsTeam | 40 | angle strength 2 |
| leader (hits/SB) | 35 | a count of 60 |
| leader (pitcher K) | 35 | a count of 180 |
| sbStreak | 35 | a run of 14 |
| foulVolume | 35 | 15 fouls past the expected count |
| runsScored | 35 | a spotless record |
| runsAllowed | 35 | a spotless record |
| oneRun / extraInnings | 35 | a spotless record |
| tto (with a season split) | 35 | a .150 AVG gap |
| scorelessThrough | 34 | a spotless record |
| ttoPitches | 30 | +1.5 pitches per PA each trip |
| pitchPace | 32 | 30 pitches off his norm |
| comeback | 30 | a 1.000 win% (resilience, not lopsidedness) |
| scoringFirst / oppScoringFirst | 30 | .300 deviation from the league norm |
| inningRunDiff | 30 | a margin of 40 |
| dayOfWeek | 30 | a spotless record |
| foulSpoiler | 30 | rank 1; the roll-up restatement adds a second bonus, full at 18 fouls tonight |
| matchupSkill | 36 | a 2.0-SD collision on the weaker of its two sides |
| matchupStyle | 33 | a 2.0-SD collision on the weaker of its two sides |
| matchupArsenal | 38 | a 2.0-SD collision on the weaker of its two sides |
| risp / platoon | 25 | — |
| tto (plain trip fact) | 20 | — |

### The corroboration nudge — a club's own notes as a curation signal

One thing besides the base and the magnitude bonus can move a score, and it is
worth exactly **`CORROBORATION_BONUS` (6)**: a club's own pre-game Game Notes
PDF writing about the same fact bbsbh computed. The reasoning (issue #774, from
the exploration in `.scratch/game-notes/INSIGHTS-EXPLORATION.md`) is that a PR
staff choosing to write up a hitter's on-base streak is evidence about
*worthiness* that no stat line carries — so it decides which of several TRUE
facts leads, and nothing else. It never writes a note, never changes a word of
one, and never adds a surface.

Deliberately smaller than any magnitude range: a nudge can break a tie and lift
an instance past a neighbour in the table above, but can never carry a family
over one a tier above it.

- **Where it joins.** `bundle.corroborated` is `{ personId: [kind] }`, written
  by `gen-callouts.mjs`. `corroborationBonus(bundle, kind, personId)`
  (`callout-notes/shared.js`) takes it, joining on BOTH the person and the
  family. Five families can be corroborated today, and every one of them is
  keyed by person in a bundle: `leader`, the three on-base-streak tenses
  (`onBaseRiding` / `onBaseExtended` / `onBaseEnded`), `sbStreak`, `homerRec`,
  and Margin Notes' `scorelessStreak`.
- **Where it comes from.** A **manual** scan, not a cron:
  `scripts/scan-game-notes-insights.mjs extract` pulls the clubs' PDFs through
  the shipped parser and writes a dossier (blurbs + roster + the facts we
  already computed); an agent reads and classifies it; `… apply` validates that
  classification into `public/data/game-notes-corroboration.json`. The closed
  vocabulary, the staleness window (7 days) and the per-club cap (12) live in
  `scripts/lib/game-notes-corroboration.mjs`.
- **The spoiler rule applies in full.** Club notes are stuffed with recaps
  ("dropped Game 1, 5-3"). Those are `result` tier and are REFUSED at scan
  time — not ignored, refused — because a recap is the score of a game the
  reader has not watched. Only `timeless` and `standing` blurbs may reach a
  score, and even then nothing from the notes is rendered.

Margin Notes' own family bases (`src/api/pitcher-callouts.js`'s local
`SCORE_BASE` — self-contained rather than imported from `callout-notes.js`,
same precedent the pre-half strip sets):

| Family | Base | Bonus, 0–20 — full credit at |
| --- | --- | --- |
| laboring | 48 | a 1.5× pitches-per-inning ratio |
| veloVariety | 47 | 5 × (types − 2) + 3 × (peak velo − CENTURY_MPH) reaching 20 |
| veloDecay | 46 | a 4.0 mph drop |
| penFatigue | 42 | — |
| workload | 38 | — |
| backToBack | 36 | — |
| leverage | 34 | a .210 AVG gap |
| centuryClub | 34 | 150 pitches, + 10 flat if a non-fastball type qualifies |
| tenK | 33 | — |
| scorelessStreak | 32 | a 16-outing streak |
| sixIp | 28 | — |
| homeAway | 30 | — |
| cgShutout | 25 | — |
| recentAppearances | 20 | — |

## Repetition — the shown ledger, decay, and diversity

Every surface here rebuilds from scratch on every half, and all of them sort on
the same score. Without a memory, the same high-base note therefore wins the
same sort every half of the game: a reader who sits through nine innings meets
the identical card fifteen times, and the three unconditional pushes in
`between-innings.js` (`starterRec`, `dayOfWeek`, `bullpenThin`) could each
print seventeen times. Four rules answer that.

- **The ledger.** `src/hooks/useCalloutLedger.js` remembers, per gamePk, which
  `dedupeKey` reached the screen on which HALF — distinct halves, never
  renders. It is a `Map` inside a React context mounted in `InningViewer`,
  ABOVE every keyed boundary (`InningPage` and `BetweenInnings` both remount on
  each half, which is exactly when the memory is needed), so a `SealBox`
  re-seal leaves it alone. It is deliberately NOT persisted: after a reload the
  reader is reading the page again and the strip must populate normally. It
  holds no game data — dedupeKeys and half indices, nothing else — and it can
  only ever SUBTRACT a note from a ranked list, never add one and never relax a
  reveal gate.
- **Decay.** A note loses `SHOWN_DECAY` (25, `callout-notes/shared.js`) for
  each EARLIER half it was already shown on. A demotion, not a ban: a decayed
  note with nothing to beat it still shows, which is the right answer for a
  thin bundle. The half a note sits on never counts against it, so nothing
  decays itself out from under the reader mid-half.
- **Once per game.** `ONCE_PER_GAME_KINDS` — the facts that cannot change while
  a game is played (the weekday, the club's record in its starter's starts, a
  short bullpen, a club's runs in inning N, and every season aggregate
  `buildPitcherNotes` reads off `starterRecords`). A second showing of one of
  those adds nothing at all, so after one showing they drop rather than decay.
  `sixIp`, `tenK` and every health read are deliberately absent: those restate
  as tonight's line grows, and restating IS the note.
- **Diversity.** At most one note per KIND per surface per half, and at most
  ONE `RECORD_KINDS` note ("the club is W-L when X") per pre-half strip -
  eleven families are that one sentence with a different clause, which is why
  the voice repeated even when the facts did not. A note a diversity rule turns
  down is DEFERRED to the tail rather than discarded, and what a CAPPED surface
  then does with that tail is per-surface, because the two want opposite things:
  - The **pre-half strip** passes `strictCaps: true` and DROPS the tail. Its
    pool for a top half is very often nothing but record notes (both clubs'
    `tiedAfterLive`, or both clubs' `bothScoreless`), so letting the tail
    backfill hands both slots to one kind again and the cap delivers nothing.
    A one-note strip is the honest outcome — there is only one thing to say.
  - **Between Innings** does NOT, and must not. Its card depth is a spoiler
    invariant (`between-innings.test.js`): a quiet half and a loud half must
    return the same count once both clear `CARD_MAX`, so the tail has to
    backfill or depth would track how eventful the half was.
  - **Margin Notes** is uncapped, so it always carries the tail behind
    "Show N more".

All four are applied by one pure function, `rankNotes` in
`callout-notes/shared.js`, at each surface's own sort-and-cap step: the
pre-half strip (`prehalf-callouts.js`, `maxRecordNotes: 1`), Between Innings
(`between-innings.js`), and the Arms tab's merge of the strip with Margin Notes
(`ReferencePanel.jsx`'s `mergeNotes`, uncapped). The builders stay pure — they
are HANDED the counts (`shownCounts`) and only read them. A surface records
what it showed from an effect, on the notes that actually reached the screen:
`MarginNotes.jsx` marks the notes it renders (not the hidden tail), and
`BetweenInnings.jsx` marks only the card the reader advanced to. Play cards
(`liveAtBat.js`) and the box-score roll-up stay outside all of this: neither
ranks against a cap, and the roll-up's whole job is to restate (ADR-0014).

### Caps — how many notes each surface keeps

Every cap is a constant with one home. `rankNotes` applies the diversity ones;
the surface applies its own count.

| Constant | Value | Where | What it caps |
| --- | --- | --- | --- |
| `PREHALF_MAX` | 2 | `prehalf-callouts.js` | Notes on the pre-half strip |
| `PREHALF_MAX_RECORDS` | 1 | `prehalf-callouts.js` | `RECORD_KINDS` notes on that strip |
| `CARD_MAX` | 5 | `between-innings.js` | Cards in one Between Innings set |
| `MARGIN_NOTES_SHOWN` | 5 | `MarginNotes.jsx` | Margin Notes shown before "Show N more" |
| `INSIGHTS_SHOWN` | 6 | `src/screens/BoxScore.jsx` | Roll-up notes shown before Show more |
| `VS_TEAM_ROLLUP_MAX` | 3 | roll-up | `vsTeam` notes in the roll-up |
| `MAGNITUDE_MAX` | 20 | `callout-notes/shared.js` | Every family's magnitude bonus |
| `SHOWN_DECAY` | 25 | `callout-notes/shared.js` | Points lost per earlier showing |
| `maxPerKind` | 1 | `rankNotes` callers | Notes of one `kind` per surface per half |
| `strictCaps` | strip only | `rankNotes` callers | Whether a capped surface DROPS the turned-down tail or backfills from it |

The builders never truncate for the components: `buildMarginNotes` sorts and
returns everything, and the roll-up does the same. Only `buildPreHalfCallouts`
and `buildBetweenInnings` cap themselves, which is why an audit of those two
surfaces cannot measure how many notes a cap cut.


## League ranks on the W-L record families

A bare split is a number; a ranked split is a fact. Every W-L record family
below carries a league rank, appended to the entering-tense sentence after an
em dash and NEVER replacing the record:

> The Rays are 62-1 this season when leading after the 7th — the best mark in
> the majors

Ranked families: `leadAfterLive`, `tiedAfterLive`, `scorelessThrough`,
`bothScoreless`, `dayOfWeek`, `runsScored`, `runsAllowed`, `comeback`,
`scoringFirst` / `oppScoringFirst`. Each family's own bullet below repeats the
marker **(ranked)**. `oneRun` / `extraInnings` carry NO rank: those notes are
Final-only and always folded, so a rank could never print.

Rules, all in `src/api/callout-notes/rank.js`:

- **The rank comes from the same tally as the record.** `gen-callouts.mjs`
  runs its situational sweep over EVERY club at each level on the slate, not
  only the clubs playing, and ranks the raw tallies before any show floor. The
  league-wide ledger in `public/data/team-records/*` counts the walk-off inning
  this sweep deliberately skips and reads a later cutoff — up to seven games
  apart on one club's "leading after the 8th" — so it cannot supply this.
- **The field is the club's own level**, named in words: "in the majors", "in
  Triple-A", "in Double-A", "in High-A", "in Single-A".
- **Rank display**: ordinal words only, never `#`, and the field size always
  printed — "2nd of 30 in the majors". Rank 1 and last read "the best mark" /
  "the worst mark"; a shared rank reads "tied for …".
- **Only the ends of the table speak.** Top three or bottom three
  (`RANK_NOTABLE`), and only in a field of at least eight (`RANK_MIN_FIELD`).
  A 14th-of-30 rank is noise. The precompute drops those ranks outright
  (`rankWorthPrinting`), so a bundle carries only the standings a note can say
  — about a fifth of what the pass computes, and roughly 0.2 KB per bundle.
- **Never on a folded sentence.** "Moved to 59-2" states tonight's record; the
  rank was computed against last night's. Every `result?.final` branch in
  `heldNotes.js` and the roll-up's own re-fold stay bare.
- **A missing rank prints today's wording.** An older bundle, a MiLB level with
  no standings splits, a club under the family's sample floor — all degrade to
  the unranked sentence. No note's `SCORE_BASE` moves for a rank.

## The families

Data families are precomputed nightly by `scripts/gen-callouts.mjs` into
`public/data/callouts/<MMDDYYYY>/<gamePk>.json`, one file per game (bundle
shape: `src/api/callouts.js`).
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
## Matchup callouts — a hitter against the arm he faces

Three families that read BOTH sides of a matchup on one axis and fire only
when the two collide. Data is `public/data/savant-matchup.json`
(`scripts/gen-savant-matchup.mjs`), read through `src/api/matchup/savant.js`;
the season-axis notes (matchupSkill/matchupStyle) are built in
`src/api/matchup/notes.js`, the pitch-type note (matchupArsenal) in
`src/api/matchup/arsenal.js`, both sharing rendering mechanics from
`src/api/matchup/voice.js` — and all three are resolved to a half by
`src/api/matchup/forHalf.js`. MLB only — Savant has no minor-league board.

**Why the two sides are comparable at all.** Savant's `custom` leaderboard
returns the SAME columns for `type=batter` and `type=pitcher`: a batter's
`pull_percent` is how often HE pulls, a pitcher's is how often hitters pull
AGAINST him. The two boards agree on the league mean because they count the
same events from two sides (2026-08-20: pull 39.4 / 39.3, chase 31.4 / 30.5,
whiff 25.8 / 25.4). The generator checks that agreement on every run and warns
if it drifts — a drift is the comparison breaking, not a formatting bug.

- **matchupSkill** — chase / whiff / hard contact, where one direction IS
  better. Fires when both sides sit ≥ 1.15 SD from their own role's league mean.
  Three readings print (strength vs strength, the pitcher's strength against a
  hole, the hitter's strength against a hole); weakness against weakness is
  dropped, because two holes meeting says nothing.
- **matchupStyle** — pull / ground ball, where neither direction is better.
  These are TENDENCIES, so the note fires only when the two point OPPOSITE
  ways; both pulling hard is agreement, not a collision.

Each side is scored against its OWN spread. That is load-bearing: pitchers vary
far less than hitters (chase SD 3.6 vs 6.9, hard-hit 5.1 vs 9.6), so a shared
raw-percentage threshold would fire constantly on hitters and almost never on
pitchers. At most one note per family per matchup — the strongest axis wins.

**Spoiler footing.** The notes read season aggregates only and take no feed, so
they need no reveal gate and sit on `BETWEEN_INNINGS_ALLOWED_KINDS`. What IS
gated is resolving WHO is in the matchup: `forHalf.js` goes through
`selectDueUpNow` and `defenseEntering`, which each enforce `safeToShowEntering`
themselves, so a half further out than the reader's own next one yields no
players and therefore no notes (ADR-0003/0010).

### The voice rules, and why they are rules

Two blind copy reviews (a game-notes editor and a beat writer) went over the
draft wording. Three findings were ERRORS, not style, and each is now pinned by
a test in `test/matchup-callouts.test.js`:

- **`chase` means "swing at a pitch OUT of the zone" and nothing else.** It is
  an axis in this very family; the draft also used it for "swing" on a whiff
  rate, making one word mean two things in one product.
- **A pitcher is never the subject of `pulled`** — "gets pulled" means removed
  from the game. The pull clause takes `hitters` as its subject instead.
- **"hits 29% on the ground" reads as a batting average.** It is "puts 29% of
  his batted balls on the ground".

The rest, all enforced in `notes.js`:

- **Rates round.** Decimals belong on averages, ERA, mph and pitches per inning
  — never on a rate percentage. Same `Math.round(rate * 100)` shape
  `vsTeamNote.js` already uses. A rate near a clean fraction reads as words
  ("half his batted balls").
- **One construction for the baseline**: `league average is X`, matching the
  shipped foul note. Never three phrasings for one move.
- **Every note is scoped `this season`.**
- **Surnames in the short form, full name on prose first reference.**
- **The intensifier is conditional.** `just` is a DIMINUTIVE: it may appear on
  at most one side, only past 1.5 SD, and only on a value BELOW its own league
  mean. A word that appears by default is a tic; one conditioned on the number
  is judgment.
- **Polarity lives in the turn word**, never in arithmetic the reader has to do.
- **One interpretive clause per prose form, maximum**, and it must fail a paste
  test — a gloss that fits every note in its family is filler, so a gloss needs
  1.75 SD and the hitter being the more extreme side to earn its slot.

### Two renderings, and the shape rotation

Every note carries `text` (short) and `prose` (long); the surface picks. The
short form caps at `SHORT_MAX` (150) — the measured ceiling of the existing
strip, set by the times-through note.

Because every note in this family is "two numbers pointing opposite ways", one
rhetorical figure repeated fifteen times across nine innings stops being read.
So the SHAPE rotates by note index across three joiners: an em dash (only when
what follows is CONTEXT, never a second subject), a semicolon (the true
parallel), and a named turn (the asymmetric case). At most one em dash per note,
and never a dash plus `but` — the dash already made the turn.

**The short form is length-aware, with a drop order rather than a truncation.**
The properly-scoped forms run 118–145 characters, and a long name pair
overflows 150 (Yamamoto / Guerrero Jr. reached 154 in testing). `fitShort` drops
the league average first, then the emphasis word, then falls back to the
shortest parallel — the same graceful-degradation discipline the MiLB selectors
use. The cap does not move.

### matchupArsenal — a hitter against ONE PITCH

A level deeper than matchupSkill/matchupStyle: the same two people, on one
pitch type, joined on Savant's `pitch-arsenal-stats` board (`player_id`,
`pitch_type` — identical columns for both roles, same as the `custom` board).
It also covers relievers, which the season-axis families effectively do not —
the arsenal board carries 683 pitchers against the custom board's 445.

**Whiff is the only trigger.** A hitter has a median 36 PA against one pitch
type; batting average there is ~12% real skill by an exact binomial model,
because BA's denominator is PA. Whiff is ~84%, because its denominator is
pitches SEEN (median 149) — four times the trials. `ba` prints as color only,
on a note whiff already earned, past the generator's own PA floor — never as a
trigger, never scored, never compared to a baseline of its own.

**Gates, all in `gen-savant-matchup.mjs`, not the note builder.** A pitcher's
own pitch row counts only past `usage ≥ 15%` and `pitches ≥ 150` thrown — a
pitch he throws 4% of the time isn't what the at-bat is about. A batter's row
counts only past `40 PA` against the type. Whiff is regressed toward that PITCH
TYPE's own league mean (weight `K=50` pitches — whiff is already ~94% stable,
and a heavier weight was tried and collapsed the family to a third of its
notes). A single global "pitches seen" floor would make the family all-fastball
— splitters and sweepers have far smaller samples than four-seamers — so the
regression, not an extra exclusion floor, is what keeps a thin secondary-pitch
row honest instead of dropping it outright.

**Four quadrants, one dropped.** Both sides' whiff must clear 1.15 SD from
their own pitch-type baseline; past that, classification is the raw sign —
high whiff is a STRENGTH for the pitcher (he gets misses on it) and a
WEAKNESS for the batter (he misses when he swings at it):

- pitcher HIGH + batter HIGH → **mismatch** — his best pitch, this hitter's
  hole. The strongest note in the family.
- pitcher HIGH + batter LOW → **standoff** — his out pitch, the one this
  hitter covers.
- pitcher LOW + batter HIGH → **weak but printable** — the hitter is exposed
  to a pitch that isn't actually a bat-misser for this arm.
- pitcher LOW + batter LOW → **dropped.** Neither side has a demonstrated
  edge on whiff, the only thing this family trusts. An earlier prototype
  labelled this "hitter edge" and was wrong to.

Same voice rules as matchupSkill/matchupStyle (`chase` never means "swing";
rates round; one baseline construction; surnames short, full names in prose;
the shape rotation and length-aware short form via `voice.js`), plus one
addition: the pitch usage clause reuses `quantity()` for "a third of the
time"-style wording, and the batting-average color clause prints its sample
count — `(N PA)` — only when the batter's PA against the type is under 80
(the low-sample bucket the family's own research used).

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
- **veloPeak** — the pitcher throws a single pitch that's either a new
  **season** high for him (any pitch type) or clears the absolute
  `ELITE_VELO_MPH` bar (102, tunable — `src/api/pitchArsenal.js`) even if it
  isn't, read off progress.js's per-play `newPeakVelo` (the pitcher's own
  running game-high, revealed plays only) against
  `starterRecords[pitcherId].centuryClub.seasonMaxVelo` (joined from
  `gen-pitch-arsenal.mjs`'s sweep, see Margin Notes' `centuryClub` below).
  Card names the pitcher (like the strikeout-leader note above, since a play
  card otherwise renders under the BATTER's name): "New season high for
  Miso — 105.1 mph, topping his previous best of 103.8" or "Miso touched
  103.2 mph on a slider — one of the hardest pitches he's thrown all
  season." Fires once per pitcher per game — dedupeKey `veloPeak-{id}` so a
  later, harder pitch the same game restates it. Independent of
  `veloVariety` (Margin Notes below), which needs 2+ distinct pitch types
  this game; this fires on ONE pitch alone, regardless of variety. Roll-up,
  Final: folded with the day-word framing — "Hit a new season-high 105.1
  mph tonight."
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

- **scoringFirst / oppScoringFirst** (ranked) — fires on the play that scored the
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
- **dayOfWeek** (ranked) — 1st inning, on the top half only (shown once): each club's
  W-L on tonight's day of the week (`dayOfWeek`, keyed 0=Sun…6=Sat from the
  game's official date). "The Brewers are 10-4 on Sundays this season." A pure
  calendar fact — no reveal gate — but only when genuinely one-sided: ≥ 6 games
  and win% ≥ .66 or ≤ .34 (`DOW_MIN_GAMES`/`DOW_LOPSIDED` in callout-notes.js),
  or an ordinary weekday is noise. Roll-up (`buildDayOfWeekNotes`) folds tonight
  in once Final. MLB + MiLB (the linescore sweep covers every level).
- **leadAfterLive** (ranked) — top of inning N ≥ 7 (checkpoints 6–8): whoever leads
  tonight after N−1 + their season record at that checkpoint
  (`leadAfterFull`, ≥ 5 games). Self-gates on `revealedThrough` covering
  inning N−1 (ADR-0014). **No 9th checkpoint anywhere in this family**: a club
  leading after nine completed innings has won, so the record can only read
  N-0 and the note says nothing. See `LEAD_CHECKPOINTS`.
- **tiedAfterLive** (ranked) — the tied-game sibling of `leadAfterLive`: entering top of
  inning N (checkpoints 6–8 only — a tie after the 9th is extra innings, never
  surfaced up front) when the game is level after N−1, BOTH clubs' season
  record when tied at that checkpoint (`tiedAfterFull`, ≥ 5 games, no
  lopsidedness floor). "The Brewers are 12-9 this season when tied after the
  7th." Same `revealedThrough` self-gate as leadAfterLive (ADR-0014). Roll-up
  (`tiedAfter`, both clubs) folds tonight's result in once Final — "moved to
  13-9…" for the winner, "dropped to 8-11…" for the loser — latest checkpoint
  only, via `buildTiedAfterHeldNotes`.
- **scorelessThrough** (ranked) — entering top of inning N (checkpoints 1–6) when a club
  is still shut out after N−1: that club's season record when scoreless through
  that inning (`scorelessThroughFull`). "The Brewers are 2-15 when scoreless
  through 6 innings." Numbers-only in the bundle so the roll-up folds tonight
  in; the note layer gates one-sidedness (`SCORELESS_LOPSIDED` .68, either
  direction — an early ~.500 checkpoint means nothing). Same `revealedThrough`
  self-gate as tiedAfterLive (knowing a side is scoreless restates the score).
  Fires for whichever side is at 0 — but NOT when the game itself is 0-0, where
  the bothScoreless framing takes over. Roll-up: `buildScorelessHeldNotes`,
  deepest checkpoint, folded. MLB + MiLB.
- **bothScoreless** (ranked) — the pitchers'-duel sibling: entering top of inning N
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
- **runsScored** (ranked) — highest bucket (4/6/8+) tonight's own final clears,
  ≥ 5 games sampled; folded once Final, and the rank drops with the fold.
- **runsAllowed** (ranked) — allowed 4+ by checkpoint inning 5–8,
  precompute-gated to a losing-lopsided record; latest checkpoint only; folded
  once Final, and the rank drops with the fold.
- **comeback** (ranked) — trailed by 3+ at some point tonight → season record
  in such games (≥ 5 sampled); folded once Final, and the rank drops with it.
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
notes (`buildPitcherNotes`), relievers get three workload/pattern notes (all
season aggregates joined from the pitcher game-log sweep), plus one
velocity-season note that applies to any pitcher, starter or reliever:

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
- **centuryClub** — his season total of `CENTURY_MPH`+ (100, tunable —
  `src/api/pitchArsenal.js`) pitches, joined from `gen-pitch-arsenal.mjs`'s
  own sweep into `starterRecords[id].centuryClub` (count, per-type
  breakdown, `seasonMaxVelo`) by `gen-callouts.mjs` (`scripts/lib/century-club.mjs`).
  Gate: `count ≥ CENTURY_CLUB_MIN` (5) — a one-off 100 mph touch is
  unremarkable for a real flamethrower. A non-fastball type in the mix leads
  the phrasing, since a breaking ball or changeup at triple digits is the
  genuinely rare case: "Has thrown 52 pitches at 100+ mph this season —
  including 9 sliders, extraordinarily rare for a breaking or offspeed
  pitch — topping out at 103.4 mph" vs. the plain fastball-only phrasing.
  Not starter-only — any pitcher on file qualifies.

The in-game health signals join the same ranked list (`healthNotes` in
`pitcher-callouts.js`, wrapping `pitcherHealth.js`'s reads) and carry the
highest bases in the family — tonight-specific and the most actionable read
on a pitcher, ahead of every season aggregate above:

- **laboring** — tonight's pitches/inning vs. his own season norm
  (`laboringFor`, workload.json baseline): "Laboring: 24.7 pitches per
  inning tonight — his season norm is 16.1."
- **veloVariety** — 2+ DISTINCT pitch types he's thrown at `CENTURY_MPH`+
  so far this game (`computeVeloVariety`, walks every pitch type, not just
  the fastball family — unlike `veloDecay` below) — the type-variety
  counterpart to `veloPeak`'s single-pitch spotlight above, and Margin
  Notes' own catch for the "breaking ball at triple digits" story: "3 pitch
  types have touched 100+ mph tonight — FF 101.2, SI 100.4, SL 100.1."
  Score/text scale with both how many types and how hard the peak one was.
- **veloDecay** — fastball-family velocity drop from his first two innings
  to his latest revealed one (`computeVeloDecay`): "Fastball down 2.0 mph
  from his early innings (93.9 → 91.9)."

## Auditing the rubric

`scripts/audit-callouts.mjs` replays every committed bundle through the app's
own builders and reports, per family: how many games it was ELIGIBLE in, how
often it fired, how many instances it produced, its score spread, and how many
instances survived the surface's cap. It is read-only and touches no app file.

```bash
node scripts/audit-callouts.mjs --concurrency=8
node scripts/audit-callouts.mjs --date=2026-08-16 --limit=20   # cheap smoke run
node scripts/audit-callouts.mjs --bundle-only                  # no network
```

Read the output with two cautions. A family the bundle cannot feed counts as
INELIGIBLE, never as a non-fire — a zero fire rate is only a finding when the
eligible count is high. And the pre-half strip and Between Innings truncate
inside their own builders, so their rows are labelled `post-cap` and report no
cut count; only Margin Notes and the roll-up report real cap survival. Low
survival on a high-volume family (`risp`, `platoon`) is the signal that its
base or its magnitude bonus needs a look.

## Extending

One metric-adjacent family was deliberately NOT built as a callout: the
lineup-strength grade, which owned the lineup page itself until the grade was
removed altogether (`.scratch/lineup-strength/`). The in-game
laboring/velo-decay signals ARE
callouts now (Margin Notes, above) — before the Pitchers table's notes
joined the worthiness system, they were the one exception, kept as plain
Pitchers-table rows since the row they annotate already sat right there.

Per CLAUDE.md's standing rule: new record/streak/split families extend
`gen-callouts.mjs` (never a parallel generation path); anything computable
from data already on hand computes live. When adding a family, give it a
`kind`, a `dedupeKey` if it can restate itself, a `SCORE_BASE` row (and a
line in the rubric table above), and decide its tense per ADR-0014's rule
before picking its surface. Then decide two more things: whether the fact can
change during a game (if it cannot, add its `kind` to `ONCE_PER_GAME_KINDS`),
and whether it is another "the club is W-L when X" sentence (if it is, add it
to `RECORD_KINDS`). Cover the new family in `test/` — `callout-repetition.test.js`
for ranking rules, `callout-ledger.test.js` for the ledger and the two capped
surfaces, `record-ranks.test.js` for a ranked record family.

**Names in callout prose read "First Last"** (or surname alone), never the
scorebook's "Last, First" — callout copy is broadcast-voice, not a ledger
row ("Bullpen watch: … — Carmen Mlodzinski, Khristian Curtis", "…of
Woodruff's 84 pitches"). The Last-First convention belongs to the lineup/
roster/pitcher-table *rows* the notes sit beside, not to the notes
themselves.
