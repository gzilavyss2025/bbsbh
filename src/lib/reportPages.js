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

// WHAT THE BROADCAST FOUR ARE CALLED, in the menu, in the footer, on /more,
// and on each page's own masthead — one string, because those are four places
// and this file exists because copies drift.
//
// NOT "the reports". That was the first name and it was wrong: half the pages
// on this page's other groups are reports too — Standings, League Leaders,
// Situational Records, Umpire Rankings and Milestone Watch are all reports on a
// season, and a group that claims the word for four of them implies the rest
// are something else. What actually separates these four is their SUBJECT, not
// their form: crowds, clock, pipeline and arm workload are the conditions
// around a game rather than its result. So the label names that, and reads in
// the same plain register as "This season" and "History" beside it.
export const BROADCAST_STRAND = 'Around the game'

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
      { label: 'Situational Records', path: '/situational-records' },
      // Money, read across the league: who is paid the most, what each club
      // spends, where the spend goes by position. Here rather than under
      // "Around the game" because it is a season-to-date board over the whole
      // league, the same gesture as the two rows above it; a club's own book is
      // the Contracts tab on its team page, reached from this page's club rail.
      { label: 'Salaries', path: '/salaries' },
      { label: 'Foul Tracker', path: '/fouls' },
      { label: 'Umpire Rankings', path: '/umpires' },
    ],
  },
  {
    id: 'around-the-game',
    label: BROADCAST_STRAND,
    // The broadcast package (src/screens/around-the-game/,
    // styles/68-around-the-game.css — those paths carry this group's name, not
    // this FILE's, for the collision reason spelled out at BROADCAST_STRAND).
    // Its own group rather than four more rows under "This season" for two
    // reasons. They are a SET — one graphics package, one voice, one nightly
    // pair of data files behind three of them — and a reader who finds one is
    // very likely to want the others. And they answer a different KIND of
    // question than the rest of that group: Standings and League Leaders say
    // who is winning, while these say who is showing up, how long it takes,
    // what a club has coming and how much work its pen has already done.
    //
    // Four of the five are not about a result at all. The fifth, The Double
    // Dip, is here deliberately: a doubleheader is a scheduling condition —
    // rain in April, two games in August — and the page is about what that
    // condition DOES to a club, which is the same question the other four ask
    // about crowds, clock, pipeline and workload. It is a season aggregate
    // over finished games, so it spoils nothing; if a first-click test says
    // readers look for it under History instead, move it rather than
    // duplicating it.
    //
    // Attendance leads on busiest-first, the same rule every other group here
    // orders by: it is the one a reader is most likely to have come looking
    // for by name.
    //
    // All Star Game trails, outside that SET on purpose — it carries none of
    // the broadcast package's shared graphics or nightly data files. It sits
    // here because it answers the same "what's happening around the game
    // right now" question the rest of the group asks rather than a result;
    // if a first-click test says readers look for it under This season
    // instead, move it back rather than duplicating it.
    pages: [
      { label: 'Attendance', path: '/attendance' },
      { label: 'Bullpen Availability', path: '/bullpen-availability' },
      { label: 'Pace of Play', path: '/pace-of-play' },
      { label: 'Doubleheaders', path: '/doubleheaders' },
      { label: 'All Star Game', path: '/all-star-rosters' },
    ],
  },
  {
    id: 'prospects',
    label: 'Prospects & injuries',
    pages: [
      { label: 'Top MLB Prospects', path: '/prospects' },
      { label: 'Farm System Rankings', path: '/farm-system-rankings' },
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
      { label: 'Milestone Watch', path: '/milestones' },
      { label: 'Trade Deadline', path: '/trade-deadline' },
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

// The flat list, derived. test/report-pages.test.js pins the SET (nothing
// lost, nothing added, no duplicate path), not the order, because the order
// is the one thing a regrouping is allowed to move.
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
  {
    ...GUIDES_GROUP.pages[GUIDES_GROUP.pages.length - 1],
    group: { id: GUIDES_GROUP.id, label: GUIDES_GROUP.label },
  },
  {
    ...TOOLS_GROUP.pages.find((page) => page.path === '/about'),
    group: { id: TOOLS_GROUP.id, label: TOOLS_GROUP.label },
  },
]

// The four broadcast reports, ADDRESS -> route name (src/screens/around-the-game/).
// Their addresses live here rather than in route.js because this file is
// already the single source of truth for what a report page is and where it
// lives, and the group above lists these same four: a table beside those rows
// cannot drift from them the way a second copy in the parser could. route.js
// imports it for its one parse branch.
//
// They are flat segments carrying no query. Each shows a whole league's season
// to date, so `?d=`/`?s=` has nothing to narrow, and every control on them (the
// sort column, the index weighting) is page state rather than an address — the
// same call StandingsPage and SituationalRecordsPage already made for their boards.
//
// THE ADDRESSES SPELL THEIR SUBJECT OUT. '/farm-system-rankings',
// '/bullpen-availability' and '/pace-of-play' are the phrases people actually
// search for, and a report page's URL is one of the few places in this app that
// has to answer to a search engine as well as to a reader (ADR-0048).
// '/attendance' is already that phrase and needs no lengthening.
//
// Each of the three keeps a SHORTER route name ('farm-system', 'bullpens',
// 'pace'), which is what App.jsx's switch and the preview-card key read. The
// address and the name are allowed to differ, and this table is the only place
// that has to know they do.
export const REPORT_ROUTES = {
  salaries: 'salaries',
  attendance: 'attendance',
  'pace-of-play': 'pace',
  doubleheaders: 'doubleheaders',
  'farm-system-rankings': 'farm-system',
  'bullpen-availability': 'bullpens',
}

// A guide path is an ordinary URL, not an app route — anything rendering one
// of these must use a real anchor and let the browser leave the SPA, or the
// client router will try to parse '/learn/...' and render the app over a
// document the server already sent (see route.js's note).
export function isGuidePath(path) {
  return path.startsWith('/learn')
}
