# Anchor callouts: pair a season count with a well-known number

Status: idea, shaped. Not built. Working note, not the tracker. The tracker copy is `issue.md`
in this folder (file it when Gary says so).
Written 2026-11-03 from a research session. Every count below was checked that day.

## The idea in one example

A reader sees a note on a pitcher's card:

> One of 11 pitchers with a shutout, fewer than the 12 people who have walked on the moon.

The first half is a **count**: how many players had met a named threshold by that day. The
second half is an **anchor**: a number nearly everyone already knows. The pair gives the reader a
feel for "11" that a bare "11" cannot. Source of the form: the Rivera line, "12 people have
walked on the moon, only 11 have scored an earned run off Rivera in the postseason"
(CNA, Jan 2019; the "11" is not confirmed).

It fits the house voice (`docs/callouts.md`, "Voice"): the anchor is the number "it should be",
so the note never shows a number without a comparison.

## Decided

- **Gary, 2026-11-03: a callout is a moment in time.** It is true on the day it is minted and
  stays accurate as of that date. Baseball changes daily, so a note must know when it was true.
- **Gary, 2026-11-03: the date shows in the text only when it helps.** Five notes on one card
  must not each open with "As of today".
- **Gary, 2026-11-03: a note can outlive its game, and its wording ages.** A moon-walker stat that
  worked for Bauers on May 1 may stay on his player detail page for the rest of the season. By
  September it reads "In May, ...", not as if it were new.
- **Gary, 2026-11-03: the new store is named `nuggets`.** He suggested "nuggets" or "notes"; a
  collision check found "notes" in 219 files, and he confirmed `nuggets`. Structure: see "The store".
- **Gary, 2026-11-03: the nine open questions, answered.**
  1. Aging: no date on a game's own card, a month name when older, a year when older than the season.
  2. A game card shows a nugget only if it is within 7 days old. The player page shows the whole season.
  3. On the player page a nugget stays for the whole season, then moves to a career view.
  4. Thresholds are a curated list in code. A new line is a code review.
  5. With no anchor, a plain note ("One of 11 pitchers with a shutout") still shows when the count
     is small. Inference: "small" is 15 or fewer. Larger counts say nothing.
  6. No cap on anchor notes per card. The normal callout ranking and cap still limit the total.
  7. Tone: any sourced anchor is fine, including team-flavored ones like the 1972 Dolphins.
  8. Anchors that can change are allowed, with a 180-day expiry after the last check.
  9. Regular-season thresholds, plus a separate postseason ladder (for example a World Series
     hit line). Regular-season and postseason totals are not mixed.

## The store: nuggets

### Why a store, and what it holds

Two facts make this small. A counting stat only goes up, so once a player meets a threshold he
has met it for good. So the one fact worth storing is the **day he first met it**, which is a nugget. The count on
any past day is then just the number of nuggets up to that day. No daily snapshot is needed.

The 2026 shutout cohort shows why this matters (from `nuggets.probe.mjs`):

| Date | Pitcher | Count that day |
|---|---|---|
| 2026-04-01 | Alcantara | 1 |
| 2026-06-12 | **Misiorowski** | **5** |
| 2026-06-15 | **May** | **6** |
| 2026-09-25 | Pérez | 11 |

On June 12 the note is "One of 5 pitchers with a shutout, as many as the Great Lakes". The
"fewer than the moon" line only becomes true on September 25. Both are right on their own day.
A snapshot of today's total would have lost the first one.

### Vocabulary

| Word | Meaning | Where it shows |
|---|---|---|
| **Threshold** | A named line on counting stats: "100 RBI", "20 HR and 20 SB". Data, not code: `{ id, group, label, all: [{ stat, min }] }`. | `src/lib/nuggets/thresholds.js` (shared by the generator and the app) |
| **Nugget** | One minted, dated fact: a player met a threshold on a date. It freezes the count that day and the anchor chosen. The store holds nuggets. | one entry in the store |
| **Count** | How many players had met that threshold by the end of that day, this one included. Two players on the same day share one count. | field on the nugget |
| **Anchor** | A well-known number to compare the count with. | registry |
| **Note** | The sentence a reader sees, built from a nugget. | callout family `nugget` |

"Crossing" is the verb: a nugget records the day a player crossed a threshold. "Nugget" never
renders as a label. It is an internal name for prompts and code.

### Name, compared

