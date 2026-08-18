# ADR-0051 — The hit chart draws only the balls you have reached

Status: accepted (2026-08-18)

## Context

Every ball put in play at an MLB park arrives in the live feed with a landing
coordinate and, at most parks, an exit velocity: `playEvents[].hitData` carries
`coordinates.coordX/coordY`, `launchSpeed`, `launchAngle`, `totalDistance` and
`trajectory`. We already read two of those fields — `derive.js` picks the
hardest-hit ball and the longest ball for the per-half Statcast superlatives.
The coordinates we had never touched.

Plotted on the park's own outline, they are a spray chart: where a club hit the
ball all night, which balls were hits, and — ringing the ones struck at 95 mph
or more — which were hit hard enough that the result was luck. For a
scorekeeper working on paper, that is the shape of the game the scorebook grid
cannot hold.

It is also, unmistakably, score-revealing. A home run dot is a run. A field of
navy dots in the outfield is a rally. This is the first chart we have built
whose every mark is a result, so the question of *where* it may render had to
be settled before any of it was drawn.

Two facts made the answer simpler than it looked. The box score already opens
as **one** seal and stays open (ADR-0049) — a chart placed inside it reveals
nothing the surrounding page has not. And an inning page already knows exactly
how far its reader has got: `revealedThrough`, the high-water half index
(ADR-0022), the same number the pre-pitch selectors clamp against
(ADR-0003/0010).

## Decision

**The hit chart carries no seal of its own. It draws only balls the reader has
already reached, and it is the caller that decides what that means.**

> `src/api/hitchart.js` is a **reveal-only** module (`spoiler-manifest.json`),
> callable only inside a `SealBox` reveal render function or behind an explicit
> reveal gate. `selectBattedBalls(feed, { teamId, throughHalfIndex })` walks
> `allPlays[].playEvents[]` and returns one entry per batted ball. With
> `throughHalfIndex` set it keeps only plays whose `halfIndex(inning, half)` is
> **less than or equal to** that number — not `+ 1`, the way the pre-pitch
> selectors clamp, because a batted ball *is* the result rather than the staging
> for one.
>
> The box score calls it with no clamp, from inside the seal it already has.
> An inning page passes the render-time reveal value, so a chart there can never
> run ahead of the pencil — and never needs a second tap to lift.

Three further calls fall out of the data rather than the rule:

> **The projection.** Gameday hit coordinates are pixels in a 250-unit box, not
> feet. `hitCoordToSvg` maps them into the ballpark drawing's own space —
> `(coordX − 125.42) × 2.51` feet toward right field, `(198.27 − coordY) × 2.51`
> toward centre, off `HOME` — where feet already map 1:1 to SVG units. The 2.51
> was fitted, not looked up: across 40 caught fly balls in three games the ratio
> of the feed's own `totalDistance` to the plotted radius has a median of 2.504.
> `test/hitchart.test.js` pins it against a real captured feed, so a feed change
> that silently shifts every dot fails a test instead of shipping.
>
> **A mark sits where the ball was fielded**, not where it stopped. That is what
> the coordinate means, and it is why the readout suppresses `totalDistance` on
> a ground ball — the feed reports the few feet it travelled before a fielder
> reached it, and 5 ft beside 107.7 mph reads as a bug rather than a fact.
>
> **The card hides itself rather than degrading.** No `hitData` (most parks
> below Triple-A send none — `docs/data-enrichment.md`), or a venue the
> ballpark drawing does not know, and `selectBattedBalls` returns an empty array
> and the component renders nothing at all.

## Consequences

1. **No new reveal state.** Nothing is persisted, no seal is added, and the
   spoiler surface of both hosting pages is unchanged. The chart is downstream
   of gates that already existed.

2. **The scope half of the spoiler rule holds.** The chart appears only on the
   two surfaces where you score a game. It does not reach the player page, the
   team hub or any standalone page, where a spray chart would be a season stat
   rather than tonight's result.

3. **One notation, not two.** The batter's mark on the card (`1B`, `F8`, `6-3`,
   `FC`) comes from `playbyplay/scorebookCode.js` — the module the play-by-play
   cards already use. A second spelling of the scorebook's own language would
   have drifted from the first within a season.

4. **`BallparkDiagram` gained `children`.** Plain composition, rendered last
   inside its `<svg>` so a caller's marks sit above the fence. Deliberately not
   a render function: in this codebase a render function means a spoiler gate.

5. **The projection constant is a liability we now watch.** It is empirical, and
   MLB has never documented the coordinate space. The pinning test is the whole
   defence; loosening it to make a future feed change pass would give the
   dots back their ability to drift silently.
