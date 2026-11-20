import { pathOf } from './route/table.js'

// Single source of truth for the app's standalone report/reference pages —
// everything reachable from the header/slate hamburger menu (SiteMenu.jsx),
// the slate footer's "More Baseball" list (SiteFooter.jsx), the standalone
// report pages' own footer (ReportFooter.jsx), and the /more directory page
// (screens/MorePage.jsx). Every one of those spreads from here rather than
// keeping its own copy, so the lists can't drift apart the way they once did
// (Foul Tracker and My First Scorebook were missing from the footer) — see
// scripts/check-report-pages.mjs, which fails lint if any of the three chrome
// files stops importing REPORT_PAGES.
//
// PAGE_GROUPS is the source of truth now; REPORT_PAGES is derived from it.
// The flat array existed first and three callers still want a flat list, so it
// stays exported — but a page is added to a GROUP, once, and every surface
// picks it up. Adding a page to REPORT_PAGES directly is no longer possible,
// which is the point.
//
// Grouping exists because forty ungrouped rows is not a list a reader scans,
// it's a list a reader gives up on. The 2026-11-17 regroup (below PAGE_GROUPS)
// sorts them by what a reader came to do; its reasons are recorded here rather
// than in a doc, because the next person to touch this file needs them.

// WHAT THE CONDITIONS-AROUND-THE-GAME GROUP IS CALLED, in the menu, in the
// footer, on /more, and on the broadcast pages' own mastheads — one string,
// because those are four places and this file exists because copies drift.
//
// "On the field" since the regroup: the group now holds the officiating boards
// (Umpire Rankings, ABS Challenges) beside the broadcast package (crowds, clock,
// arm workload, doubleheaders, game notes) — all of it the conditions around a
// game rather than its result. It was "Around the game" before; the broadcast
// code still carries that name in its paths (src/screens/around-the-game/).
export const BROADCAST_STRAND = 'On the field'