Gary suggested "nuggets" or "notes" and chose `nuggets` (2026-11-03). Collision check, same day:

| Candidate | Verdict |
|---|---|
| **`nuggets`** (chosen) | Free as a module or data name. Only `FirstScorebookPage.jsx` and `src/styles/42-first-scorebook.css` use it, for small fact cards (`scorebookstory__nugget`, `starterNuggets`). That is the same meaning, and the class names are scoped. Fits the thing stored: a small fact that outlives its day. |
| `notes` | Rejected. 219 files use the word: `callout-notes/`, `gameNotes.js`, `game-notes/`, "Margin Notes". A store with this name would blur with the Game Notes PDFs. The sentence a reader sees stays a "note". |
| `crossings` | My first pick. Accurate, and repo-native (`gen-rookies.mjs` stores the date a career "crossed" a limit). But it names the mechanism, not the thing. Kept as the verb. |
| `feats` | Taken. A "feat" is a no-hitter or a cycle, and a feat label is a result on a scoring surface. A spoiler trap. |
| `milestones` | Taken. `milestones.json`, `MILESTONE_DEFS`, `logbookMilestones.js` mean career totals like 500 HR. |
| `ledger` | Taken. `useCalloutLedger` counts what a game card has shown. 295 files use the word. |
| `snapshots` | Taken. `team_snapshots` and `player_snapshots` are dated daily rows in SQLite. |
| `clubs` | "Club" already means a team all over the repo. |
| `cohorts`, `marks`, `bars` | Cohort is fine in prose only. Marks and bars are vague ("bar" is in 499 files). |

Add the term to `CONTEXT.md`, "Names" (slice 4):
**Nugget**: a minted, dated fact: a player met a named season threshold on a date, with how many
players had by then and the well-known number it is compared with. Internal name. _Avoid_: feat (a
no-hitter or cycle), milestone (a career total), note (the sentence a reader sees is the note; the
nugget is the record behind it).

### Shape

One file per season: `public/data/nuggets/{season}.json`.

```json
{ "season": "2026", "generatedAt": "...", "through": "2026-09-27",
  "nuggets": {
    "rbi100": [
      { "player": 668930, "date": "2026-09-27", "count": 9, "anchor": "scotus", "relation": "equal" }
    ]
  } }
```

- Each threshold's list is sorted by date. Fields use whole words, not one-letter keys.
- `count` and `anchor` are frozen at mint. A later registry change never rewrites an old note.
- The file holds facts only. Labels and rules live in `thresholds.js`, so a label fix needs no
  data rewrite.
- A finished season's file is never written again (the ADR-0086 rule for season stores). Last
  year's notes then read "In 2026, ...".

Size: 146 nuggets for 13 thresholds in 2026, about 15 KB. A 100-threshold ladder would stay
near 150 KB. Inference: the measure is `(sum of counts) x about 100 bytes`.

### Generator (`scripts/gen-nuggets.mjs`, nightly)

1. Two season-totals calls (hitting, pitching), the same ones `cohorts.probe.mjs` makes.
2. Keep players who meet a threshold and have no entry yet. These are the new crossers.
3. For each new crosser, fetch the game log and find the first game date at which every condition
   held. A late run loses nothing: the date comes from the game, not from the run.
4. Write `count` as every entry on or before that date, including the other new crossers.
5. Pick the anchor (`pick.js`) and append. Never rewrite or delete an old entry.

Idempotent: a second run adds nothing. Backfill is the same code on an empty file. The probe
dated 66 nuggets across 6 thresholds in 4.9 s, and every count matched the season totals.
A player traded in-season is summed across clubs in step 1. Inference: the game log lists his
games for every club (not yet checked on a traded player).

### Considered, not chosen

| Option | Why not |
|---|---|
| Daily files `cohorts/MMDDYYYY.json` (my first draft) | Repeats unchanged data every day, and cannot answer "when did he cross?" without reading every file. |
| SQLite group, `bySeason` (ADR-0021, ADR-0086) | That layer exists to join tables. This store has no join. Revisit if a nugget must join `player_snapshots`. |
| One file per player | Hundreds of files, and a game card needs the whole threshold. |
| Folding into `callouts/{date}/` | About 1 MB per date already (`docs/scripts/generators.md`). |

### Limits (v1)

- **Counting stats only.** Rates (ERA, AVG) go up and down, and "qualified" depends on games
  played, so a rate crossing is not permanent. Out of scope.
