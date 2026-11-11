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
      { label: 'Standings', path: pathOf('standings') },
      // Sits next to Standings on purpose: it's the same "who's winning"
      // question, narrowed to the six-team postseason field.
      { label: 'Postseason Race', path: pathOf('postseason-race') },
      { label: 'League Leaders', path: '/leaders' },
      // The same season-to-date read, asked as "who is out of the ordinary": every hot or
      // cold callout in the league, with a date slider (#2453).
      { label: 'Standing Out', path: '/outliers' },
      // Directly under League Leaders because it is the same gesture asked a
      // different way: that board ranks each skill in its own units, this one
      // puts all four of them — bat, glove, legs, arm — on one scale of runs
      // and adds them up. A reader who has just seen who leads in home runs is
      // one row away from who has been worth the most, whatever he does.
      { label: 'Run Value Leaders', path: pathOf('run-value') },
      // Landed on main while this regrouping was in flight (#742): one
      // situational record, every club at one level, ranked. It belongs next
      // to League Leaders because it is the same gesture — a season-to-date
      // board read across the league — not next to the club pages it is
      // reached from.
      { label: 'Situational Records', path: '/situational-records' },
      // The season's tensest at-bats by MLB's pressure score, a club's and the league's.
      // Beside Situational Records: the same season-to-date board gesture.
      { label: 'Pressure Moments', path: pathOf('tensest') },
      // Team-games since 2021 with no out to an outfielder (#2976): a rare-feat list.
      { label: 'Kept It in the Infield', path: pathOf('infield') },
      // Any club, any counting stat, N games in a row at a total, back to the franchise's first season.
      { label: 'Streak Finder', path: pathOf('streaks') },
      // One hitter's best N games in a row (162 by default), across seasons.
      { label: 'Best Stretch', path: pathOf('best-stretch') },
      // Games each club played after it was mathematically out, by season span.
      { label: 'Games After Elimination', path: pathOf('eliminated') },
      // Money, read across the league: who is paid the most, what each club
      // spends, where the spend goes by position. Here rather than under
      // "Around the game" because it is a season-to-date board over the whole
      // league, the same gesture as the two rows above it; a club's own book is
      // the Contracts tab on its team page, reached from this page's club rail.
      { label: 'Salaries', path: pathOf('salaries') },
      // The hot-stove board (#2509): who filed for free agency and where each
      // one signed. Beside Salaries because it is the same money question,
      // read league-wide.
      { label: 'Free Agents', path: '/free-agents' },
      // One pitcher against one hitter: where he throws each pitch, how the
      // hitter does against it, and every time they met (#1408). A lookup on
      // the season's data, read like the boards above it, not a game page.
      { label: 'Matchup Scout', path: '/scout' },
      { label: 'Foul Tracker', path: pathOf('fouls') },
      { label: 'Umpire Rankings', path: pathOf('umpire-rankings') },
      // The season board for the ABS Challenge System, 2026's first in MLB.
      // Next to Umpire Rankings because the two are the same kind of page —
      // a season-to-date officiating board read across the league — asking
      // different halves of one question: that one scores every called pitch
      // against the zone, this one scores only the calls a player thought
      // were wrong. Not under "Around the game": this is about a result on
      // the field, not about the conditions around it.
      { label: 'ABS Challenges', path: pathOf('abs-challenges') },
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
    // over finished games; if a first-click test says
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
      { label: 'Attendance', path: pathOf('attendance') },
      { label: 'Bullpen Availability', path: pathOf('bullpens') },
      { label: 'Pace of Play', path: pathOf('pace') },
      { label: 'Doubleheaders', path: pathOf('doubleheaders') },
      { label: 'All Star Game', path: pathOf('all-star-rosters') },
      // Every club's pregame notes PDFs, links only. It was reachable only from
      // the What's Brewing modal; it is the same "around the game" question —
      // what a club hands the press before first pitch.
      { label: 'Game Notes', path: '/game-notes' },
    ],
  },
  {
    id: 'prospects',
    label: 'Prospects & injuries',
    pages: [
      { label: 'Top MLB Prospects', path: pathOf('prospects') },
      { label: 'Farm System Rankings', path: pathOf('farm-system') },
      { label: 'Rehab Assignments', path: pathOf('rehab') },
    ],
  },
  {
    id: 'history',
    label: 'History',
    pages: [
      { label: 'Where they’re from', path: '/from' },
      { label: 'Awards History', path: pathOf('awards-history') },
      { label: 'Postseason History', path: pathOf('postseason-history') },
      // A shelf of results (final scores), like Postseason History beside it.
      { label: 'Notable Games', path: pathOf('notable') },
      // Beside Postseason History because it reads the same 26 brackets from
      // the other end: that page shows what happened each October, this one
      // asks what every champion had in common before October started.
      { label: 'Nine Keys', path: pathOf('nine-keys') },
      // Directly under Postseason History because it is that page's question
      // turned around: the bracket page shows who won each October, this one
      // takes the clubs that were plainly the best over a season and asks what
      // October did to them. It wears the broadcast masthead and sits in
      // src/screens/around-the-game/ for the same reason /abs-challenges does —
      // that is where the report components and the one report stylesheet live
      // — and is filed here because it is history, back to 1901.
      { label: 'Run Differential', path: pathOf('run-differential') },
      // Unsettled: a leader board filed by era, while League Leaders is filed
      // by season. Same kind of page, two different groups.
      { label: 'Postseason Leaders', path: pathOf('postseason-leaders') },
      { label: 'Postseason Records', path: '/postseason-records' },
      { label: 'All-Star Legacy', path: pathOf('all-star-legacy') },
      { label: 'Six Degrees of Teammates', path: pathOf('teammates') },
      { label: 'Milestone Watch', path: pathOf('milestones') },
      { label: 'Trade Deadline', path: '/trade-deadline' },
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
