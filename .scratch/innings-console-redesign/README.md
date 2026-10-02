# Innings console redesign — handoff

Status: design agreed with Gary over five rounds on 2026-10-01 and 2026-10-02.
Nothing is built in the app yet. The GitHub issue that tracks the build links here.

This folder holds everything the design session learned, so an agent can build
it without the session. Read this file first, then open the design canvas.

## 1. What this is

The innings viewer's focus mode (ADR-0043) is the screen a hand scorer uses for
three hours. The scorer taps **Next at-bat**, reads the result, pencils it into a
**Numbers Game #22 scorebook**, and taps again. This redesign keeps that loop. It
changes what the screen shows, so that every mark on the paper can be copied from
the screen.

The one rule that drove every decision: **the scorer must be able to fill out a
#22 box from this screen alone.**

## 2. The design canvas

- **Live canvas (private to Gary):** https://claude.ai/artifact/EaATo3vrecodgQTdWcSRF1
  Version 1 holds the round-1 studies (A–D). Version 5 is the agreed design (H).
  An agent on Gary's account can read it with the Artifact tool (`action: "read"`).
- **Source, in this folder:** `mockup/template.html` is the canvas page.
  `mockup/build-data.mjs` builds its data. `mockup/build-page.mjs` joins the two.
  `mockup/today-390.jpg` is today's screen at 390px, used as the baseline.

Rebuild the canvas from the repo root:

```bash
node .scratch/innings-console-redesign/mockup/build-data.mjs
node .scratch/innings-console-redesign/mockup/build-page.mjs
# open node_modules/.cache/innings-console/innings-console-studies.html
```

The data build runs the **app's own modules** over real feeds:
`computeHalfInningFeed`, `expressDeck`, `runnersOnBase`, `lineupEntering`,
`defenseEntering`, `pitchLadder`, `classifyOut`, `scorecardCenterCode`, and
`atBatMarks` (copied out of `AtBatBox.jsx` at run time, because Node cannot import
JSX). The canvas ports `AtBatBox` and `PlayDiamond` line for line. So a mark in the
canvas is the mark the app draws today.

Canvas controls: game picker, half picker, Space (next at-bat), ← (step back,
canvas only), `[` `]` (half), L / F / P (Lineups / Field / Pitches sheet). The
side panel lists "Jump to" moments for every edge case in the chosen game.

## 3. Test games

| gamePk | Game | What it exercises |
|---|---|---|
| 823035 | MIL @ STL, 2026-07-07, game 2 | Pitching changes, pinch hitter, pinch runner (PR mark), defensive switches, mound visits; ABS overturned (top 1st, Lara) |
| 823166 | MIN @ SF, 2026-09-22 | SB then E2 on the same throw (bot 1st), pickoff 1-3 (bot 4th), CS 2-6 (top 7th), K + wild pitch reach (bot 3rd); ABS by both clubs |
| 824546 | DET @ CWS, 2026-09-20 | Balk then wild pitch on the next pitch (bot 6th), passed ball, SB, CS 2-4; ABS by both clubs, overturned and upheld |
| 824624 | MIA @ CHC, 2026-09-22 | Manager challenges by both clubs (tag play, play at 1st); a pickoff that ends the 3rd mid at-bat (`interrupted`, "PK →"), overturned on review; 12 innings with automatic runners |
| 824951 | LAA @ ATH, 2026-09-23 | Pickoff caught stealing (`PKCS`), forced balk, a manager challenge DURING an at-bat (tag on a CS, upheld) |
| 823169 | MIN @ SF, 2026-09-21 | Crew-chief home run review, upheld; several ABS overturns |

## 4. The agreed screen (390 × 844, top to bottom)

1. **Header, one row.** Club mark, both club marks, "MIL @ STL", date, ‹ half ›.
   It replaces the logo tiles, MLB.tv chip and section tabs while scoring (about
   170px saved).