- **Regular season thresholds first.** Postseason gets its own ladder (decided), built later, so a
  postseason total never pushes a player over a regular-season line.
- **MLB only.** The bundle for a MiLB game simply lacks the key and no note fires.
- **A scoring correction after the fact** can leave a stored `count` off by one. Accepted: the
  note was true to the data that day. A check may list a nugget whose player no longer meets
  the threshold. Report, never delete.

## Parts

| Part | What it is | Where (Inference: names are proposals) |
|---|---|---|
| Registry | Anchors: count, noun phrase, tier, sources, caveat. Seed: `anchors.seed.json` here. | `src/lib/anchors/anchors.json` |
| Picker | Pure: count + unit -> best anchor and relation. | `src/lib/anchors/pick.js` |
| Thresholds | The named lines. | `src/lib/nuggets/thresholds.js` |
| Store | See above. | `public/data/nuggets/{season}.json` |
| Generator | Nightly. | `scripts/gen-nuggets.mjs` |
| Reader | Loads a season file once. Spoiler-free. | `src/api/nuggets.js` |
| Note family | Builds, ages and scores the note. | `src/api/callout-notes/nugget.js` |
| Surface | First home: Between Innings (Gameday checkpoint Notes). | `src/api/between-innings.js` |

Not the same as `useCalloutLedger`, which only remembers what a game card has shown.

## Picker rules

1. Only anchors with `status: verified` and unit compatible with the group.
   `people` pairs with players. `teams` pairs only with club thresholds. `things` pairs with
   nothing in v1.
2. A `volatile` anchor is ignored 180 days after its `checked` date. A `static` anchor is
   re-read yearly. The picker never fails CI over a date; a unit test lists the expired ones.
3. Relation: `count < n` is "fewer than", `count == n` is "as many as", `count > n` is "more than".
4. Pick the anchor with the smallest `|n - count|`. A gap above `max(1, round(0.2 * n))` means no
   anchor. Ties go to the lower `tier` number, then to a stable hash of player id and date, so
   the same player does not always get the moon.
5. No anchor fits: show the plain note if the count is 15 or fewer (decided; 15 is Inference),
   otherwise say nothing.
6. Tone: a team-flavored anchor is allowed if it is sourced (decided).
7. Within one card, do not reuse an anchor (Inference).

Fixtures (2026 counts): 11 -> moon-walked "fewer than"; 9 -> scotus "as many as";
13 -> triple-crown-horses "more than"; 5 -> great-lakes or calendar-slam "as many as";
1 -> dolphins-perfect only for a `teams` threshold.

## Note wording (house voice)

- Do not name the subject. The card already shows the headshot and name.
- Whole numbers. The season is the default and goes unsaid.
- Three templates. The date is not in the default text:
  - fewer: "One of {count} {group} with {label}, fewer than the {n} {phrase}."
  - equal: "One of {count} {group} with {label}, as many as the {n} {phrase}."
  - more: "One of {count} {group} with {label}, more than the {n} {phrase}."
- **Wording ages with the note (Inference, to confirm).** The anchor half never changes, so only
  the first half is dated. A helper picks the form from the nugget's age on the surface:
  - met the day before the game on screen: present, no date. "One of 11 pitchers with ..."
  - earlier, same season: "In May, one of 9 hitters with 100 RBI, ..." (month name)
  - an earlier season: "In 2026, one of 9 hitters ..."
  A game card shows no dates. A list of old notes dates each by month, which reads as a timeline,
  not as five copies of "As of today". There is no cap on anchor notes per card (decided); the
  normal ranking and `INSIGHTS_SHOWN` cap still apply. Inference: within one card, reuse no
  anchor twice, so the moon does not appear on every line.
- Write in ASD-STE100. Say "postseason", never the other word (`check-word-choice`).
- Never write "first", "fastest" or "fewest". The count is one season. An all-time claim needs an
  all-time source (not in scope).

## Anchor editorial rules (from the research)

- "People" and "teams" do not mix. Say "as many as the Great Lakes", not "as many people as".
- Count people, not offices: 45 people have been president, not 47.
- Moon: 12 walked on it, 28 flew to or around it. Artemis II did not land.
- Do not use a disputed, stale or unsourced anchor. The seed file's `excluded` list says why for
  each one (EGOT, Challenger Deep, space travelers, living ex-presidents, Everest, Comaneci).