// The groups whose pages are report pages proper, plus Yours — the ones every
// footer lists. Guides and Tools are NOT here; see below for why.
// The groups follow the 2026-11-17 menu regroup: sorted by what a reader came
// to do, 5–8 pages each, so a column scans at a glance. Each page carries a
// one-line `desc` (shown under its name in the menu) and optional `keywords`
// the menu's find box also matches. A renamed page keeps its old name in
// `was`, which the find box matches and shows while searching.
//
// Group order: who is winning → ask your own question → the conditions around
// a game → the clubs' rosters and books → October → the record book, then the
// reader's own pages. Order within a group is busiest first.
export const PAGE_GROUPS = [
  {
    id: 'standings',
    label: 'Standings & leaders',
    pages: [
      { label: 'Standings', path: pathOf('standings'), desc: 'Every division and the wild card', keywords: 'games back' },
      { label: 'Postseason Race', path: pathOf('postseason-race'), desc: 'The six-club field, and who is chasing it', keywords: 'wild card clinch' },
      { label: 'League Leaders', path: '/leaders', desc: 'Top of every batting and pitching category', keywords: 'home runs era avg' },
      { label: 'Run Value Leaders', path: pathOf('run-value'), desc: 'Bat, glove, legs and arm on one scale of runs', keywords: 'war value' },
      { label: 'Hot & Cold', path: '/outliers', desc: 'Who is far above or below his normal level', keywords: 'outliers', was: 'Standing Out' },
      { label: 'Situational Records', path: '/situational-records', desc: 'Each club in one game situation, ranked', keywords: 'one-run extra innings' },
      { label: 'Biggest At-Bats', path: pathOf('tensest'), desc: 'The season’s highest-pressure plate appearances', keywords: 'leverage clutch', was: 'Pressure Moments' },
    ],
  },
  {
    id: 'lookup',
    label: 'Look it up',
    pages: [
      { label: 'Ask the Play Log', path: pathOf('research'), desc: 'Search every play by batter, pitcher, count and more', keywords: 'query', was: 'Research' },
      { label: 'Matchup Scout', path: '/scout', desc: 'One pitcher against one hitter', keywords: 'pitch zones' },
      { label: 'Streak Finder', path: pathOf('streaks'), desc: 'Any club, any stat, so many games in a row', keywords: 'consecutive' },
      { label: 'Best Stretch', path: pathOf('best-stretch'), desc: 'A player’s best run of games, across seasons', keywords: 'span' },
      { label: 'Best Stretch by Club', path: pathOf('club-stretch'), desc: 'A club’s best run of games', keywords: 'team span', was: 'Club Stretch' },
      { label: 'Foul Tracker', path: pathOf('fouls'), desc: 'Who fouls off the most pitches', keywords: 'fouls' },
      { label: 'Six Degrees of Teammates', path: pathOf('teammates'), desc: 'Link any two players through teammates', keywords: 'connections' },
      { label: 'Where they’re from', path: '/from', desc: 'Players by birthplace', keywords: 'hometown country' },
    ],
  },
  {
    // The broadcast package (src/screens/around-the-game/) lives here with the
    // officiating boards: all of it is the conditions around a game rather
    // than its result. BROADCAST_STRAND names this group on those mastheads.
    id: 'on-the-field',
    label: BROADCAST_STRAND,
    pages: [
      { label: 'Bullpen Availability', path: pathOf('bullpens'), desc: 'Who can pitch tonight, by recent work', keywords: 'relievers rest' },
      { label: 'Umpire Rankings', path: pathOf('umpire-rankings'), desc: 'Every umpire’s called pitches against the zone', keywords: 'umps strike zone' },
      { label: 'ABS Challenges', path: pathOf('abs-challenges'), desc: 'Each challenged call, and who wins them', keywords: 'robot zone' },
      { label: 'Pace of Play', path: pathOf('pace'), desc: 'How long games take, club by club', keywords: 'clock time' },
      { label: 'Attendance', path: pathOf('attendance'), desc: 'Crowds at every park', keywords: 'fans' },
      { label: 'Doubleheaders', path: pathOf('doubleheaders'), desc: 'What two games in a day does to a club', keywords: 'twin bill' },
      { label: 'Game Notes', path: '/game-notes', desc: 'Each club’s pregame notes', keywords: 'pdf press' },
    ],
  },
  {
    id: 'rosters',
    label: 'Rosters & money',
    pages: [
      { label: 'Salaries', path: pathOf('salaries'), desc: 'Who is paid what, and each club’s payroll', keywords: 'payroll contracts' },
      { label: 'Free Agents', path: '/free-agents', desc: 'Who filed, and where each one signed', keywords: 'signings hot stove' },
      { label: 'Trade Simulator', path: pathOf('trade'), desc: 'Build a trade and see what moves', keywords: 'trade machine card' },
      { label: 'Trade Deadline', path: '/trade-deadline', desc: 'Every deadline deal', keywords: 'trades' },
      { label: 'Top MLB Prospects', path: pathOf('prospects'), desc: 'The best players not yet in the majors', keywords: 'minors pipeline' },
      { label: 'Farm System Rankings', path: pathOf('farm-system'), desc: 'Each club’s minor-league talent, ranked', keywords: 'farm' },
      { label: 'Rehab Assignments', path: pathOf('rehab'), desc: 'Injured players on minor-league rehab', keywords: 'injured list il' },
    ],
  },
  {
    id: 'postseason',
    label: 'Postseason',
    pages: [
      { label: 'Postseason History', path: pathOf('postseason-history'), desc: 'Every bracket and champion', keywords: 'world series october' },
      { label: 'Postseason Leaders', path: pathOf('postseason-leaders'), desc: 'Career leaders in October', keywords: 'october' },
      { label: 'Postseason Records', path: '/postseason-records', desc: 'Single-game and series records', keywords: 'october' },
      { label: 'Best Clubs in October', path: pathOf('run-differential'), desc: 'How the best regular-season clubs fared', keywords: 'run differential', was: 'Run Differential' },
      { label: 'What Champions Share', path: pathOf('nine-keys'), desc: 'Nine traits every champion had', keywords: 'nine keys', was: 'Nine Keys' },
    ],
  },
  {
    id: 'record-book',
    label: 'Record book',
    pages: [
      { label: 'Milestone Watch', path: pathOf('milestones'), desc: 'Who is close to a round number', keywords: '500 3000 career' },
      { label: 'Awards History', path: pathOf('awards-history'), desc: 'MVP, Cy Young and more, every year', keywords: 'mvp cy young' },
      { label: 'All Star Game', path: pathOf('all-star-rosters'), desc: 'This year’s rosters', keywords: 'all-star' },
      { label: 'All-Star Legacy', path: pathOf('all-star-legacy'), desc: 'Every All-Star, every year', keywords: 'all-star history' },
      { label: 'Notable Games', path: pathOf('notable'), desc: 'No-hitters, cycles and other rare games', keywords: 'no-hitter cycle' },
      { label: 'No Outfield Outs', path: pathOf('infield'), desc: 'Games with no out made by an outfielder', keywords: 'infield', was: 'Kept It in the Infield' },
      { label: 'Games After Elimination', path: pathOf('eliminated'), desc: 'What clubs did after they were out', keywords: 'eliminated' },
    ],
  },
  {
    id: 'yours',
    label: 'Yours',
    pages: [
      // My Tally leads on purpose: it is what the slate footer's "Settings"
      // button opens, so it is the one a reader looks for by name.
      { label: 'My Tally', path: pathOf('profile') },
      { label: 'Game Log', path: '/logbook' },
      { label: 'My First Scorebook', path: pathOf('first-scorebook') },
      { label: 'Game Photos', path: '/photos' },
    ],
  },
]

