# The player page (`/player/{id}`)

The player page is **one long scroll**: the hero, the stat tiles, a jump bar and one
section per button. Each section's cards are slots, and **each slot loads its own data
only when it comes near** the screen. The four tab routes (Overview, Stats, Analytics,
History) were replaced by this page in the swap (#1898, ADR-0109). The plan and the
section list are in `docs/player-redesign.md`. The page, its slots and the module
contract are in `src/screens/player/next/CLAUDE.md`.

## The addresses

| Address | Route | What opens |
| --- | --- | --- |
| `/player/{slug-id}` | `player` | `src/screens/player/next/PlayerNextPage.jsx` |
| `/player/{slug-id}/stats` | `player` + `tab: 'stats'` | the same page, scrolled to Season |
| `/player/{slug-id}/analytics[/{year\|all}]` | `player` + `tab: 'analytics'` | the same page, scrolled to Plate approach (a pitcher: Pitches) |
| `/player/{slug-id}/history` | `player` + `tab: 'history'` | the same page, scrolled to History |

The old tab addresses stay valid, so every link that was shared, stamped or bookmarked
still opens the right place. The page scrolls to the tab's section once, when it has
loaded, and holds it there while the slots above it grow, until the reader moves. The
old Analytics season segment and its `?vs=` and `?scope=` are ignored. An old
`?look=new` link opens the page too.

**An unknown third segment resolves to the bare player page.** A link with anything
appended to it must land on the man's page, not fall through to the slate or the
generic 3-segment game route. `test/route.test.js` pins it.

Every link out of the page keeps `?d=` and `?s=`: the page wraps everything in
`LinkScope`, and the path builders carry both (ADR-0057 addresses).

## The data layer (`src/api/player/`)

Callers import each loader from its own module. There is no barrel. Read
`context.js` first: it states the three rules the loaders keep.

| Module | Feeds |
| --- | --- |
| `context.js` | The shared vocabulary: `playerContext` (the person, his transaction feed, and every derived "where is he playing" fact), `currentSeasonFor`, `yearByYearFor`, `boxscoreLinks`, `resolveCurrentSeasonStat` |
| `core.js` | `loadPlayerCore`: the hero, the fact strip, the status banners |
| `overview.js` | `loadPlayerOverview`: the stat blocks behind the tiles and the jump bar |
| `history.js` | the Firsts, awards, innings and transaction readers the History slots call |

The page mounts `loadPlayerCore` and `loadPlayerOverview` together. Each slot's module
owns the rest of its data. **The context is cheap and every loader pays for it**: put a
fetch two modules want in both modules, not in `context.js` or `core.js`.

Every module here is classified **spoiler-free** in `src/api/spoiler-manifest.json`.
The player page is an open surface (root `CLAUDE.md`'s spoiler scope): season and
career stats are not scores. Its one date rule, that every dated fetch is cut off the
day BEFORE a `?d=` link's game, is the page's own as-of contract, not a seal. Today's
game score never shows on the game logs (`fetchFinalScores`, ADR-0110).