- Add an anchor only with a source a person opened and a `checked` date.

## Score

New family `nugget` in `SCORE_BASE` (`src/api/callout-notes/shared.js`).
Inference: base 38 (just under `vsTeam` at 40), bonus `magnitudeOf(20 - min(count, 20), 19)`,
so a count of one earns the full 20. Tune with `docs/callouts.md`'s table, and keep the table in
the same commit.

## Spoiler-rule check

A nugget's date is a game date, so the date is the spoiler. A nugget dated D tells a reader
that the player did something on D. The rule is structural:

- **On the four scoring surfaces, only nuggets dated before the game's date may reach the
  DOM** (entering tense, ADR-0014, ADR-0088). The filter belongs in the reader, not in the
  caller, and a test pins it: a nugget dated on the game's own date must not come back.
- The store holds no score and no result.
- The player detail page is an open page (ADR-0034) and may show every nugget, newest first.
- Inference: the reader joins the spoiler-free list in `src/api/spoiler-manifest.json`. Check
  against `src/api/CLAUDE.md` before slice 3.
- A result-aware version (tonight's line meets the threshold) belongs only in the box score's
  Insights roll-up and is out of scope.

## Slices (each at most 5 files)

1. **Registry and picker.** `src/lib/anchors/anchors.json` (from the seed), `pick.js`,
   `test/anchor-pick.test.js`, `test/anchors-registry.test.js` (shape, one source and one date
   per anchor, no excluded id).
   Done when: `npm test` passes and the fixtures above hold.
2. **Thresholds, generator, store.** `src/lib/nuggets/thresholds.js`, `scripts/gen-nuggets.mjs`,
   `.github/workflows/update-nightly-data.yml` (the three edits in `scripts/CLAUDE.md`),
   `scripts/check-data-freshness.mjs` (stamp), `test/nuggets-pure.test.js`.
   Done when: a backfill gives the 2026 dates the probe printed, and a second run adds nothing.
3. **Reader, note family, first surface.** `src/api/nuggets.js`,
   `src/api/callout-notes/nugget.js`, `shared.js` (SCORE_BASE), `src/api/between-innings.js`,
   `test/nugget-notes.test.js` (aging, no-date-on-own-day, the date filter).
   Done when: a Brewers game card shows the note at 390 px with `?nointro`. The route and
   `gamePk` are not chosen yet; pick one from `docs/test-games.md`.
4. **Docs.** ADR for the entering-tense nugget rule (next free number; the tail is 0126),
   `CONTEXT.md` (term), `docs/api/static-data.md`, `docs/scripts/generators.md`,
   `docs/callouts.md` (catalog row and score row).
5. **Later, needs a wireframe Artifact (390 px and desktop).** A list of nuggets on the
   player detail page, newest first, with the aged wording, then a career view when the season ends.
   Reads the store.
6. **Later: the postseason ladder.** Separate thresholds and a separate store file or key. Needs the
   list of lines first (Still open #1).

## Still open

The nine questions are answered (see Decided). These came out of the answers:

1. **The postseason ladder.** Which lines? Inference: a World Series hit line, an RBI line, a
   strikeout line. Needs its own pass, and its own count (the pool of players is much smaller).
2. **The career view.** Where does it live, and does it need a wireframe? Slice 5 covers the
   season list only.
3. **"Small count" cutoff.** Is 15 right for a plain note?
4. **No cap on anchor notes.** With no cap, is the repeat-anchor rule enough, or does a card full of
   comparisons feel loud? Check on a real card in slice 3.

## Out of scope

Rate stats and "qualified" lists. All-time counts and "first ever" claims (they need Retrosheet or
Stathead). Result-aware wording. A new screen. Any anchor that is not in the registry.

## Probes in this folder

- `cohorts.probe.mjs`: the final season-total count for each threshold. A quick check.
- `nuggets.probe.mjs`: the crossing date for each player and each threshold, from game logs.
  This is the generator's core logic.

Both use `getJson` and write nothing. Source: statsapi.mlb.com, checked 2026-11-03.

## Sources for the research behind this

All checked 2026-11-03. See `anchors.seed.json` for each anchor's URL. The MLB.com facts that
reached this note (Chourio, Misiorowski, Pratt records) were read through search results only,
because MLB.com blocked the fetch tool; none of them is used in a count here.
