# Notification cards wear the stamped yellow frame

**Status:** Accepted
**Date:** 2026-10-16
**Issue:** none; Gary's design session of 2026-10-16. Slice 1 of 3.
**Amends:** ADR-0017's frame. Keeps ADR-0017's tiers and ADR-0030.

## Context

ADR-0017 put every mid-inning "something happened" card in one frame. That frame was
the event Notice (`.notice--event`): a 1px edge, a 6px radius, no shadow, and a pale
marker wash. The player page and the report pages now use the stamped look (ADR-0109,
ADR-0112): square corners, a 2px ink edge, a hard ink shadow, and an ink name tab.
The notification cards were the one family still in the old look.

Gary drew the new cards in a private design artifact
(https://claude.ai/artifact/M9LGrHbQ2hjMrbrMu4qBo6). The work has three slices:

1. The frame. This ADR.
2. The card contents: the club mark, the count tag, the photo size, and the copy.
3. The arrival animation.

This slice changes no content.

## Decision

1. **One frame for every notification card.** The actor cards (`PitcherNotice`,
   `BatterNotice`, `FielderNotice`, `PinchRunNotice`), the two handoff cards, the
   event cards (`MoundVisitBar`, `EjectionBar`, `EventCard`, `DelayNotice`), and the
   full Now Pitching card (`PitcherCard`) wear the stamped Card frame
   (`.card--stamped`) with a new `event` tone. `eventCardClass()` in
   `src/lib/design/cardClass.js` names it. A caller passes it where it passed
   `noticeClass({ tone: 'event' })`.
2. **One ground.** The ground is `--surface-stamped-event`, `#F8E3B3`. It is
   `--marker` at 35% over `--paper-2`, worked out once, because the contrast checker
   does not read `color-mix()`. Every card uses it. There are no tier colours, and no
   clay or green variants. Ink on it reads 14.2:1 (`--ink-0`), 11.6:1 (`--ink-1`),
   7.2:1 (`--ink-2`) and 4.58:1 (graphite, `--text-caption`). The pairs are in
   `src/lib/design/contrastPairings.js`.
3. **A name tab on every card.** The tab is `.card__name`. It is the card heading, so
   an `<h4>` (the half has an `h3`). It holds the words the card already had as its
   label: "Now pitching for the Brewers", "Departing", "Mound visit — Brewers". The
   event cards had only a code (SB, EJ, DELAY) and no label. They get a tab name:
   "Stolen base", "Ejection", "Delay". The code stays in the row until slice 2.
4. **Room.** A parent leaves 34px above a card: the tab hangs 14px, the shadow is
   4px, and the rest is air. `.card--event` carries that margin. A `.change` row has
   28px above its body (24px on a mound visit) and 16px around it.
5. **What stays.** `.notice--event` stays for its other users (the postponed strip).
   The scorecard lens's arm button stays on the Notice frame: it is its own element,
   and the lens is outside this family. No class is renamed (ADR-0084's rename is a
   separate job). No card changes its copy, its photo size, or its place.

## What does not change

- **The spoiler rule.** No gate, `SealBox`, `revealedThrough` read, or reveal-only
  import moves. `C4_SEAL` in `test/card-cascade.test.js` passes unchanged.
- **ADR-0030.** The frame wears no club colour. The full card's name band still wears
  the pitching club's colours, as ADR-0030's 2026-10-14 addendum says. That band
  names the club.
- **ADR-0083.** The frame reads no `--seal` token. A marker never means sealed.
- **ADR-0017's tiers.** Three tiers, one card family, no accent rail. The tiers are
  still told apart by what is inside the card.

## Consequences

- Tests that pinned the Notice frame on these cards (`card-cascade`, `notice-n6`,
  `notice-n7`, `notice-n8b`, `notice-n8c`, `notice-n9`) now pin the new frame. That is
  a real change of behaviour, not a looser test. `event-card-frame.test.js` pins the
  token, the pairs, the class list, the callers, the tabs, and the room.
- `.change__label` and `.pcard`'s own frame rules are gone: the Card draws the frame.
- A long actor label ("Now playing center field for the Dodgers") wraps to two lines
  in the tab at 390px. Slice 2 moves the club to a mark and shortens the tab.
- The tab moves with the card: it is part of the card, so a card that hides, hides
  its tab.

## Slice 2: the contents (2026-10-16)

The tab names the event only ("Now batting", "Stolen base", "Injury delay"); the team name
left the card text and a 36px club logo (32px on a baserunning card) ends the row, with the
team name as its alt text. The SB, CS, WP, PB, BK, DELAY and EJ chips are no longer drawn
(`EVENT_CODES` stays for the trail and the scorebook). Actor and handoff cards share
`ActorHead`: a 56x68 photo, a 28px "Last, First" name and a badge row (jersey, hand, a filled
PR); the pinch runner's second line reads "For Andrew Vaughn at 1st base". The mound visit is
the club name, five 18px pips and the logo, with the count tag "N left" (no pips and no tag
for the trip that pulled the pitcher). An ejection shows the ejected person at 72x88 from
`entry.playerId`, and a delay's tab is its headline with one sentence ("Cal Quantrill leaves
the game." or "Play stopped for 1 hr 47 min."). "Pitch N" moved to the count tag, and the
handoff table scrolls in the Table's own wrap with the pitcher column pinned. No fetch and no
fetch was added. The ejection's club is the one the player's boxscore roster names; a manager is in no roster, so he falls back to the sentence's leading club name.
The full Now Pitching card draws the logo on its club band, as the artifact does; the persistent header (`entering`) draws none.
Tests that pinned the old text and markup changed on purpose: `event-card-frame` (tabs now
live in `ActorHead`), `notice-n6` (the bar's gap is 12px), `notice-n8a` (the photo class),
`notice-n8b` (the code, team mark, spacer, count and pitch-number parts are gone) and
`table-cascade` (the handoff table is sticky).

A baserunning card's logo is the club of the person in its photo, read off the boxscore roster
(`playerClubId`); a person in no roster gets the club his photo already falls back to. A balk's pitcher therefore wears
his own club's logo, as the artifact's balk does.

## Slice 3: the arrival and the repeat (2026-10-16)

**The arrival.** A card with data to fetch is the plain yellow card until the data is in; then a
band wipes across its top (380 ms, `--ease-stamp`), its tab fades, the head makes room (28 px to 47 px)
and the sections unfold at 380, 435 and 490 ms. `docs/motion.md`, "The arrival", has the full table.
It applies to the full Now Pitching card (the band is the club's triad, `bandPaint`; a club with
none keeps the house navy) and to `DepartureLineCard` and `FinalizedLineCard` (always the house navy,
the table unfolds at 380 ms). The band is `.sectionhead--band`, so its texture is the section head's
and no gradient is copied. It plays only for data that arrives while the card is on screen
(`useBecameTrue`, `useArrival`); a card with its data in hand draws final. Timing depends on the fetch,
never on the game (ADR-0046). `PitcherCard`'s `after` hands the departing arm's card the same state,
so the two arrive together.

**The repeat.** In the focus window the "Pitching" reminder at the head of the next at-bat is the full
card (`ReliefRepeat` is deleted), with the "Before this at-bat" tag above it. It is the same branch of
`PlayByPlay.jsx` as the original, with no handoff line. It asks for nothing: `lib/pitcherCard/cardData.js`
keeps the finished answer (season line, last game, arsenal, career) by arm, season, level, game type,
date and game number. Once the first card has loaded, the repeat reads it on its first render and is
drawn final. A reader who opens the window directly, with no first card, makes the repeat the first
asker: it fetches and plays the arrival like any card. Two cards that ask while the first request is
in flight share the one request. A failed read, or one that lost the arsenal shard, is not kept.
**ADR-0030's 2026-10-14 addendum now covers the repeat card**: it names the same club, so its band
wears the same triad, from the same two inputs, `(teamId, treatment)`.

**The pitch scene and mix.** Scene lines, end rings and trail are the pitch's mark colour
(`pitchMark(code).color`, the colour of its tile), never the family colours. A scene pitch carries
its own `color`, because the at-bat replay's scene `code` is "FF-3" and not a pitch code. The
faint lines are 1.8 wide at 0.8 opacity, the end rings 1.6 at 0.85, and every arc has a 0.7px dark
edge. The ball keeps its cream face and ink outline, as in the artifact. The "Other" tile is gone:
`pitchTiles` returns no tile for a pitch under 3%, and does not renormalise, so the kept tiles read
as they did and the tiles add to 100 less the folded share. The lineup page's pitch card and the
Scout read the same `pitchTiles` and lose the tile too. `test/pitcher-card-model.test.js` changed
on purpose for this.

**Two follow-ups in the same slice.** The full card's stat labels and its three bands ("Postseason",
"Pitch mix", "Last appearance") painted `--surface-card` and `--surface-inset`, which read as white on
the yellow ground; they paint no ground now, so the event yellow shows through (the departure card's
table strip keeps its paper ground, as the design draws it). "Before this at-bat" is an inked tag in
the count tag's face, for every repeated notice.

**What does not change.** No gate, `SealBox`, `revealedThrough` read or reveal-only import moves;
`C4_SEAL` passes unchanged. Nothing here reads a score. Tests: `card-arrival.test.js` pins the band's
paint, the gate, the shared answer, the scene colours, the times and the reduced-motion state; the
frame tests that pinned the old markup (`notice-n6`, `notice-n7`, `notice-n8c`, `table-cascade`,
`event-card-frame`, `pinch-hitter-notice`) changed on purpose.
