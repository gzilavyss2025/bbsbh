# Shape: the at-bat console for a #22 scorebook (#1389)

Status: DRAFT spec from a shape session, 2026-10-07. Nothing is built. Read with
`.scratch/innings-console-redesign/README.md` (the agreed design, "the handoff").

## 1. The goal, in Gary's words (from #1389)

> The innings viewer's focus mode (ADR-0043) is the screen Gary scores from for three
> hours: tap **Next at-bat**, read, pencil the play into a **Numbers Game #22
> scorebook**, tap again. Today that screen does not carry everything a #22 box needs,
> in the form it is penciled.

Rule that drives every slice (handoff §1): the scorer must be able to fill out a #22
box from this screen alone.

## 2. What exists, and what blocks it

- **The design is agreed.** Five rounds with Gary (2026-10-01 and 10-02); version 5 of
  the canvas is final. The handoff holds the screen (§4), Gary's rules (§5), the data
  recipe (§7), the spoiler checklist (§8) and the file map (§9). The mockup builder
  in `.scratch/innings-console-redesign/mockup/` still builds today from live feeds.
- **Not parked.** Roadmap #1198 lists #1389 under "Needs info", not "Parked".
- **No open PR touches the innings viewer** (open PRs on 2026-10-07: #1665, #1666,
  #1667). Notice N6 to N9, which the roadmap said must go one at a time through the
  innings viewer, are on `main` (`1041d9d4`, stack #1661).
- **The one blocker is the `needs-info` label: three notation rulings** (issue
  "Decide before building"). They gate only the last slice (S8); S1 to S7 can start
  without them.
- Today's screen (`mockups/today-823166-bot1.jpg`, live app, 823166 bottom 1st):
  "Rest of half" is beside "Next at-bat"; the batter reads "3. BERICOTO" (bare slot,
  rule 4); the batter is named in the band and again in the card. This matches the
  issue's list.

Code facts behind the three rulings:

| Ruling | Today's code | Source |
|---|---|---|
| Pickoff mark | `PK` | `src/api/playbyplay/advanceCode.js:88` and `:183` |
| Pickoff caught stealing | collapsed to `PK` ("includes pickoff_caught_stealing") | same lines |
| E after a steal | slot credited unless `eventType` is in `NO_SLOT_CREDIT_EVENT_TYPES`; `error` is not | `halfInningFeed.js:814`, `eventTypes.js:58` |
| Pitch label for WP/BK/PB | `runnerPitchLabel` returns `null` | `runnerNotes.js:38` |

Inference (not verified against more games): adding `error` to
`NO_SLOT_CREDIT_EVENT_TYPES` is the wrong fix, because an error on a batted ball
should credit the batter's slot. The narrower rule is "a runner move that comes from
a mid-at-bat event (no PA) credits no slot".

## 3. What a #22 box needs per at-bat

From the issue and the handoff §4 to §6. Items marked **[assumption]** are not
written in the issue; I took them from the handoff.

1. Batter: batting slot as an ordinal, position, uniform # (one place only).
2. Outcome code and the fielding chain (`GO 6-3`, `FC 6-2`), the out number, RBI.
3. The ball/strike strip as pitch numbers and X (no letters, no shapes).
4. Each runner's path on his own box, with the mark for how he moved: `SB`, `CS 2-6`,
   `PK`/`PO`, `BK`, `WP`, `PB`, `DI`, `E#`, code + batter slot for a batted-ball
   advance.
5. Pitching change and pinch hitter: the # for the red rule; pinch runner: `PR` + #;
   automatic runner `AR` (unearned run).
6. Half foot row: R H E LOB, then P WH FO. **[assumption]** WH = whiffs and FO =
   foul-outs per the handoff; the issue does not spell them out.
7. ABS and manager challenges with the result. **[assumption]** Gary pencils these;
   the issue lists the review card but not how he marks it on paper.

## 4. The options (screenshots in `mockups/`)

The design is fixed, so the options are the three open rulings. Each image renders
the agreed canvas at 390px from live feeds through the app's own modules; only the
three marks differ.

| | Pickoff | Pickoff caught stealing | E right after a steal |
|---|---|---|---|
| **A, app today** (`option-A.jpg`) | `PK 1-3` | shown as `PK 1-3`, out at 1st | `E2³` (batter's slot) |
| **B, review's pick** (`option-B.jpg`) | `PK 1-3` | `PKCS 1-3`, out on the path to 2nd | `E2` (no slot) |
| **C, classic** (`option-C.jpg`) | `PO 1-3` | `POCS 1-3`, out on the path to 2nd | `E2` (no slot) |

`marks-close-up.jpg` puts the three runner boxes side by side for A, B and C.

Moments: 823166 bottom 1st (Cox: SB then E2 on the same throw), 823166 bottom 4th
(Whitcomb picked off 1-3), 824951 top 1st (Neto picked off and caught stealing 2nd).

**Recommendation: B.** `PK` keeps the app's reason (PO also means putout and
pop-out); `PKCS` keeps the out on the right leg; `E2` with no slot stops a steal
looking like the batter's doing. Mixing is fine (for example C's `PO` with B's rest).

What was mocked: the B and C marks are a patch on the canvas data
(`tools/variants.mjs`; `tools/shoot.mjs` and `tools/today.mjs` took the shots), not app code. For Neto the feed credits only the first
baseman ("1-3"); putting the out on the 1st-to-2nd leg follows the feed sentence
"caught stealing 2nd base". That is inference. Also seen: at 1.05× the `PK 1-3`
label at 1st is clipped by the box's right strip (all options, canvas port of
`PlayDiamond`); S4 should check the app does not do the same.

## 5. Slices (each at most 5 files)

Order follows the handoff §9. Each slice is one PR, "Part of #1389". S1 goes first
because it removes the accidental-spoil control.

| # | Slice | Files (max 5) | Pattern to follow | Done test | Model |
|---|---|---|---|---|---|
| S1 | Bar + band trims + linescore fit: drop "Rest of half", one centered Next, "41 PITCHES", no "No outs", E column fits at 390px | `inning/focus/FocusControls.jsx`, `inning/InningActionBar.jsx`, `styles/focus/stage.css`, `gamehud/RollingLine.jsx`, `e2e/reveal-hit-area.spec.js` (+ `inning-modal-stacking.spec.js` if needed; split off if over 5) | ADR-0043 console bar; keep the specs' hit-area assertions | No "Rest of half" in DOM at 390px; RollingLine's 12 columns inside 390px (screenshot); `npm test` green | Sonnet 5.5, medium |
| S2 | Names, ordinals, day lines (batter and pitcher, revealed steps only) | `playbyplay/AtBatHero.jsx`, new pure `api/playbyplay/dayLine.js`, its test, `spoiler-manifest.json`, `src/api/CLAUDE.md` | reveal-only module called inside `SealBox` (ADR-0001); `computeHalfInningFeed` stepCap | Unit test: day line at step k counts only steps < k; batter named once on screen | Opus 5.5, high (new reveal-only read) |
| S3 | Pitch track: numbers and X, kraft flags (SB CS PK BK WP PB DI E), ABS rings | `scoring/PitchLadder.jsx`, `api/playbyplay/pitchInfo.js`, `runnerNotes.js` (WP/BK/PB labels), test, `styles/focus/atbat.css` | `pitchLadder()`; ADR-0046 fixed-height sealed track | Unit test: `runnerPitchLabel('wild_pitch', 2)` returns "Pitch 2" (fails today); no letter strings | Sonnet 5.5, high |
| S4 | Bases strip: runner boxes 3rd·2nd·1st, departed for one step, folds when empty | new `inning/focus/BasesStrip.jsx`, `api/expresslane/runners.js` (reuse `expressDeck`), `styles/focus/bases.css`, `HalfInning.jsx` mount, test | Express Lane deck (`77c-express-lane-deck.css`); ADR-0072 (box at current cap, never cap+1) | Unit test: runners at step k match `runnersOnBase` at cap k; departed only at k | Opus 5.5, high |
| S5 | Notice cards that say what to write (rule #, PR #, AR) | `PitcherNotice.jsx`, `PinchRunNotice.jsx`, `BatterNotice.jsx`, `PlacedRunnerCard.jsx`, `HalfInning.jsx` | existing Notice component (#1132 N1 to N9) | 823035 top 1st and the PH/PR moments render the "write" line | Sonnet 5.5, medium |
| S6 | Pitches sheet: zone with one-at-a-time replay | `scoring/StrikeZone.jsx`, `inning/focus/ReferencePanel.jsx`, `styles/focus/reference.css` | `lib/zone/zoneGeometry.js`; reduced-motion off switch | Sheet opens from the track; Replay re-runs; no animation under reduced motion | Sonnet 5.5, medium |
| S7 | Review card (manager / crew chief) + ABS bank pips, revealed only | new `api/playbyplay/reviews.js` + test, `gamehud/ConsoleBand.jsx`, `AtBatHero.jsx`, `spoiler-manifest.json` | `challenges.js`, but NOT `gameData.absChallenges` (whole-game, leaks) | Unit test: bank at step k ignores challenges after k (824546, 823169) | Opus 5.5, high |
| S8 | The three notation rulings (this shape session's options) | `advanceCode.js`, `halfInningFeed.js`, `eventTypes.js` or a new set, test, `docs/adr/0043` amendment | the existing `legAdvanceCode` / `runnerOutCode` tests | Test that fails first: 823166 bot 1st Cox's leg to 3rd has `slot: null`; 824951 Neto reads the chosen PKCS mark | Sonnet 5.5, high |

Close-out (in S8's PR, handoff §12): ADR-0043 amendment, Gary's rules into
`src/CLAUDE.md`, the six games into `docs/test-games.md`, feed gotchas into module
headers, delete `.scratch/innings-console-redesign/` and this folder.

## 6. Out of scope

- `/scorecard` on a phone (#724). It shares the reveal cursor (ADR-0016); keep the
  two in agreement, do not change it here.
- Any new data source, any server function, any stored score.
- The "Today" view of a live game's half still being played (ADR-0055 stays as is).
- Running `npm run e2e` (Gary's rule). S1 changes the specs; Gary runs them.

## 7. ADRs

ADR-0001 (reveal-only modules, lazy), ADR-0002 (SealBox render function, re-seal by
key), ADR-0016 (at-bat stepping over `revealedThrough`), ADR-0043 (focus mode console;
needs the amendment), ADR-0046 (no layout that depends on the hidden at-bat),
ADR-0055 (live half), ADR-0072 (a runner's box at the current cap).

## 8. Spoiler-rule impact

The rule does not change. Every new value on this screen (day lines, ABS bank, review
cards, runner boxes, mid-at-bat moves, pitch flags) is computed only from at-bats
already revealed, inside the `SealBox` reveal function, and never from the at-bat
behind "? Next". The sealed screen keeps the same height and shape whatever the next
at-bat holds, and the Next button reads the same whether or not it ends the half. The
one change that makes spoiling harder: "Rest of half" goes away, so one stray tap can
no longer open a whole half. The whole-game ABS counts in `gameData.absChallenges`
must not be used, because they include challenges the reader has not reached.

Mockup note: the canvas is a static page that embeds each game's data in a script
variable and draws only the revealed steps. That is fine for a design study but is
the fetched-then-hidden shape the app forbids; the build must use `SealBox`.
