# src/components/playbyplay — notification cards, casing, color, button copy (ADR-0017)

The at-bat feed that drew these cards (`PlayByPlay.jsx`, with `EventCards`, `BatterNotice`,
`FielderNotice`, `PinchRunNotice`, `PitcherHandoffCard`, `AtBatHero`, `AtBatReplay` and the
`dueup/` cards) was deleted with the hidden half page (#2747); Gameday draws these moments in its
own shell (`src/screens/gameday/next/`). What stays is `PitcherNotice` (the header row inside the
full card), `cardCopy.js` (the words, `EVENT_CODES` and the tab names; pure, pinned by
`test/card-copy.test.js`), `CalloutNote`, `HighlightSheet` and `pitcherCard/`.

A card's frame is the stamped event card, `eventCardClass()` in `lib/design/cardClass.js` (square
corners, 2px ink edge, hard shadow, one `--surface-stamped-event` ground, an ink name tab; ADR-0113,
which amends ADR-0017's frame and keeps ADR-0030). A CALLER passes it, with `.change--framed` as the
namespace, since `PitcherNotice` is also the header row inside the full card; the card's root class is `.change`, ADR-0084. The tabs are the cards' headings (`<h4 className="card__name">`). Read ADR-0017
and ADR-0113 before touching a notification card — they also cover the `--accent-positive`/
`--accent-negative` color pairing and the button/label conventions (chevron vs. destination-named
link, "Reveal" always visible, accessible name contains the visible word).

## The files

**`pitcherCard/`** (`PitcherCard`, `Arrival`, `SeasonLines`, `PitchMix`, `PitchScene`,
`LastAppearance`) is the FULL Now Pitching card (#1344): only where an arm takes the
mound — the lens's `PitcherSheet` and Gameday's panels; the persistent header with no fresh arm stays
`PitcherNotice` alone. Its stat lines end the day before the game (ADR-0088). The pure
model (role rule, tiles, scene math) is `lib/pitcherCard/`, so `npm test` can pin it. **No "Other"
tile:** a pitch under 3% gets no tile, and the other percents are not renormalised
(`pitchTiles`). **Scene colour:** every line, ring and trail is the pitch's own `color`
(`pitchMark(code).color`, set by `scenePitches`, `atBatScenePitches` and the Scout modal), never a
family colour; every arc has a thin dark edge.
**The arrival (ADR-0113, slice 3).** The full card
starts as the plain yellow card and gains a band when its data is in: `useArrival(open)`
(`hooks/motion/useArrival.js`) gives the card its `arrival is-in arrival--play` classes, `CardBand` and
`Unfold` (`pitcherCard/Arrival.jsx`) are the parts, `styles/pitcher-card/arrival.css` is the resting
look and `styles/motion/arrival.css` the motion (`docs/motion.md`). The band is `.sectionhead--band`
(the club's triad through `bandPaint`, else the house navy). The answer is `cardData` (`lib/pitcherCard/cardData.js`), kept by arm and game.
`PitchScene` draws through refs from a rAF loop — never React state per frame — stops off
screen, and stays still under reduced motion.

The pure models behind the deleted at-bat replay (`lib/pitcherCard/atBat.js`, `replaySteps.js`,
`sideWall.js`, `contactDraw.js`, `quality.js`) keep their tests; `docs/contact-replay.md` is the design.
