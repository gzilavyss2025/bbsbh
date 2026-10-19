# src/components/playbyplay — notification cards, casing, color, button copy (ADR-0017)

Every mid-inning "something happened" moment in `PlayByPlay.jsx` sorts into one
of three tiers — a fresh/changed actor (`PitcherNotice`/`FielderNotice`/
`PinchRunNotice`/`BatterNotice` — a mid-inning pinch hitter gets the same "now
batting" notice the pre-pitch staged list shows, for symmetry with every other
substitution type), a team/administrative event (mound visit, ejection), or a
baserunning/misc event with no plate appearance of its own (steal, wild pitch,
balk, …) — and all three render in the *same* yellow card (the stamped event card,
`eventCardClass()` in `lib/design/cardClass.js`: square corners, 2px ink edge, hard
shadow, one `--surface-stamped-event` ground, an ink name tab; ADR-0113, which amends
ADR-0017's frame and keeps ADR-0030). An actor card's CALLER passes it, with
`.change--framed` as the namespace, since `PitcherNotice` is also the header row inside
the full card; the card's root class is `.change`, ADR-0084. The tabs are the cards'
headings (`<h4 className="card__name">`). A parent leaves 34px above a card (`.card--event`'s
margin). The cards are distinguished by what's inside, never by a coloured frame or rail.
**The contents (ADR-0113, slice 2).** The tab names the event and the club is a 36px `TeamLogo`
at the row's right end (32px on a baserunning card; no club, no logo). The words are `cardCopy.js`
(pure, pinned by `test/card-copy.test.js`). `ActorHead` (in `PitcherNotice.jsx`) is the one body of
the four actor cards and the two handoff cards: 56x68 photo, a 28px name, a badge row (jersey, hand,
a filled PR). No code chip is drawn; `EVENT_CODES` stays for the trail and the scorebook. An ejection
or delay shows the person's photo at 72x88 (`PitcherPhoto bare large`: no photo, nothing), the mound
visit shows five pips and an "N left" `.card__count` (none when the trip pulled the pitcher), and
"Pitch N" is the count tag. A baserunning or ejection logo is the photo person's club (`playerClubId`, the boxscore roster; a manager falls back to the sentence, or to the photo's own fallback club). The full card (`pcard`) draws the logo on its band; the persistent header (`HalfInning` passes `logo={false}`) does not. `.notice--event` is not this frame: the
postponed strip and the lens arm button keep it.
Read ADR-0017 and ADR-0113 before touching any of `PlayByPlay.jsx`'s notification
components, `MoundVisitBar` (in `EventCards.jsx`), or `HalfInning.jsx`'s
`PrePitchChanges` — it also covers the `--accent-positive`/`--accent-negative`
color pairing, and the button/label conventions (chevron vs. destination-named
link, "Reveal" always visible, accessible name contains the visible word).

**Lead-in repeat.** A managers' notice trails the PREVIOUS at-bat's window (ADR-0016),
so a windowed `PlayByPlay` draws it again at the head of the next window (`windowLeadIn`,
read off the window bounds), in feed order, with a "Before this at-bat" tag (when it happened, not a claim the reader saw it). Each repeat is the same
notice component as the original (`MoundVisitBar`, `BatterNotice`, …), except a pitching
change: the FULL Now Pitching card (`PitcherCard`, labelled "Pitching", ADR-0113 slice 3; it is the
same branch as the original in `PlayByPlay.jsx`, with no handoff line), or `EventNote` when the arm
does not resolve. It reads the answer the first card kept (`cardData` below), so when that card has
loaded it asks the network for nothing and draws arrived, with no motion. A reader who opens the
window directly (the first card never mounted) makes the repeat the first asker: it fetches and
plays the arrival like any card. A standalone play (pickoff, balk) is never repeated.

## The files

`DelayNotice` (a function in `EventCards.jsx`) cards a stoppage only when it came to
something, and names the man who left rather than the batter the feed names (ADR-0060).

