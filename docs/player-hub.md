# The player hub (`/player/{id}`)

The player page is not one page. It is a pinned identity header plus **four tabs,
each a real route**, and **each tab loads only its own data**. That is the team
hub's shape (ADR-0034) applied one page over, for the same reason: a reader who
wants a game log should not wait on a Statcast file, a pitch-arsenal pool, an
awards feed and a whole career's transactions to land first.

Read `src/api/player/context.js` before changing anything in the data layer — it
states the three rules the loaders keep, and it is the one module more than one
loader imports.

## The addresses

| Address | Route name | Screen |
| --- | --- | --- |
| `/player/{slug-id}` | `player` | `src/screens/PlayerPage.jsx` (Overview) |
| `/player/{slug-id}/stats` | `player-stats` | `src/screens/player/PlayerStatsTab.jsx` |
| `/player/{slug-id}/analytics` | `player-analytics` | `src/screens/player/PlayerAnalyticsTab.jsx` |
| `/player/{slug-id}/history` | `player-history` | `src/screens/player/PlayerHistoryTab.jsx` |

The Overview is the bare address, exactly as `TeamPage.jsx` is the team hub's —
so every link ever shared, stamped or bookmarked still opens the man's page.

`PLAYER_TAB_ROUTES` in `src/lib/route.js` maps the third URL segment to the route
name, and `playerTabPath(id, tab, opts)` builds one. Both sit beside the team
hub's `TEAM_TAB_ROUTES` / `teamTabPath`, which they mirror line for line.

**An unknown third segment resolves to the bare player page**, which is the one
place the two tables differ. `/player/{id}` has been a live address for the app's
whole life; a link with anything appended to it — a hand-edited URL, a tab
renamed later — has to land on the man's page rather than fall through to the
slate (or, worse, to the generic 3-segment game route). `test/route.test.js` pins
it.

Every tab path goes through `linkQuery`, so a dated link keeps its `?d=`/`?s=`
across a tab switch. Without that, one visit would answer "entering July 5" on
one tab and "today" on the next.

## What is on which tab

- **Overview** — who he is now. The fact grid, the Contract card, each stat
  block's current-season tiles with their league-rank chips and any other level
  he has played at this year, Milestone Watch, and the season's Photos and
  Highlights rails. A player who has **not debuted** leads instead with his
  career timeline and Path to the Majors: that IS his page.
- **Stats** — what he has done. The game log with its level toggle, the recent
  form (hitter) or workload (pitcher) card that summarizes it, the splits, and
  the career register.
- **Analytics** — what is under those numbers. The Prospect card below the
  majors, Statcast percentiles and the advanced rates above them, the season's
  fouls, the pitch mix or batted-ball mix, and the similarity neighbours.
- **History** — how he got here. Awards, innings by position, the Firsts card,
  Path to the Majors and Team history (for a player who HAS debuted), and the
  transaction timeline.

The `blocks.map` shape is load-bearing on three of the four: a **two-way player
has two stat blocks** (batting, then pitching), and every section inside that
loop belongs to one of them. The tabs are **role-agnostic** — a pitcher's page
renders the same Analytics shelf a hitter's does; what differs is which cards
have anything to say.

## The chrome

`src/screens/player/PlayerHubShell.jsx` draws everything around a tab's body: the
site bar, the four status banners (All-Star, rehab, IL, last played), the back
button, the hero, the tab bar, and — under the body — the as-of caveat and
`AsOfBanner`. **The caveat and the banner ride every tab**, because `?d=` dates
the whole hub: a reader who switched tabs must still be told what the page is
frozen to and still have the way back to live.

Its own data is `loadPlayerCore` (`src/api/player/core.js`), the counterpart of
the team hub's `loadTeamIdentity`: deliberately cheap, because **every tab pays
for it on top of its own loader**.

`src/screens/player/PlayerTabBar.jsx` is this hub's tab list over
`src/components/chrome/HubTabBar.jsx` — the same control the team hub's
`TeamTabBar.jsx` renders. One control, two lists, so the two tab strips cannot
drift into two different-looking things. The control is deliberately **not**
club-coloured on either hub: `.teamtabs__btn` inks its active tab from
`--accent-primary`, per ADR-0030's rule that a club may colour a card that
identifies the club, never a control.

`src/screens/player/parts.jsx` holds the small pieces more than one tab draws —
`SectionTitle`, `StatGrid`, `Fact`, and the two date formatters. A piece only one
tab draws stays in that tab's own screen.

## The data layer (`src/api/player/`)

`src/api/loadPlayer.js` is a barrel over this directory, the same shape
`person.js` takes over `person/`, so no caller has to know which module a loader
lives in.

| Module | Feeds |
| --- | --- |
| `context.js` | The shared vocabulary: `playerContext` (the person, his transaction feed, and every derived "where is he playing" fact), `currentSeasonFor`, `yearByYearFor`, `boxscoreLinks`, `resolveCurrentSeasonStat` |
| `core.js` | `loadPlayerCore` — the shell |
| `overview.js` | `loadPlayerOverview` |
| `stats.js` | `loadPlayerStats` |
| `analytics.js` | `loadPlayerAnalytics` |
| `history.js` | `loadPlayerHistory`, plus the lazily-called `loadPositionScope` |

Three rules, all stated at the top of `context.js`:

1. **A tab fetches only what its own sections render.** Some overlap between
   tabs is expected and accepted — the year-by-year tables are read by three of
   them — exactly as the team hub's tab loaders overlap. Duplicated fetches
   across tabs are the price of tabs that load independently; a shared
   mega-fetch is the thing being avoided.
2. **`buildBlock` stays the one block shaper.** A tab hands it the splits it
   fetched and empty arrays for the rest, so fields that tab does not render come
   back empty or null. It is pure — no fetch rides on it — so a field a tab
   ignores costs nothing, and there is exactly one place a tile, a register row
   or a milestone is shaped.
3. **The context is cheap and every tab pays for it.** If you are tempted to add
   a fetch to `context.js` or `core.js` because two tabs happen to want it, put
   it in both tabs' loaders instead.

One thing that looks like a violation of rule 3 and is not: the hero's position
line reads "SP"/"RP"/"CL" for a pitcher, and that word is a reading of his
current-season line — so `core.js` resolves it, because the hero is drawn on
every tab. A two-way player reads "DH/P" and a position player his own
`posAbbr`, so neither fetches anything for it.

Every module here is classified **spoiler-free** in `src/api/spoiler-manifest.json`.
The player page is an open surface (root `CLAUDE.md`'s spoiler scope): season and
career stats are not scores. Its one date rule — every dated fetch is cut off the
day BEFORE a `?d=` link's game — is the page's own as-of contract, not a seal.
