// Single source of truth for the app's standalone report/reference pages —
// everything reachable both from the header/slate hamburger menu
// (SiteMenu.jsx) and the slate footer's "More Baseball" list
// (SiteFooter.jsx). Both screens spread this same array rather than keeping
// their own copy, so the two lists can't drift apart the way they once did
// (Top Games was missing from the menu; Foul Tracker and My First Scorebook
// were missing from the footer) — see scripts/check-report-pages.mjs, which
// fails lint if either file stops importing this.
//
// Order is "current-season and busiest first, archival/meta last": live
// standings/leaders/Top Games/fouls (what's happening now) → player-
// trajectory pages (prospects/rehab/milestones) → the deeper-cut umpire
// stats → season-culminating history → My First Scorebook (a personal
// retrospective, see route.js), always last.
//
// Two pages are deliberately NOT in this shared list, each for its own
// screen: Logo Sheet ('/logos') is one of the footer's three bordered
// action buttons rather than a "more" link, but SiteMenu.jsx still lists it
// as a plain item since the menu has no separate actions row; About
// ('/about') is appended by both callers after this list (and after Logo
// Sheet, in the menu) so it stays the trailing item in both.
export const REPORT_PAGES = [
  { label: 'Standings', path: '/standings' },
  { label: 'League Leaders', path: '/leaders' },
  { label: 'Top Games', path: '/top-games' },
  { label: 'Foul Tracker', path: '/fouls' },
  { label: 'Top MLB Prospects', path: '/prospects' },
  { label: 'Rehab Assignments', path: '/rehab' },
  { label: 'Milestone Watch', path: '/milestones' },
  { label: 'Umpire Rankings', path: '/umpires' },
  { label: 'Awards History', path: '/awards' },
  { label: 'Postseason History', path: '/postseason-history' },
  { label: 'Postseason Leaders', path: '/postseason-leaders' },
  { label: 'All Star Game', path: '/all-star-rosters' },
  { label: 'All-Star Legacy', path: '/all-star-legacy' },
  { label: 'My First Scorebook', path: '/first-scorebook' },
]