2. **Console band (navy).** Score rows with each club's **ABS bank** as two pips.
   The inning number with ▲/▼ centered above it. Bases diamond and three out
   circles. One right-aligned line: **"41 PITCHES"** (the current pitcher's count).
   No batter name and no "No outs" text here. At half close this line becomes the
   #22 foot row: **R H E LOB | P WH FO**.
3. **Notice cards** (only when something changed before the next pitch; no
   section heading). Each one says what to write:
   - Pitching change: "#59 · RHP. Rule across the top of the next box: **59**".
   - Pinch hitter: "Bats 7th · #11. Rule down the left of this box: **11**".
   - Pinch runner: "Mark **PR 5** by 1st on Bauers's box."
   - Automatic runner: "Write **AR** in his box and dot the path to 2nd. His run is unearned."
   - Defensive switch, defensive substitution, mound visit: one quiet line.
   - First at-bat of a half with no change: a "Now pitching" card (name, #, hand;
     "First pitch of his day" only when true, because the band has the count).
4. **Trail.** One tile per revealed at-bat: code, last name, circled out number.
   The next at-bat is a kraft tile reading "? / Next". No batting slots on tiles.
5. **At-bat card.**
   - Left: the batter's **#22 box**, the app's `AtBatBox` at 1.3× (outcome box,
     RBI box, diamond with fielding chain, out circle, ball/strike strip,
     end-of-half slash, red handover rules for a pitching change or pinch hitter).
     Before the first tap of a half it is a kraft seal that reads only "Sealed".
   - Right: headshot, **name (the only place the batter is named)**,
     "Bats 2nd · C · #8", then **Today: 0-1, K**. Below it: "vs Melton #52 · RHP",
     "N pitches this at-bat", then **Today: 2.0 IP, 2 H, 1 R, 1 BB, 2 K · 41 P**.
6. **Bases strip.** Three slots in field order: 3rd, 2nd, 1st.
   - Occupied: that runner's own #22 box (`AtBatBox`, 1.05×) labeled "Peck /
     9th · on 2nd". A kraft ring if he moved during this at-bat.
   - Empty: a small dashed base glyph with "2nd".
   - The batter's own base: a kraft glyph reading "1st / batter" (his box is above).
   - Departed on this play: at the left for ONE step, ringed green ("scored") or
     red ("out at 2nd"), so the run or out can be marked. At the third out the
     runners read "left on 2nd".
   - Nobody on and nobody departed: the strip folds to one line, "◇ ◇ ◇ Bases empty".
7. **Pitch track** (a button; a tap opens the Pitches sheet). The #22 strip on its
   side: a BALLS lane and a STRIKES lane, one column per pitch in order.
   - **Each pip is only the pitch number, or X for the ball in play.** No shapes,
     no colour coding, no legend. Gary: "I just do numbers of the sequence for
     the pitches and then an X if a ball is in play."
   - The count after each pitch, in small type under the column.
   - A kraft flag between columns where a runner event happened (SB, CS, PK, BK,
     WP, PB, DI, E#), and a line per event: "Pitch 1 · Vargas BK 1st → 2nd".
   - An ABS-challenged pitch gets a ring (green overturned, red stands) and a line:
     "Torres (DET) challenged a called strike. Overturned to ball."
   - A challenge during the at-bat goes on its event line ("· SF challenged (tag
     play): upheld").
   - Foot: "This at-bat · 6 P · 1 WH · 1 FO" and the half so far.
   - Sealed: the two empty lanes only. No caption text.
8. **Review card** (when the play itself was reviewed), then the play sentence
   with the "X challenged (...), call on the field was ...:" prefix stripped, then
   one quiet batted-ball line (EV, LA, distance, trajectory).
9. **Reference chips:** Lineups · Field · Pitches. Each opens a bottom sheet with
   the three as tabs.
   - **Lineups:** both clubs as they stood entering the half (`lineupEntering`);
     the next batter's row highlighted; subs in red with "in 6th", replaced names
     struck through.
   - **Field:** the defense on a diamond (`defenseEntering`), new names in red.
   - **Pitches:** the strike zone from the broadcast camera, with the app's
     `zoneGeometry.js` projection (x mirrored, plate half-width 0.708 ft, 3×3
     grid, the batter's median zone). Pitches **fly in one at a time** in order
     (about 650 ms apart), the list beside them lights up in step, and **Replay**
     runs it again. ABS pitches are ringed.
10. **Running line** (`RollingLine`), demoted, fixed so all 12 columns fit at 390px.
11. **Bar: one full-width "Next at-bat" button, text centered.** At half close it
    becomes "Bottom 3rd ›". **No "Rest of half"**: Gary taps it by accident and it
    spoils the half.

## 5. Rules Gary set (do not regress these)

1. Every #22 field is on screen in the form it is penciled.
2. No Retrosheet letter strings (`B C C B F X`) anywhere.
3. Pitch marks are sequence numbers and X. Nothing on a pip for called, swinging or foul.
4. Name the batter once. A batting slot is always an ordinal ("Bats 2nd", "9th").
   A uniform number always has "#". A bare "2" next to a name is ambiguous.
5. No "Rest of half" control.
6. No lined index-card look.
7. Remove words the visuals already say ("No outs" beside the out circles,
   "Before the next pitch", "The pitches open with the at-bat", a pitch count
   repeated in three places).

## 6. Runner notation (from the app; confirm the open ones with Gary)

| Event | Mark | Status |
|---|---|---|
| Stolen base | `SB` at the base reached, no slot | app today |
| Caught stealing | `CS 2-6`, red tick on the path, out circled | app today |
| Pickoff | `PK 1-3` | app today; **open: PK vs PO** (the app chose PK because PO also means putout and pop-out) |
| Pickoff caught stealing | `PKCS 1-3-6` | **open:** the app collapses it to `PK` today (`runnerOutCode`); the review recommends adding it |
| Balk / WP / PB / DI | `BK` `WP` `PB` `DI`, no slot | app today |
| Advanced by the batter | code + superscript slot: `1B⁴`, `GO⁵` | app today (some scorers write the slot alone) |
| Scored | solid diamond; red outline if unearned; RBI in the batter's box | app today |
| Error | `E6` in red | **open:** the E2 after Cox's steal (823166, bot 1st) renders `E2³` with the batter's slot, because `error` is not in `NO_SLOT_CREDIT_EVENT_TYPES` (`advanceCode.js`). Bug or convention? Ask Gary. |
| Left on base | path ends; LOB in the foot row; slash on the box that closed the half | app today |

## 7. Data recipe and gotchas found while building

- `computeHalfInningFeed(feed, inning, half, side, stepCap)` returns an ARRAY of
  entries (`atbat`, `placed`, `event`). `stepCap` is a COUNT OF ENTRIES, events
  included, not a count of at-bats.
- An `event` entry with `midAtBat: true` belongs to the NEXT `atbat` entry. One
  with `midAtBat: false` is pre-pitch (pitching change, PH, PR, switches, mound
  visit). Filter `game_advisory` out of the pre-pitch list.
- Sealed state of at-bat k: cap the feed through the pre-pitch entries before it,
  then `runnersOnBase(entries)` with no exclusion.
- Revealed state: `expressDeck(feed, inning, half, { atBatIndex, isTerminal: true })`
  gives `batter`, `runners` (batter excluded) and `departed` (one step only).
- Mid-at-bat runner moves: `runners[].details.playIndex` indexes `playEvents[]`;
  count the `isPitch` events before it for the pitch number. Exclude the batter's
  own runner entries (otherwise a K + WP reach shows as a runner event).
  `runnerPitchLabel` labels only SB, CS and PK today and returns null for WP, BK
  and PB, so it needs to cover them. The label rule the canvas uses: pickoff →
  "After pitch n" ("Before pitch 1" at n = 0); everything else → "Pitch n".
- Out chain for a runner out: `credits[]` assists, then the putout, by position code.
- **ABS:** the per-pitch `challenge` on `pitchDetails` (from `challengesForPlay`).
  `callDesc` is the FINAL call; when overturned, the original call is the
  opposite. A play-level `MJ` review on the last pitch also counts (ball four).
  Bank: 2 per club, kept on an overturn, spent when the call stands; a club at 0
  gets 1 entering each extra inning. **Count only through the revealed point.**
  The `gameData.absChallenges` counts are whole-game and leak (see `challenges.js`).
- **Manager or crew review:** `play.reviewDetails` with a type other than MJ/MZ.
  `challengeTeamId == null` means a crew-chief review. The description starts
  "Cubs challenged (tag play), call on the field was overturned: …". Parse the
  "what" and the verdict from it, and strip the prefix from the play sentence. A
  review during an at-bat sits on `playEvents[k].reviewDetails`.
- **Interrupted at-bat** (a pickoff or CS ends the half mid-count): the card has
  `codeKind: 'interrupted'`, an empty outcome and "PK →" in the center. It is a
  step, but it is not a plate appearance in the day line.
- **Today's lines** (batter and pitcher) count every earlier half plus this half's
  revealed steps, never further. AB excludes walk, IBB, HBP, SF, SH and CI. IP
  comes from the outs added per step (outs after − outs before). Runs go to
  `runners[].details.responsiblePitcher`, earned from `details.earned`. This is
  in-game state, not a season line, so ADR-0088 does not apply to it.
- `defenseEntering` has no `P` entry, so the Field sheet shows eight positions.

## 8. Spoiler checklist (from the design review; all hold in the canvas)

- Runner boxes are built at the current cap, never cap + 1 (ADR-0072's pattern).
- Mid-at-bat moves, substitutions after pitch 1, reviews and ABS outcomes appear
  only with the reveal of their at-bat.
- The sealed layout does not depend on the hidden at-bat (ADR-0046): the empty
  track has a fixed height, with no placeholder pips and no reserved flag space.
- The Next button reads the same whether or not the next at-bat ends the half.
- The band's pitch count, the ABS bank, the day lines and the half's P/WH/FO run
  only through revealed entries.
- Departed boxes appear only after the reveal, and fall away at the next step.

## 9. Where it lands in the app

| Canvas part | App file(s) today |
|---|---|
| Band | `components/gamehud/ScorebugMount.jsx`, `StatBox.jsx`, `styles/focus/console.css` |
| Notices | `components/inning/HalfInning.jsx` (`PrePitchChanges`), `playbyplay/PitcherNotice.jsx`, `PinchRunNotice.jsx`, `BatterNotice.jsx`, `PlacedRunnerCard.jsx` |
| Trail | `components/inning/focus/AtBatTrail.jsx` |
| At-bat card | `components/playbyplay/AtBatHero.jsx` + `components/scoring/AtBatBox.jsx`, `styles/focus/atbat.css` |
| Bases strip | new; reuse `api/expresslane/runners.js` (`expressDeck`) and `AtBatBox` (Express Lane's deck is the prior art: `styles/77c-express-lane-deck.css`) |
| Pitch track | `components/scoring/PitchLadder.jsx`, `api/playbyplay/pitchInfo.js` |
| Pitches sheet | `components/scoring/StrikeZone.jsx`, `lib/zone/zoneGeometry.js` |
| Lineups / Field sheet | `components/inning/focus/ReferencePanel.jsx`, `RosterPanel.jsx`, `scoring/DefenseDiamond.jsx` |
| Running line | `components/gamehud/RollingLine.jsx` |
| Bar | `components/inning/focus/FocusControls.jsx`, `InningActionBar.jsx`, `styles/focus/stage.css` |

A builder must also handle these:

- Removing "Rest of half" touches `FocusControls.jsx`, `InningActionBar.jsx`,
  `e2e/reveal-hit-area.spec.js` and `e2e/inning-modal-stacking.spec.js`. Change the
  specs to the new bar; do not delete their hit-area assertions (CLAUDE.md test
  discipline). Run e2e only when Gary asks.
- ADR-0043 needs an amendment (the bar, the bases strip, the track, the sheets).
- `spoiler-manifest.json` and `src/api/CLAUDE.md` need updates for any new
  reveal-only reads (day lines, ABS bank, review cards).
- Ship in slices. A suggested order: (1) bar + band trims + linescore fit;
  (2) names, ordinals and day lines; (3) the pitch track as numbers/X with flags
  and ABS rings; (4) the bases strip; (5) notice cards; (6) the Pitches sheet with
  the replay; (7) review cards; (8) PKCS and the E-after-steal mark, once Gary rules.

## 10. Broken things found on the way

- At 390px the running line's E column is cut off at the right edge (visible in
  `mockup/today-390.jpg`).
- `runnerOutCode` collapses pickoff caught stealing to `PK`.
- `runnerPitchLabel` returns null for WP, BK and PB.
- `E2³` after a steal (see §6).

## 11. History

- **Round 1:** four studies: A console tuned, B scorebook box, C night broadcast,
  D card deck. `review-round1.md` has the reviewer's verdict on each change ID.
- **Round 2:** the harmonized design H. Gary: keep #22 fill-in, no letter strings,
  show runner diamonds and mid-at-bat moves, no lined notecard; add notice cards
  and the Lineups / Field rails.
- **Round 3:** pips become numbers and X only; a tap on the track opens an
  animated zone; ABS and manager / crew-chief challenge cases; the bases strip
  folds when empty; the "#22 marks" label goes.
- **Round 4:** name the batter once; ordinals for slots and # for numbers; day
  lines for the batter and the pitcher.
- **Round 5:** remove the sealed caption, "Rest of half", "Before the next pitch",
  "No outs" and the repeated pitch count; "41 PITCHES"; center the Next text;
  center ▲/▼ over the inning number.
