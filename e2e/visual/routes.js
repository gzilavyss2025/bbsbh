// The pages the screenshot suite covers (issue #1177), and how each one is shot.
//
// WHY THESE PAGES. The issue asks for /design-lab plus about ten routes that
// carry the most shared parts, picked from the card and pill census
// (.scratch/design-system/inventory.md and pill-collapse/map.md). Where it fit,
// the list also covers every page that #1131's slices 3 to 5 change:
//   - the player page's contract card (`.contractcard__regime`, slice 3);
//   - the themed team hub whose Standings card shows "Postseason odds"
//     (`.psodds-pill`, slice 5), and /situational-records (`.trrank__*`, 4 + 5).
//
// THE SPOILER RULE. Every shot is of a SEALED page. The shots are never
// committed, but they land in a report that is easy to open and pass around, and
// a picture of a sealed surface must never hold a score.
// The game pages (lineup, innings, box score) are shot with nothing revealed.
// (The slate's result filter chips had an element shot here until ADR-0116
// removed them.) The team hub, player pages,
// standings and reports are outside the spoiler scope (CLAUDE.md, ADR-0034).
//
// THE DATE. The pinned anchor game (docs/test-games.md: 823035, MIL@STL game 2,
// 2026-07-07) supplies the game pages. The frozen clock below is the same on
// both servers and on every run, so a page that reads "today" reads the same
// day: a September postseason race, not whatever the calendar says.

// 2026-09-23, 11:00 in Chicago (the timezone in setup.js). A page asks statsapi
// for dates computed from this clock, and each run records what it asks for.
export const FROZEN_NOW = '2026-09-23T11:00:00-05:00'

const ANCHOR = '/07072026/milstl-2'

// Parts of a page that move on their own, painted over in every shot: the
// loading ball and the cold-load loader, whose linescore cycles its digits on a
// timer (the design lab draws one as a specimen), and highlight-clip posters (a
// clip's poster frame is chosen by MLB and can change under the same URL).
export const MASKS = ['.skel__ball', '.loader__scoreboard', '.hlclip__poster', 'video']

// Parts of a page that differ between the two servers BY DESIGN, taken out of
// every shot. The footer's "build 1234567" link prints the git commit each
// server was started from (vite.config.js, resolveBuildCommit), so it never
// matches between a branch and main. It is hidden, not masked: a mask box is as
// wide as the text under it, and two commits' glyphs need not be as wide. It is
// the last item on its line, so hiding it moves nothing else.
export const HIDDEN = ['.sitefooter__build-link']

// Each route: `name` (the start of each shot's file name), `path`, and `shots`.
// A shot with no `selector` is the full page; with one, it is that element
// alone. `ready` is a selector the page draws once its data has arrived.
// `prepare` runs after the page settles and before the shots. `offShot` names
// requests that only feed parts of the page no shot shows, so the recording not
// holding one is not a failure.
export const ROUTES = [
  {
    // The catalog, in its four bands plus the page head. Split because the
    // whole page is ~43,000px tall at 390px, and one band per image gives a
    // readable diff.
    name: 'design-lab',
    path: '/design-lab',
    ready: '#pills',
    shots: [
      { name: 'head', selector: '.dlab__verdictbox' },
      { name: 'tokens', selector: '#tokens' },
      { name: 'components', selector: '#components' },
      { name: 'cards', selector: '#cards' },
      { name: 'pills', selector: '#pills' },
    ],
  },
  {
    // The anchor date's slate, every card sealed.
    name: 'slate',
    path: '/07072026',
    ready: '.gamecard',
    shots: [{ name: 'page' }],
  },
  { name: 'lineup', path: `${ANCHOR}/lineup1`, ready: '.lineup', shots: [{ name: 'page' }] },
  { name: 'innings', path: `${ANCHOR}/top1`, ready: '.pagenav--innings', shots: [{ name: 'page' }] },
  { name: 'boxscore', path: `${ANCHOR}/boxscore`, ready: '.sealbox:visible', shots: [{ name: 'page' }] },
  {
    // Overview: the club band and the Standings card with "Postseason odds".
    name: 'team-overview',
    path: '/team/milwaukee-brewers-158',
    ready: '.psodds-pill',
    shots: [{ name: 'page' }],
  },
  {
    // The Standings band, reached by the old Numbers address (it redirects to #standings).
    name: 'team-numbers',
    path: '/team/milwaukee-brewers-158/numbers',
    ready: '#standings .card',
    shots: [{ name: 'page' }],
  },
  {
    // A hitter, with the contract card.
    name: 'player-hitter',
    path: '/player/christian-yelich-592885',
    ready: '.contractcard',
    shots: [{ name: 'page' }],
  },
  {
    name: 'player-pitcher',
    path: '/player/freddy-peralta-642547',
    ready: '.contractcard',
    shots: [{ name: 'page' }],
  },
  { name: 'salaries', path: '/salaries', shots: [{ name: 'page' }] },
  { name: 'standings', path: '/standings', shots: [{ name: 'page' }] },
  {
    // The report page: the postseason race, whose `.seed` is one of the
    // tight-sheet cards #1113 merges.
    name: 'postseason-race',
    path: '/postseason-race',
    shots: [{ name: 'page' }],
  },
  { name: 'situational-records', path: '/situational-records', shots: [{ name: 'page' }] },
]
