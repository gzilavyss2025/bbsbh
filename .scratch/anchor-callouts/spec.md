# Anchor callouts: pair a season cohort count with a well-known number

Status: idea, shaped. Not built. Working note, not the tracker. The tracker copy is `issue.md`
in this folder (file it when Gary says so).
Written 2026-11-03 from a research session. Every count below was checked that day.

## The idea in one example

A reader sees a note on a pitcher's card:

> One of 11 pitchers with a shutout, fewer than the 12 people who have walked on the moon.

The first half is a **cohort count**: how many players cleared a named milestone this season.
The second half is an **anchor**: a number nearly everyone already knows. The pair gives the
reader a feel for "11" that a bare "11" cannot. Source of the form: the Rivera line, "12 people have
walked on the moon, only 11 have scored an earned run off Rivera in the postseason"
(CNA, Jan 2019; the "11" is not confirmed).

It fits the house voice (`docs/callouts.md`, "Voice"): the anchor is the number "it should be",
so the note never shows a number without a comparison.

## Decided

- **Gary, 2026-11-03: a callout is a moment in time.** It is true on the day it is minted. Read
  later, it stays accurate "as of" that date. Baseball changes daily, so each note must say
  when it was true. Consequences:
  - The cohort file is a dated snapshot per day, like `public/data/callouts/MMDDYYYY`. Nothing
    overwrites an old day. A game opened in a week reads the file for its own date.
  - Every note carries its `asOf` date as data. The text shows the date only when it helps
    (rule below). Five notes on one card must not each open with "As of today".
  - Notes may show all year. The "show only when the season is final" idea is dropped.
  - A count that has since grown is not a bug. It was true that day.

## Parts

| Part | What it is | Where (Inference: names are proposals) |
|---|---|---|
| Registry | Anchors: count, noun phrase, tier, sources, caveat. Seed: `anchors.seed.json` here. | `src/lib/anchors/anchors.json` |
| Cohort file | Nightly: for each named milestone, the count and the member ids. MLB only. One file per date, never overwritten. | `scripts/gen-cohorts.mjs` writes `public/data/cohorts/MMDDYYYY.json` |
| Reader | Loads the cohort file for a game's date. Spoiler-free. | `src/api/cohorts.js` |
| Picker | Pure function: cohort count + unit -> best anchor and relation. | `src/lib/anchors/pick.js` |
| Note family | Builds the note, scores it, joins the ranked lists. | `src/api/callout-notes/cohort.js` |
| Surface | First home: Between Innings (Gameday checkpoint Notes). | `src/api/between-innings.js` |

## Cohort file shape

Produced by `cohorts.probe.mjs` in this folder. It uses the shared `getJson` client and it
reproduced the 2026 counts below on 2026-11-03.

```json
{ "season": "2026", "asOf": "2026-11-02", "generatedAt": "...",
  "cohorts": [ { "id": "sho1", "group": "pit", "label": "a shutout", "count": 11, "members": [<person ids>] } ] }
```

- Source: `/api/v1/stats?stats=season&season=Y&sportIds=1&playerPool=all&limit=2000`, once for hitting
  and once for pitching. 751 hitters and 868 pitchers in 2026.
- A player traded in-season has one split per club. Sum counting stats so one person counts once.
- A milestone ladder is a curated list of named milestones, not every threshold. Start with the 13
  rungs in the probe.
- The cut is the day before the slate (`asOf`), as in ADR-0088. One file per date; the file
  name is the date it was minted (Inference: same naming as `public/data/callouts/`).
  Size check needed: about 13 rungs now, so a season of daily files stays small, but count it
  before the ladder grows.

Counts the probe returned for 2026 (regular season, all of MLB):

| Milestone | Count | Brewers in it |
|---|---|---|
| a shutout | 11 | Misiorowski, May |
| 100 RBI | 9 | Turang (100) |
| 30 saves | 11 | Megill (30) |
| 15 wins | 8 | Misiorowski (16) |
| 200 strikeouts | 13 | Misiorowski (252) |
| 250 strikeouts | 1 | Misiorowski |
| 90 walks | 13 | Bauers, Turang |
| 30 steals | 16 | Hamilton (30) |
| 20 HR and 20 SB | 17 | Chourio |
| 100 runs and 100 RBI | 5 | Turang |
| 40 home runs | 8 | none |
| a complete game | 21 | Misiorowski, May |
| 180 innings | 13 | none |

## Picker rules

1. Only anchors with `status: verified` and unit compatible with the cohort.
   `people` pairs with players. `teams` pairs only with club cohorts. `things` pairs with
   nothing in v1.
2. A `volatile` anchor is ignored 180 days after its `checked` date. A `static` anchor is
   re-read yearly. The picker never fails CI over a date; a unit test lists the expired ones.
3. Relation: `count < n` is "fewer than", `count == n` is "as many as", `count > n` is "more than".
4. Pick the anchor with the smallest `|n - count|`. A gap above `max(1, round(0.2 * n))` means no
   anchor. Ties go to the lower `tier` number, then to a stable hash of player id and date, so
   the same player does not always get the moon.
5. No anchor fits: say nothing, or show the plain cohort note. Decision for Gary, see below.

