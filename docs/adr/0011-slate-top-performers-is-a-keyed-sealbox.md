# The slate's Top Performers box is a non-per-inning SealBox, keyed on date+level

`TopPerformersBox` (`src/components/TopPerformersBox.jsx`) shows the day's top
5 batters and top 5 pitchers by win-probability added, across every
in-progress/final game at the current level — one box per (date, level) on
the `GameSelect` slate. WPA is heavily spoiler-bearing (see
`docs/data-enrichment.md`: "the WP curve IS the game story"), so this is
squarely the kind of content ADR-0001/ADR-0002 already govern, just applied
somewhere other than a per-half-inning `SealBox`.

Every previous `SealBox` use re-seals via a parent remounting with
`key={inning}` or similar — a natural fit where the parent already tracks a
navigable unit. The slate has no such unit for "the day's top performers," so
`TopPerformersBox` supplies its own key, `` `${dateStr}-${sportId}` ``, tying
reseal directly to the two dimensions this box is actually scoped by.
Switching the date or the level (`LevelNav`) therefore remounts the
`SealBox` and re-seals it, exactly like navigating between innings does —
no new reveal/reseal mechanism, just a different key source.

The WPA fan-out itself (`computeTopPerformers`, `src/api/topPerformers.js`)
follows ADR-0001 the same way `computeThreeStars` does: it's only ever
invoked from inside the `SealBox`'s reveal render function, via a panel
component that mounts (and fetches) exclusively after reveal — mirroring
`GameBuzz.jsx`'s "own lazy `useAsync` fetch mounted only after reveal"
pattern, so no per-game boxscore/win-probability request fires until the
user taps to reveal.