**`pitcherCard/`** (`PitcherCard`, `Arrival`, `SeasonLines`, `PitchMix`, `PitchScene`,
`LastAppearance`) is the FULL Now Pitching card (#1344): only where an arm takes the
mound — `HalfInning`'s card at `isFreshPitcher` and `PlayByPlay`'s mid-half
`pitching_substitution` card and its lead-in repeat; the persistent header with no fresh arm stays
`PitcherNotice` alone. Its stat lines end the day before the game (ADR-0088). The pure
model (role rule, tiles, scene math) is `lib/pitcherCard/`, so `npm test` can pin it. **No "Other"
tile:** a pitch under 3% gets no tile, and the other percents are not renormalised
(`pitchTiles`). **Scene colour:** every line, ring and trail is the pitch's own `color`
(`pitchMark(code).color`, set by `scenePitches`, `atBatScenePitches` and the Scout modal), never a
family colour; every arc has a thin dark edge.
**The arrival (ADR-0113, slice 3).** The full card, and `DepartureLineCard` and `FinalizedLineCard`,
start as the plain yellow card and gain a band when their data is in: `useArrival(open)`
(`hooks/motion/useArrival.js`) gives the card its `arrival is-in arrival--play` classes, `CardBand` and
`Unfold` (`pitcherCard/Arrival.jsx`) are the parts, `styles/pitcher-card/arrival.css` is the resting
look and `styles/motion/arrival.css` the motion (`docs/motion.md`). The band is `.sectionhead--band`
(the club's triad through `bandPaint`, else the house navy; the two handoff cards are always house
navy). `PitcherCard`'s `after` renders the departing arm's card beside it and hands it the state, so
the two arrive together. The answer is `cardData` (`lib/pitcherCard/cardData.js`), kept by arm and game.
`PitchScene` draws through refs from a rAF loop — never React state per frame — stops off
screen, and stays still under reduced motion.

**`AtBatReplay`** (same folder) plays the at-bat card's own pitches in that scene, each along its
measured path (`lib/pitcherCard/atBat.js`, from the feed's `vX0..aZ` that `pitchInfo.js` now
carries), in PitchScene's `atBat` look: the projected plate ground, the bar under the art, one pass
then rest. A pick plays one pitch and holds it: the pitch list's dots on wide (`PitchList`'s opt-in
`pick`; hover only with a real mouse), numbered chips in the phone sheet. ONE place at a time: at
`WIDE_QUERY` the top of the focus reference rail, which a revealed card fills by PORTAL (`ReplayRail`:
the rail is outside the seal, so it only lends an empty slot; the last at-bat owns it until a pick
moves it); else a "Replay" button opens `ReplaySheet` — closed, nothing mounts. It sits inside the revealed card, so it is reveal-only like the zone plot, and none of it
(scene, picks, button) exists at an untracked park or for a plate appearance still in progress (`live`) — the zone plot and list stay.

**Tap to play, count and bases (#1858).** The replay rests on the at-bat's end state and plays only on a tap of "Play at-bat", on wide as on a phone (no autoplay). A strip ("2-1", balls and strikes only; the outs stay on the half's header) and a small diamond follow the pitch in view. The model is `lib/pitcherCard/replaySteps.js`: each pitch's count is its OWN event's (`pitchInfo.js` `balls`/`strikes`), steps are keyed by pitch number `no` (the scene drops untracked pitches), and the runners come from the card's `basesBefore`/`basesAfter` (`halfInningFeed.js`, a snapshot per card, so a stacked half shows each at-bat as it was and never as the half ended). The diamond switches to `basesAfter` when the scene's last pitch lands. Under reduced motion the replay stays, at the end state, with no Play button; the chips step it.

**The side view and the quality line (#1771, `docs/contact-replay.md` §7).** `SideView` (under the scene, passed to `PitchScene` as `under`, so the navy bar stays last) and `QualityLine` (last on the card) draw from the replay's one clock: `ReplayScene` holds a `drawers` Set, `PitchScene`'s `onFrame(idx, tau, rest)` calls each, and each adds its draw function in an effect and sets attributes through refs, never React state per frame. The two label rules (apex under the arc in the top 46 units; distance in the axis row past 370 ft) are `apexLabel` and `distanceLabel` in `lib/pitcherCard/contactDraw.js`. Phase B (`ReplayScene`'s `useBatTracking`, `fetchAtBatTracking` in `api/savant/gameFeed.js`): `bat` reaches `PitchScene` through a ref and `QualityLine` as text, so data redraws the rest frame and never replays; figures and verdict rules are `lib/pitcherCard/quality.js` (cutoffs `HARD_LUCK_XBA`, `LUCKY_XBA`). A MiLB game asks nothing and shows exit velocity only. A home run's second ring reads `hr` on the last pitch (`useReplayPitches`, from the entry's `eventType`).