Fixtures to test (2026 counts): 11 -> moon-walked "fewer than"; 9 -> scotus "as many as";
13 -> triple-crown-horses "more than"; 5 -> great-lakes or calendar-slam "as many as";
1 -> dolphins-perfect only for a `teams` cohort.

## Note wording (house voice)

- Do not name the subject. The card already shows the headshot and name.
- Whole numbers. The season is the default and goes unsaid.
- Three templates. No date in the default text:
  - fewer: "One of {count} {group} with {milestone}, fewer than the {n} {phrase}."
  - equal: "One of {count} {group} with {milestone}, as many as the {n} {phrase}."
  - more: "One of {count} {group} with {milestone}, more than the {n} {phrase}."
- **Date in the text (Inference, to confirm).** A small helper prefixes "As of Aug 14," only when
  the date is news to the reader: the note's `asOf` differs from the day of the game being
  viewed, or the surface mixes notes from several days. At most one dated note per card; the
  rest stay plain. A card for tonight's game shows no date at all.
- Write in ASD-STE100. Say "postseason", never the other word (`check-word-choice`).
- Never write "first", "fastest" or "fewest" in an anchor note. The cohort is one season. An
  all-time claim needs an all-time source (not in scope).

## Anchor editorial rules (from the research)

- "People" and "teams" do not mix. Say "as many as the Great Lakes", not "as many people as".
- Count people, not offices: 45 people have been president, not 47.
- Moon: 12 walked on it, 28 flew to or around it. Artemis II did not land.
- Do not use a disputed, stale or unsourced anchor. The seed file's `excluded` list says why for
  each one (EGOT, Challenger Deep, space travelers, living ex-presidents, Everest, Comaneci).
- Add an anchor only with a source a person opened and a `checked` date.

## Score

New family `cohort` in `SCORE_BASE` (`src/api/callout-notes/shared.js`).
Inference: base 38 (just under `vsTeam` at 40), bonus `magnitudeOf(20 - min(count, 20), 19)`,
so a cohort of one earns the full 20. Tune with `docs/callouts.md`'s table, and keep the table in
the same commit.

## Spoiler-rule check

The first surface (Between Innings, Margin Notes) uses the entering-tonight tense: the cohort
counts end the day before the slate (ADR-0088) and the note never says anything about tonight
(ADR-0014). The cohort file has no score and no game result. Inference: it joins the
spoiler-free reader list in `src/api/spoiler-manifest.json`; check against `src/api/CLAUDE.md`
before slice 2. A result-aware version (tonight's line pushes a player into a cohort) would live
only in the box score's Insights roll-up and is out of scope. A player or team page may show the
same cohort live: those pages are open (ADR-0034).

## Slices (each at most 5 files)

1. **Registry and picker.** `src/lib/anchors/anchors.json` (from the seed), `pick.js`,
   `test/anchor-pick.test.js`, `test/anchors-registry.test.js` (shape, one source and one date
   per anchor, no excluded id).
   Done when: `npm test` passes and the fixtures above hold.
2. **Cohort generator.** `scripts/gen-cohorts.mjs`, the three edits to
   `.github/workflows/update-nightly-data.yml`, the stamp in `scripts/check-data-freshness.mjs`,
   `src/api/cohorts.js`, `test/cohorts-reader.test.js`. Inference: copy the shape of
   `gen-comeback-wins.mjs` and `src/api/comebackWins.js`, a small file with its reader (not read
   in this session). Done when: the 2026 counts above come out of one run.
3. **Note family and first surface.** `src/api/callout-notes/cohort.js`, `shared.js`
   (SCORE_BASE), `src/api/between-innings.js`, `test/cohort-notes.test.js`, `docs/callouts.md`
   (catalog row and score row). Done when: a Brewers game card shows the note at 390 px with
   `?nointro`. The route and `gamePk` are not chosen yet; pick one from `docs/test-games.md`.
4. **Docs.** ADR for the entering-tense cohort rule (next free number; the tail is 0126),
   `docs/api/static-data.md`, `docs/scripts/generators.md`.
5. **Later, needs a wireframe Artifact (390 px and desktop).** A "scale" line on the player
   page, where the cohort can be live.

## Not decided (needs Gary)

1. **Is the date rule right?** Date in the text only when it is not the game's own day, at most
   one per card (see Wording). Or never in the text, with a quiet stamp instead?
2. **A plain cohort note with no anchor?** "One of 11 pitchers with a shutout" stands alone.
3. **How many anchor notes per card?** Inference: one, so the joke does not repeat.
4. **Tone.** Moon, Supreme Court and Great Lakes are fine. Is a joke about the Dolphins fine
   for another club's fans?
5. **Volatile anchors.** Allow with the 180-day expiry, or never?
6. **MiLB.** The cohort file is MLB only. The bundle simply lacks the key and the note never fires.

## Out of scope

All-time cohorts and "first ever" claims (they need Retrosheet or Stathead). Result-aware wording.
A new screen. Any anchor that is not in the registry.

## Sources for the research behind this

All checked 2026-11-03. See `anchors.seed.json` for each anchor's URL. The MLB.com facts that
reached this note (Chourio, Misiorowski, Pratt records) were read through search results only,
because MLB.com blocked the fetch tool; none of them is used in a count here.
