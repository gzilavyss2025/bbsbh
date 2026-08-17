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
// Grouping exists because nineteen ungrouped rows is not a list a reader
// scans, it's a list a reader gives up on. The bucket names are a first pass
// and three of them are known to be shaky — see the "unsettled" notes below.
// They are recorded here rather than in a doc, because the next person to
// touch this file is the one who needs to know.
//
// Order within a group is "busiest first". Order of the groups themselves is
// "what's happening now" → "who's coming up" → "what already happened" →
// "your own things", with the two menu-only groups (guides, tools) last.

// The four groups whose pages are report pages proper — the ones every
// footer lists. Guides and Tools are NOT here; see below for why.
export const PAGE_GROUPS = [
  {
    id: 'this-season',
    label: 'This season',
    pages: [
      { label: 'Standings', path: '/standings' },
      { label: 'League Leaders', path: '/leaders' },
      // Landed on main while this regrouping was in flight (#742): one
      // situational record, every club at one level, ranked. It belongs next
      // to League Leaders because it is the same gesture — a season-to-date
      // board read across the league — not next to the club pages it is
      // reached from.
      { label: 'Team Records', path: '/team-records' },
      { label: 'Foul Tracker', path: '/fouls' },
      { label: 'Milestone Watch', path: '/milestones' },
      { label: 'Umpire Rankings', path: '/umpires' },
      // Unsettled: these two are this season's EVENTS, and they become
      // archives the moment the season turns. They sat under History until
      // the nav study moved them; if a first-click test says readers look for
      // them there, move them back rather than duplicating them.
      { label: 'Trade Deadline', path: '/trade-deadline' },
      { label: 'All Star Game', path: '/all-star-rosters' },
    ],
  },
  {
    id: 'reports',
    label: 'The reports',
    // The broadcast package (src/screens/reports/, styles/68-broadcast-reports.css).
    // Its own group rather than five more rows under "This season" for two
    // reasons. They are a SET — one graphics package, one voice, one nightly
    // pair of data files behind four of them — and a reader who finds one is
    // very likely to want the others. And they answer a different KIND of
    // question than the rest of that group: Standings and League Leaders say
    // who is winning, while these say who is showing up, how long it takes,
    // what a club has coming and how much work its pen has already done. None
    // of them is about a result.
    //
    // The Rundown leads because it is the way in: one figure from each of the
    // other four, each opening the board it came from.
    pages: [
      { label: 'The Rundown', path: '/rundown' },
      { label: 'Attendance', path: '/attendance' },
      { label: 'Farm System Index', path: '/farm' },
      { label: 'Bullpen Availability', path: '/bullpens' },
      { label: 'Pace of Play', path: '/pace' },
    ],
  },
  {
    id: 'prospects',
    label: 'Prospects & injuries',
    // Unsettled: two items is a label pretending to be a group. It survives
    // this pass because both pages are about players who are NOT in tonight's
    // lineup, which is a real distinction — but a third page, or a merge into
    // "This season", would both be defensible.
    pages: [
      { label: 'Top MLB Prospects', path: '/prospects' },
      { label: 'Rehab Assignments', path: '/rehab' },
    ],
  },
  {
    id: 'history',
    label: 'History',
    pages: [
      { label: 'Awards History', path: '/awards' },
      { label: 'Postseason History', path: '/postseason-history' },
      // Unsettled: a leader board filed by era, while League Leaders is filed
      // by season. Same kind of page, two different groups.
      { label: 'Postseason Leaders', path: '/postseason-leaders' },
      { label: 'All-Star Legacy', path: '/all-star-legacy' },
    ],
  },
  {
    id: 'yours',
    label: 'Yours',
    pages: [
      // My Tally leads on purpose: it is what the slate footer's "Settings"
      // button opens, so it is the one a reader looks for by name.
      { label: 'My Tally', path: '/profile' },
      { label: 'Game Log', path: '/logbook' },
      { label: 'My First Scorebook', path: '/first-scorebook' },
      { label: 'Game Photos', path: '/photos' },
    ],
  },
]

// The flat list, derived. Same pages as before this file grew groups; the
// ORDER changed, deliberately — Trade Deadline and All Star Game moved up out
// of History, and the two player-trajectory pages moved down below the live
// season pages. test/report-pages.test.js pins the SET (nothing lost, nothing
// added, no duplicate path), not the order, because the order is the one thing
// this change is allowed to move.
export const REPORT_PAGES = PAGE_GROUPS.flatMap((group) => group.pages)

// The guides live at /learn and are NOT React routes — they are server-
// rendered documents (ADR-0048), which is why they carry a full URL path here
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
// documents nothing inside the app linked to (ADR-0048) is a large part of
// what it holds. The HUB only: listing all eleven would put a second copy of
// /learn's own grouped task map at the foot of every page.
//
// Logo Sheet stays out. It is TOOLS_GROUP's other page, and on the slate it is
// already one of the three bordered action buttons; on a report page it is a
// printable worksheet rather than somewhere that page leads.
export const FOOTER_TRAIL = [
  GUIDES_GROUP.pages[GUIDES_GROUP.pages.length - 1],
  TOOLS_GROUP.pages.find((page) => page.path === '/about'),
]

// The five broadcast reports, ADDRESS -> route name (src/screens/reports/).
// Their addresses live here rather than in route.js because this file is
// already the single source of truth for what a report page is and where it
// lives, and the group above lists these same five: a table beside those rows
// cannot drift from them the way a second copy in the parser could. route.js
// imports it for its one parse branch.
//
// They are flat segments carrying no query. Each shows a whole league's season
// to date, so `?d=`/`?s=` has nothing to narrow, and every control on them (the
// sort column, the index weighting) is page state rather than an address — the
// same call StandingsPage and TeamRecordsPage already made for their boards.
// '/farm' is the address because it is the word people say; the route name is
// 'farm-system' so App.jsx's switch reads unambiguously.
export const REPORT_ROUTES = {
  rundown: 'rundown',
  attendance: 'attendance',
  pace: 'pace',
  farm: 'farm-system',
  bullpens: 'bullpens',
}

// A guide path is an ordinary URL, not an app route — anything rendering one
// of these must use a real anchor and let the browser leave the SPA, or the
// client router will try to parse '/learn/...' and render the app over a
// document the server already sent (see route.js's note).
export function isGuidePath(path) {
  return path.startsWith('/learn')
}
