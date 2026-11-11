// THE ROUTE TABLE: one entry per addressable page, the single record of its
// route name and its address (CONTEXT.md, "Route table").
//
// Before this table, a page's slug was typed by hand in up to four places —
// a parse branch in lib/route.js, App.jsx's screen map, the menu row in
// lib/reportPages.js, and (for some) REPORT_ROUTES or seasons/route.js's
// SEASON_PAGES — and nothing checked that they agreed. Now each of those reads
// from here, and test/route-table.test.js checks the rest.
//
// An entry:
//   name     the route name parseRoute returns and App.jsx keys its screen on
//   path     the canonical address; builders and the menu write this one
//   aliases  older addresses that still parse to the same page (optional)
//   season   true for a SEASON VIEW (#1202): '/{slug}/{year|all}' and `?vs=`
//            parse here too, via lib/seasons/route.js (optional)
//
// First pass (2026-11): the pages whose screen takes no route params. Pages
// with ids, dates or slugs (game, player, team, …) still parse by hand in
// route.js; an entry may later carry its own parse/build to join.
//
// Pure data, no React: lib/route.js is imported by ~100 modules and the node
// unit suite. The screens live in App.jsx, keyed by `name`.

export const ROUTE_TABLE = [
  { name: 'more', path: '/more' },
  { name: 'prospects', path: '/prospects' },
  { name: 'rehab', path: '/rehab' },
  { name: 'tensest', path: '/pressure-moments', aliases: ['/tensest'] },
  { name: 'infield', path: '/infield' },
  { name: 'streaks', path: '/streaks' },
  { name: 'eliminated', path: '/eliminated' },
  { name: 'milestones', path: '/milestones' },
  { name: 'awards-history', path: '/awards' },
  { name: 'postseason-history', path: '/postseason-history' },
  { name: 'nine-keys', path: '/nine-keys' },
  { name: 'classics', path: '/classics' },
  { name: 'notable', path: '/notable' },
  { name: 'postseason-leaders', path: '/postseason-leaders' },
  { name: 'all-star-rosters', path: '/all-star-rosters' },
  { name: 'all-star-legacy', path: '/all-star-legacy' },
  // My Tally: deliberately ONE address, not '/profile/{sub}' — Clerk's
  // <UserProfile> owns its own sub-navigation (mounted routing="virtual"), so
  // a stray '/profile/x' falls through to the slate.
  { name: 'profile', path: '/profile' },
  { name: 'first-scorebook', path: '/first-scorebook' },
  // The single-segment reports (formerly reportPages.js's REPORT_ROUTES).
  // Flat segments with no query: each shows a whole league's season to date,
  // and every control on them is page state, not an address.
  // THE ADDRESSES SPELL THEIR SUBJECT OUT: '/farm-system-rankings',
  // '/bullpen-availability' and '/pace-of-play' are the phrases people search
  // for (ADR-0053), while App.jsx and the preview cards key on the shorter name.
  { name: 'salaries', path: '/salaries' },
  { name: 'run-value', path: '/run-value' },
  { name: 'run-differential', path: '/run-differential' },
  { name: 'attendance', path: '/attendance' },
  { name: 'pace', path: '/pace-of-play' },
  { name: 'doubleheaders', path: '/doubleheaders' },
  { name: 'teammates', path: '/teammates' },
  { name: 'farm-system', path: '/farm-system-rankings' },
  { name: 'bullpens', path: '/bullpen-availability' },
  // Season views (formerly seasons/route.js's SEASON_PAGES).
  { name: 'fouls', path: '/fouls', season: true },
  { name: 'umpire-rankings', path: '/umpires', season: true },
  { name: 'abs-challenges', path: '/abs-challenges', season: true },
  { name: 'standings', path: '/standings', season: true },
  { name: 'postseason-race', path: '/postseason-race', season: true },
  // Owner-only, unlisted; each screen gates itself to a Clerk admin. Parsed
  // regardless, so a stray visit renders the locked page rather than falling
  // through to a game route.
  { name: 'admin-research', path: '/admin/research' },
  { name: 'admin-contenders', path: '/admin/contenders' },
  { name: 'admin-contracts', path: '/admin/contracts' },
  // Unlisted labs, reachable by direct URL only. No score or reveal content.
  { name: 'animation-lab', path: '/animation-lab' },
  { name: 'design-lab', path: '/design-lab' },
  { name: 'wire-lab', path: '/wire-lab' },
]

const BY_NAME = new Map(ROUTE_TABLE.map((r) => [r.name, r]))

// Exact address → route name, for every static entry's path and aliases.
// Season views are left out: their address carries a year and a query
// (`?vs=`, `?scope=`), so seasons/route.js parses them whole.
export const NAME_BY_PATH = new Map(
  ROUTE_TABLE.filter((r) => !r.season).flatMap((r) =>
    [r.path, ...(r.aliases ?? [])].map((p) => [p, r.name]),
  ),
)

// Season-view slug → route name, for seasons/route.js.
export const SEASON_NAME_BY_SLUG = Object.fromEntries(
  ROUTE_TABLE.filter((r) => r.season).map((r) => [r.path.slice(1), r.name]),
)

// The canonical address of a table route. Throws on an unknown name, so a
// typo in the menu or a builder fails at import, not as a dead link.
export function pathOf(name) {
  const route = BY_NAME.get(name)
  if (!route) throw new Error(`No route named '${name}' in ROUTE_TABLE`)
  return route.path
}