// The menu group a report page is filed under, by address. One page wears the
// broadcast masthead without belonging to the broadcast group
// (/abs-challenges, see its row above), and that masthead's chip has to name
// the group the reader actually came through. Reading it back from this table
// is what keeps the words on the page and the words in the menu the same words
// — the whole argument this file is built on. Falls back to the broadcast
// strand, which is what every other page wearing that masthead belongs to.
export function groupLabelFor(path) {
  return PAGE_GROUPS.find((g) => g.pages.some((p) => p.path === path))?.label ?? BROADCAST_STRAND
}

// The guides live at /learn and are NOT React routes — they are server-
// rendered documents (ADR-0053), which is why they carry a full URL path here
// and never belonged in REPORT_PAGES. Until now nothing inside the app linked
// to them at all: eleven pages written to be found, reachable only from a
// search engine. Four headliners plus the hub, rather than all eleven — the
// hub is itself a grouped task map, so re-listing every guide here would be a
// second copy of a list that already exists on the other side of that link.
export const GUIDES_GROUP = {
  id: 'guides',
  label: 'Guides',
  pages: [
    { label: 'How to score a baseball game', path: '/learn/score-a-baseball-game' },
    { label: 'How to read a box score', path: '/learn/read-a-box-score' },
    { label: 'Scorekeeping symbols', path: '/learn/scorekeeping-symbols' },
    { label: 'The stats glossary', path: '/learn/stats-glossary' },
    { label: 'All 11 guides', path: '/learn' },
  ],
}

// Menu-and-directory-only. These are not report pages — no report page's own
// footer should list "About" — but a reader looking for the printable logo
// sheet has nowhere else to look. Logo Sheet also appears as one of the slate
// footer's three bordered action buttons; it is in both places on purpose,
// because the slate's copy is an ACTION and this one is an address.
//
// Labelled "The site" rather than "Tools", which was one of the groupings the
// nav study flagged as wrong: About is not a tool. It is less wrong now than
// it was — About was rewritten as the site's own story in #742 — so the
// heading names what the two pages have in common (they are about Tally
// itself, not about baseball) instead of miscasting one of them.
export const TOOLS_GROUP = {
  id: 'tools',
  label: 'The site',
  pages: [
    { label: 'Logo Sheet', path: '/logos' },
    { label: 'About', path: '/about' },
  ],
}

// Every group, in the order the menu and the /more page both render them.
// The two callers that show everything (SiteMenu, MorePage) spread this; the
// two footers render PAGE_GROUPS as columns and finish with FOOTER_TRAIL —
// all four of them reading this module is what check-report-pages.mjs guards.
export const MENU_GROUPS = [...PAGE_GROUPS, GUIDES_GROUP, TOOLS_GROUP]

// The two addresses a footer ends on, under its four columns of report pages.
//
// Both footers used to append `{ label: 'About', path: '/about' }` as a
// literal, in two files — the one shape this module exists to prevent — so it
// is declared here with the rest of them. The guides hub joins it because a
// footer's job is to say what else the site holds, and eleven server-rendered
// documents nothing inside the app linked to (ADR-0053) is a large part of
// what it holds. The HUB only: listing all eleven would put a second copy of
// /learn's own grouped task map at the foot of every page.
//
// Logo Sheet stays out. It is TOOLS_GROUP's other page, and on the slate it is
// already one of the three bordered action buttons; on a report page it is a
// printable worksheet rather than somewhere that page leads.
export const FOOTER_TRAIL = [
  {
    ...GUIDES_GROUP.pages[GUIDES_GROUP.pages.length - 1],
    group: { id: GUIDES_GROUP.id, label: GUIDES_GROUP.label },
  },
  {
    ...TOOLS_GROUP.pages.find((page) => page.path === '/about'),
    group: { id: TOOLS_GROUP.id, label: TOOLS_GROUP.label },
  },
]

// A guide path is an ordinary URL, not an app route — anything rendering one
// of these must use a real anchor and let the browser leave the SPA, or the
// client router will try to parse '/learn/...' and render the app over a
// document the server already sent (see route.js's note).
export function isGuidePath(path) {
  return path.startsWith('/learn')
}
