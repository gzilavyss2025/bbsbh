# src/components/playbyplay — notification cards, casing, color, button copy (ADR-0017)

Every mid-inning "something happened" moment in `PlayByPlay.jsx` sorts into one
of three tiers — a fresh/changed actor (`PitcherNotice`/`FielderNotice`/
`PinchRunNotice`/`BatterNotice` — a mid-inning pinch hitter gets the same "now
batting" notice the pre-pitch staged list shows, for symmetry with every other
substitution type), a team/administrative event (mound visit, ejection), or a
baserunning/misc event with no plate appearance of its own (steal, wild pitch,
balk, …) — and all three render in the *same* marker-wash card (the event
Notice frame, `noticeClass({ tone: 'event' })`; an actor card's CALLER passes it, with
`.pitchernotice--pbp` as the margin namespace, since `PitcherNotice` is also the bare
header inside the full card), distinguished by what's inside (a
headshot vs. a scorer's-shorthand code) rather than a colored accent rail.
Read ADR-0017 before touching any of `PlayByPlay.jsx`'s notification
components, `MoundVisitBar` (in `EventCards.jsx`), or `HalfInning.jsx`'s
`PrePitchChanges` — it also covers the `--accent-positive`/`--accent-negative`
color pairing, and the button/label conventions (chevron vs. destination-named
link, "Reveal" always visible, accessible name contains the visible word).

## The files

`DelayNotice` (a function in `EventCards.jsx`) cards a stoppage only when it came to
something, and names the man who left rather than the batter the feed names (ADR-0060).

**`pitcherCard/`** (`PitcherCard`, `SeasonLines`, `PitchMix`, `PitchScene`,
`LastAppearance`) is the FULL Now Pitching card (#1344): only where an arm takes the
mound — `HalfInning`'s card at `isFreshPitcher` and `PlayByPlay`'s mid-half
`pitching_substitution` card; the persistent header and `ReliefRepeat` stay
`PitcherNotice` alone. Its stat lines end the day before the game (ADR-0088). The pure
model (role rule, tiles, scene math) is `lib/pitcherCard/`, so `npm test` can pin it.
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
(scene, picks, button) exists at an untracked park or under reduced motion — the zone plot and list stay.
