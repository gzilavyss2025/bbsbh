// Lightweight, dependency-free URL routing over the History API. There is no
// react-router here on purpose — the app has exactly three shapes of screen, so
// a tiny parse/build pair keeps the "no dependency" ethos while making every
// game section deep-linkable and shareable.
//
// Route shapes:
//   '/'                                 -> { name: 'home' }  (MLB, today)
//   '/{MMDDYYYY}'                       -> { name: 'home', date: YYYY-MM-DD }
//   '/{league}'                         -> { name: 'home', sportId, leagueId? }
//   '/{league}/{MMDDYYYY}'              -> { name: 'home', date, sportId, leagueId? }
//                                          league is aaa|aa|higha|a — see LEAGUE_SLUG below
//                                          — or one of the four winter slugs fall|mex|ven|dom,
//                                          which all share sportId 17 and so carry a leagueId
//                                          as well (issue #1055).
//   '/logos'                            -> { name: 'logos' }
//   '/about'                            -> { name: 'about' }
//   '/more'                             -> { name: 'more' }  (every standalone page, grouped — WCAG 2.4.5's second way in)
//   '/prospects'                        -> { name: 'prospects' }
//   '/rehab'                            -> { name: 'rehab' }
//   '/pressure-moments'                 -> { name: 'tensest' }  (the season's tensest at-bats by MLB's pressure score;
//                                          '/tensest', its first address, still lands here)
//   '/eliminated'                       -> { name: 'eliminated' }  (games played after elimination)
//   '/infield'                          -> { name: 'infield' }  (team-games with no out to an outfielder, #2976)
//   '/streaks'                          -> { name: 'streaks' }  (N games in a row at a stat total; picks ride the query)
//   '/best-stretch'                     -> { name: 'best-stretch' }  (a hitter's best N games in a row; picks ride the query)
//   '/free-agents'                      -> { name: 'free-agents', season: null }  (the latest class)
//   '/free-agents/{year}'               -> { name: 'free-agents', season: year }
//   '/milestones'                       -> { name: 'milestones' }
//   '/awards'                           -> { name: 'awards-history' }
//   '/postseason-history'               -> { name: 'postseason-history' }
//   '/nine-keys'                        -> { name: 'nine-keys' }
//   '/classics'                         -> { name: 'classics' }  (Score a classic: one old MLB game, dealt on who played, #1525)
//   '/notable'                          -> { name: 'notable' }  (Notable games: no-hitters, cycles, triple plays, #2508)
//   '/postseason-leaders'               -> { name: 'postseason-leaders' }
//   '/postseason-race[/{year}]'         -> { name: 'postseason-race', ... } (parseSeasonRoute)
//   '/postseason-records'               -> { name: 'postseason-records', asOf, season, view, team, category, metric, sort, order }
//   '/postseason/{seriesId}?d='         -> { name: 'postseason-series', seriesId, asOf }
//   '/trade-deadline'                   -> { name: 'trade-deadline-season', season: <latest> }
//   '/trade-deadline/{year}'            -> { name: 'trade-deadline-season', season: year }
//   '/all-star-rosters'                 -> { name: 'all-star-rosters' }
//   '/all-star-legacy'                  -> { name: 'all-star-legacy' }
//   '/standings[/{year}]'               -> { name: 'standings', ... } (parseSeasonRoute)
//   '/salaries' '/attendance' '/pace-of-play' '/farm-system-rankings'
//   '/bullpen-availability' '/doubleheaders' '/abs-challenges' '/run-differential'
//                                       -> single-segment report pages (ROUTE_TABLE, route/table.js)
//   '/fouls'                            -> { name: 'fouls' }
//   '/admin'                            -> { name: 'admin' }  (copy editor, Clerk-admin gated, unlinked)
//   '/admin/research'                   -> { name: 'admin-research' }  (research diary, Clerk-admin gated)
//   '/admin/contenders'                 -> { name: 'admin-contenders' }  (Contender Diary, Clerk-admin gated)
//   '/admin/contracts'                  -> { name: 'admin-contracts' }  (contract-identity review queue, Clerk-admin gated)
//   '/profile'                          -> { name: 'profile' }  (My Tally — your club, this device, your account)
//   '/player/{name-id}'                 -> { name: 'player', id, asOf, sportId }
//   '/player/{name-id}/{stats|analytics|history}[/…]'
//                                       -> + { tab }  (the old tab addresses: the page
//                                          scrolls to the tab's section, #1898; an unknown
//                                          segment is the bare player page)
//   '/team/{name-id}'                   -> { name: 'team', id, asOf, sportId }
//   '/umpire/{name-id}'                 -> { name: 'umpire', id }
//   '/umpires'                          -> { name: 'umpire-rankings' }
//   '/fouls' '/umpires' '/abs-challenges' '/umpire/{name-id}'
//     + '/{year|all}?vs={year}'         -> + { seasonYear, vs }  (a season view; seasons/route.js)
//   '/scout', '/scout/{pitcher}/{hitter}' -> { name: 'scout', ... }  (Matchup Scout; scout/route.js)
//   '/from', '/from/{st}', '/from/college/{slug}', '/from/high-school/{slug}', '/from/{st}/{city}', '/from/country/{country}[/{city}]'
//                                       -> { name: 'from' | 'from-place' | 'from-country', ... }  (Where they're from; from/route.js)
//   '/situational-records'              -> { name: 'situational-records', asOf, sportId, metric, half, month }
//                                          (one situational record, every club at one level, ranked.
//                                           '?metric=' and '?half=' set the page's OPENING state only,
//                                           not a live mirror of its controls — same as standings.)
//   '/manager/{name-id}'                -> { name: 'manager', id }
//   '/scorecard-lab'                    -> { name: 'scorecard-lab' }  (dev only, unlinked)
//   '/identity-lab'                     -> { name: 'identity-lab' }  (dev-only curation lab)
//   '/uniform-names'                    -> { name: 'uniform-names' }  (dev-only curation page)
//   '/game-notes'                       -> { name: 'game-notes', teamId }  (every club's notes PDFs, links only;
//                                          '?team=' opens on one MLB club, 'all' on every club, else the default)
//   '/animation-lab'                    -> { name: 'animation-lab' }  (unlisted QA page)
//   '/design-lab'                       -> { name: 'design-lab' }  (unlisted design-system catalog)
//   '/wire-lab'                         -> { name: 'wire-lab' }  (unlisted wire-template tuning page)
//   '/first-scorebook'                   -> { name: 'first-scorebook' }   (personal retrospective)
//   '/logbook'                           -> { name: 'logbook', season: null }  (your game stamps, newest season)
//   '/logbook?place={gamePk}'            -> { name: 'logbook', placing: gamePk } (book in placement mode)
//   '/logbook/stats'                     -> { name: 'logbook-stats' }          (what the collection adds up to)
//   '/logbook/new'                       -> { name: 'logbook', creating: true } (start a new book, no other book on screen)
//   '/logbook/{season}'                  -> { name: 'logbook', season }        (one season's stamps)
//   '/logbook/book/{bookId}'             -> { name: 'logbook', bookId, season: null }   (a specific named book)
//   '/logbook/book/{bookId}/{season}'    -> { name: 'logbook', bookId, season }
//   '/logbook/book/{bookId}/stats'       -> { name: 'logbook-stats', bookId }  (one book's retrospective)
//   '/photos'                            -> { name: 'photos' }   (high-res game photo finder, unsealed — see root CLAUDE.md)
//   '/photos/{gamePk}'                   -> { name: 'photos', gamePk }   (same page, deep-linked to one game)
//   '/team/{id}/leaders'                -> { name: 'team-leaders', id, asOf, sportId }
//   '/team/{id}/{roster|games|numbers|contracts|minors}'
//                                       -> { name: 'team', id, asOf, sportId, tab }  (a band on the one-scroll page)
//   '/team/{id}/stamp-in'               -> { name: 'team-stamp-in', id, asOf, sportId }
//                                          (a club's played season, every result showing, one
//                                           stamp per game you watched — ADR-0042. NOT a tab.)
//   '/team/{id}/photos'                 -> { name: 'team-photos', id, asOf, sportId }
//   '/team/{id}/photos/games'           -> same, allGames: true (both clubs' photos)
//                                          (professional photos across the season's decided games,
//                                           unsealed like '/photos'. NOT a tab — the Photos rail's own door.)
//   '/team/{id}/transactions'           -> { name: 'team-transactions', id, asOf, sportId }
//                                          (the club's roster moves, whole season.
//                                           NOT a tab — where the home slate's wire sends a reader.)
//   '/team/{id}/franchise'              -> { name: 'team-franchise', id, asOf, sportId }
//                                          (the club across all its seasons, one row a season,
//                                           #2586. NOT a tab: history, so it reads no cutoff.)
//   '/team/{id}/{anything else}'        -> { name: 'team', id, asOf, sportId }
//                                          (an unknown tab lands on the club's page, never a game — #1164)
//   '/leaders'                          -> { name: 'leaders', scope: 'mlb', asOf, sportId }
//   '/leaders/{scope}'                  -> { name: 'leaders', scope, asOf, sportId }
//   '/leaders/org/{orgId}'              -> { name: 'leaders', scope: 'org', orgId, asOf, sportId }
//   '/outliers'                         -> { name: 'outliers', asOf }  (league-wide Standing out; ?d= is the slider's cutoff)
//   '/{MMDDYYYY}/{matchup}/{section}'   -> { name: 'game', date, matchup, section }
//
// Leader-page `scope` is one of mlb/al/nl (league), aaa/aa/aplus/a (level), or
// 'org' with an orgId (a club's whole farm system). See api/leaders.js.
//
// `matchup` is the away + home team abbreviations concatenated and lowercased
// (MIL @ ARI -> 'milari'); `section` is 'lineup1' (away info), 'lineup2' (home
// info), 'boxscore', 'preview' (the shareable preview-image studio), 'sheet'
// (the printable pre-pitch scorecard), 'scorecard' (the live #22 sheet,
// inked as far as the reveal mark), or 'top{n}' / 'bottom{n}' (innings
// viewer, one page per half-inning). Legacy 'inning{n}' links still parse (as
// the top half).
// Example: /07052026/milari/bottom3
//
// A page ABOUT SOMEBODY carries their name in its address: a player, a club, an
// umpire and a manager are all '{slug}-{id}' — '/player/mike-trout-545361',
// '/team/milwaukee-brewers-158/roster'. See entitySegment() (route/segments.js) for the whole
// rule, and ADR-0057 for why the id stays.
//
// Player/team pages are game-independent (resolvable by id on a cold link) and
// show CURRENT stats by default, however you reached them. Two optional hints:
// `?d={officialDate}` shows the page as it stood entering that day, and
// `?s={sportId}` hints the level so the fetch layer can skip a lookup.
//
// `?d=` used to be stamped automatically onto every link out of a started game,
// as a spoiler cutoff. It isn't any more (ADR-0034, "The cutoff is opt-in now")
// — it still parses and still applies, so an already-shared dated link resolves
// the way its sender meant it to, but nothing puts it there for you. Accepts a
// URL that may include a `?query`.

import { NAME_BY_PATH, pathOf } from './route/table.js'
import { buildPath, parsePattern, TEAM_TAB_BAND } from './route/patterns.js'
import { entitySegment, idFromSlug, linkQuery, slugify, teamSegment } from './route/segments.js'
import { parseRecordsRoute } from './postseason/recordsRoute.js'
import { parseFromRoute } from './from/route.js'
import { parseScoutRoute } from './scout/route.js'
import { parseSeasonRoute, seasonPath } from './seasons/route.js'
import { SPORT_IDS } from './teams.js'
import { yearAsOf } from './dates.js'
import {
  WINTER_LEAGUES,
  WINTER_SPORT_ID,
  winterLeagueById,
  winterLeagueBySlug,
} from './winter/leagues.js'

// The slate's league, as a URL prefix. Two things are deliberately missing.
//
// MLB has no slug: the bare '/' IS the MLB slate, the same way a missing date
// IS today (ADR-0056). The home address a reader types, bookmarks or is handed
// therefore says one thing — today's MLB games — for everybody, which is the
// whole reason the league moved into the URL. A '/mlb' prefix would be a second
// address for a page that already has the shortest one in the app.
//
// 'A+' is written 'higha', not 'aplus'. High-A is what the level is called out
// loud, and a shared link is read out loud more often than it is typed. The
// leader board's own scope vocabulary (api/leaders.js) still spells it 'aplus'
// — those are already-shared '/leaders/aplus' links and renaming them would
// break inbound ones for nothing — so 'aplus' is accepted here as an inbound
// alias and never emitted.
export const LEAGUE_SLUG = Object.freeze({
  [SPORT_IDS.AAA]: 'aaa',
  [SPORT_IDS.AA]: 'aa',
  [SPORT_IDS['A+']]: 'higha',
  [SPORT_IDS.A]: 'a',
})
//
// The four winter leagues join this table as FLAT slugs — '/fall', '/mex',
// '/ven', '/dom' — rather than as a nested '/winter/{league}'. A flat slug is
// two segments, so it falls into the branch below that already serves '/aaa'
// and '/aa/08152026' and needs no new parse branch at all; a nested one is
// three segments and would need one, and would collide with the game-route
// shape sitting at that length. Verified against every named single-segment
// route: none of them is 'fall', 'mex', 'ven' or 'dom'.
//
// They all map to sportId 17, so unlike every other row here the sportId does
// NOT name the page on its own. That is what `leagueId` below is for.
const SPORT_ID_BY_SLUG = Object.freeze({
  aaa: SPORT_IDS.AAA,
  aa: SPORT_IDS.AA,
  higha: SPORT_IDS['A+'],
  aplus: SPORT_IDS['A+'], // inbound alias only — see above
  a: SPORT_IDS.A,
  ...Object.fromEntries(WINTER_LEAGUES.map((l) => [l.slug, WINTER_SPORT_ID])),
})

// The '{slug}-{id}' segment rule (ADR-0057) and the `?d=`/`?s=` query live in
// route/segments.js, beside the pattern entries that spell addresses with them.
// Re-exported here so their importers did not change.
export { entitySegment, idFromSlug, linkQuery, slugify, teamSegment, TEAM_TAB_BAND }

// True when the URL is the home slate ('/', '/aaa', '/11042026', unknown paths).
// App.jsx uses it to start the slate's chunk at boot.
export function isSlateUrl(url) {
  return parseRoute(url).name === 'home'
}

// A route-table page (lib/route/table.js) is an exact address, so it is looked
// up first and the hand branches below never see it. test/route-table.test.js
// runs every table address through parseRouteByHand and expects the slate
// fallback, so a hand branch that would also claim one fails there.
//
// Then the pattern entries (route/patterns.js), tried by first segment. Their
// heads are words no hand branch below claims, so trying them first changes no
// precedence; the same test runs a sample of each through parseRouteByHand.
export function parseRoute(url) {
  const [path, query = ''] = (url || '').split('?')
  const parts = path.split('/').filter(Boolean)
  const tabled = NAME_BY_PATH.get('/' + parts.join('/'))
  if (tabled) return { name: tabled }
  const q = new URLSearchParams(query)
  return parsePattern(parts, q, hintsOf(q)) ?? parseRouteByHand(url)
}

// The `?d=`/`?y=` as-of and the `?s=` sportId hint every dated page reads.
// A `?d=` that is not a real calendar date degrades to LIVE, never rides on.
// Every dated loader funnels it into dayBefore(), whose
// `new Date(...).toISOString()` THROWS on an unparseable value, and the throw
// surfaced three different ways: the team hub and /player showed "Couldn't
// load this…", /leaders drew a banner reading "Stats entering Invalid Date",
// and /situational-records rendered a blank page. A regex is not enough —
// '2026-02-30' matches the shape and still makes an Invalid Date — so this
// takes the same calendar-validity check the date picker already uses.
// `?y=2018` is a past season: the same as-of as `?d=2018-12-31`. A real `?d=` wins (#2588).
function hintsOf(q) {
  const raw = q.get('d')
  return {
    asOf: isRealDate(raw) ? raw : yearAsOf(q.get('y')),
    sportId: q.get('s') ? Number(q.get('s')) : null,
  }
}

// Every route the table does not hold. Exported for that test only.
export function parseRouteByHand(url) {
  const [path, query = ''] = (url || '').split('?')
  const parts = path.split('/').filter(Boolean)
  const q = new URLSearchParams(query)
  const { asOf, sportId } = hintsOf(q)
  if (parts.length === 0) return { name: 'home' }
  // A bare 8-digit date is the slate paged to that day ('/07172026') — the
  // home screen, shareable. Every named single-segment route below is
  // non-numeric, so the digit test can safely come first. An impossible
  // calendar date (e.g. '13452026') falls through to today's slate rather
  // than erroring on a hand-mangled link.
  if (parts.length === 1 && /^\d{8}$/.test(parts[0])) {
    const date = urlDateToApi(parts[0])
    return isRealDate(date) ? { name: 'home', date } : { name: 'home' }
  }
  // The same slate, one league deeper: '/aaa' is today's Triple-A games,
  // '/aa/08152026' is that Saturday's Double-A ones. Both segments are
  // optional and both default to the home slate's own answer (MLB, today), so
  // every one of the four addresses names exactly one page — which is what
  // makes the league shareable at all (ADR-0056). No slug collides with a
  // named route: they are all two-to-five letters and every named route below
  // is a word. A second segment that is not a real date degrades to that
  // league's TODAY, the same shrug the bare-date branch above takes.
  if (parts.length <= 2 && SPORT_ID_BY_SLUG[parts[0]]) {
    const sport = SPORT_ID_BY_SLUG[parts[0]]
    const date = parts.length === 2 ? urlDateToApi(parts[1]) : null
    // Four winter leagues share sportId 17, so the slug carries the answer the
    // sportId cannot. Only those slugs put `leagueId` on the route; the five
    // ordinary levels keep the exact object shape they have always returned.
    const winter = winterLeagueBySlug(parts[0])
    const league = winter ? { leagueId: winter.leagueId } : null
    return isRealDate(date)
      ? { name: 'home', date, sportId: sport, ...league }
      : { name: 'home', sportId: sport, ...league }
  }
  const season = parseSeasonRoute(parts, q, { idFromSlug })
  if (season) return season
  if (parts.length === 1 && parts[0] === 'logos') return { name: 'logos' }
  if (parts.length === 1 && parts[0] === 'about') return { name: 'about' }
  // Admin copy editor — the site owner tunes the editable copy here. Not
  // linked from anywhere in the app; reachable by URL and gated to a Clerk
  // admin (see AdminCopy.jsx + api/copy.js). Parsed regardless so a stray
  // production visit renders the (locked) panel rather than falling through to
  // the generic game route.
  if (parts.length === 1 && parts[0] === 'admin') return { name: 'admin' }
  // The guides at /learn are NOT React routes — they are standalone documents
  // rendered by api/page.js, because the crawlers this app wants to reach do not
  // execute JavaScript (see src/copy/landing/render.js). The SPA only ever sees
  // one of these URLs in its EDIT form: the gear on a guide links to
  // '/learn/{slug}?edit', and api/page.js answers that with the app shell so the
  // copy editor can take over at the same address. That is what makes ADR-0044's
  // "edit where it is rendered" work for a page with no bundle on it.
  //
  // Without the ?edit flag this never matches, and it must not: a bare
  // '/learn/{slug}' that reached the client router would render the SPA over a
  // document the server had already produced correctly.
  if (parts.length === 2 && parts[0] === 'learn' && q.has('edit')) {
    return { name: 'admin', focus: `learn.${parts[1]}`, returnTo: `/learn/${parts[1]}` }
  }
  // The two situational-record explorers (see postseason/recordsRoute.js).
  if (parts.length === 1) {
    const records = parseRecordsRoute(parts[0], q, { asOf, sportId })
    if (records) return records
  }
  // Dev-only scorecard harness — parsed and rendered, but linked from nowhere.
  if (parts.length === 1 && parts[0] === 'scorecard-lab')
    return { name: 'scorecard-lab' }
  // Dev-only Team Identity Lab — every dimension of a club's visual identity
  // (MLB treatments, each MiLB level's Home/Away, the WPA band pattern) behind
  // one in-page dimension switcher. Replaced /team-color-lab,
  // /team-color-lab-{aaa,aa,higha,a} and /team-pattern-lab, which were unlisted
  // and linked from nowhere, so there's nothing to redirect.
  if (parts.length === 1 && parts[0] === 'identity-lab')
    return { name: 'identity-lab' }
  if (parts.length === 1 && parts[0] === 'heritage-pass-preview')
    return { name: 'heritage-pass-preview' }
  // Dev-only uniform-name curation page (App.jsx gates the actual component
  // to import.meta.env.DEV, same as scorecard-lab above) — parsed here
  // regardless so a stray production visit falls through to 'home' instead of
  // matching the generic 3-segment game route. Same reason the lab above is
  // still parsed: see ADR-0029's isolation layers.
  if (parts.length === 1 && parts[0] === 'uniform-names')
    return { name: 'uniform-names' }
  const scout = parseScoutRoute(parts, q, { asOf, idFromSlug })
  if (scout) return scout
  const from = parseFromRoute(parts, q) // above the generic 3-segment game branch below
  if (from) return from
  if (parts.length === 3) {
    const [date, matchup, section] = parts
    return {
      name: 'game',
      date,
      matchup: matchup.toLowerCase(),
      section: section.toLowerCase(),
    }
  }
  return { name: 'home' }
}

// section string -> { step, inning, half }. step: 0 away info, 1 home info,
// 2 innings, 3 box score, 4 preview poster, 5 printable sheet, 6 live
// scorecard. `half` only matters for step 2.
export function sectionToStep(section) {
  if (section === 'lineup2') return { step: 1, inning: 1, half: 'top' }
  if (section === 'boxscore') return { step: 3, inning: 1, half: 'top' }
  // The shareable preview image (screens/GamePreview.jsx). A real section so
  // the studio is a link you can send someone, but deliberately NOT one of the
  // four stops the "next" buttons walk — it is a thing you make, not a page in
  // the scorebook.
  if (section === 'preview') return { step: 4, inning: 1, half: 'top' }
  // The printable pre-pitch scorecard (screens/sheet/ScoreSheetPage.jsx), and
  // the same kind of stop as 'preview' above for the same reason: a real,
  // shareable address, because handing the sheet's URL to a phone's share sheet
  // IS how it reaches a printer — but a thing you make, not a page you score, so
  // it stays out of the four the "next" buttons walk.
  if (section === 'sheet') return { step: 5, inning: 1, half: 'top' }
  // The live scorecard (screens/scorecard/ScorecardPage.jsx): the #22 sheet
  // filled exactly as far as the user's own reveal mark. A real, shareable
  // address like the two stops above it, and like them not one of the four
  // steps the "next" buttons walk — but unlike them, it also owns the fifth
  // stop on the game's tab bar (GameView.jsx's sectionTabs), since it's a
  // page you keep coming back to during the game rather than a thing you
  // make once and share.
  if (section === 'scorecard') return { step: 6, inning: 1, half: 'top' }
  // An old Express Lane half (`express-top5`) opens Gameday there: Gameday replaced it (#2566).
  const m = /^(?:express-)?(top|bottom)(\d+)$/.exec(section || '')
  if (m) return { step: 2, inning: Math.max(1, Number(m[2])), half: m[1] }
  const legacy = /^inning(\d+)$/.exec(section || '')
  if (legacy) return { step: 2, inning: Math.max(1, Number(legacy[1])), half: 'top' }
  return { step: 0, inning: 1, half: 'top' } // lineup1 / anything unknown
}

// The canonical half section ('top5') for an old one that still opens a half ('express-top5',
// 'inning4'), or null when the section is already canonical or names no half. GameView replaces
// the address with it once, so an old link ends on the address the app itself writes.
export function canonicalSection(section) {
  const { step, inning, half } = sectionToStep(section)
  if (step !== 2) return null
  const canonical = stepToSection(2, inning, half)
  return canonical === section ? null : canonical
}

// step (+ inning/half for the innings viewer) -> section string.
export function stepToSection(step, inning = 1, half = 'top') {
  if (step === 0) return 'lineup1'
  if (step === 1) return 'lineup2'
  if (step === 3) return 'boxscore'
  if (step === 4) return 'preview'
  if (step === 5) return 'sheet'
  if (step === 6) return 'scorecard'
  return `${half === 'bottom' ? 'bottom' : 'top'}${inning}`
}

// URL date (MMDDYYYY) <-> API date (YYYY-MM-DD).
export function urlDateToApi(d) {
  if (!/^\d{8}$/.test(d)) return null
  return `${d.slice(4, 8)}-${d.slice(0, 2)}-${d.slice(2, 4)}`
}
export function apiDateToUrl(api) {
  const [y, m, d] = (api || '').split('-')
  return `${m}${d}${y}`
}

// Whether a string is a real calendar date IN THE API'S OWN SHAPE. Two checks,
// and both earn their place: the round-trip catches out-of-range months/days
// ('2026-13-45', '2026-02-30') that a digit-count regex lets through, and the
// regex catches an unpadded date ('2026-7-5') that names a real day but is not
// what the feed writes — `new Date('2026-7-5T00:00:00Z')` is an Invalid Date,
// so anything that passed it on would throw a step later.
function isRealDate(api) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(api ?? '')) return false
  const [y, m, d] = (api || '').split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

// The slate's own address: league first, day second, and each segment present
// only when it is not the default. `apiDate` is null for today (GameSelect
// passes null rather than today's date), `sportId` defaults to MLB — so the
// canonical home slate is the bare '/' and never grows a redundant suffix.
// `leagueId` only means anything for sportId 17, where four leagues share the
// one sportId and LEAGUE_SLUG therefore cannot name the page. Without it every
// winter league would build the same URL, and a picker that changed the league
// without changing the address would break ADR-0056's rule that every slate day
// is a shareable address. An unknown or absent leagueId on sportId 17 degrades
// to the bare home slate rather than minting '/undefined'.
export function slatePath(apiDate, sportId = SPORT_IDS.MLB, leagueId = null) {
  const winter =
    Number(sportId) === WINTER_SPORT_ID ? winterLeagueById(leagueId)?.slug : null
  const slug = winter ?? LEAGUE_SLUG[sportId]
  const league = slug ? `/${slug}` : ''
  const day = apiDate ? `/${apiDateToUrl(apiDate)}` : ''
  return `${league}${day}` || '/'
}

// Doubleheaders: both games share a date and matchup, so game 2 (and beyond)
// carries a '-2' suffix ('milstl-2') to keep the two URLs distinct. Game 1
// stays bare, so every pre-existing link still parses and resolves unchanged.
export function matchupSlug(awayAbbr, homeAbbr, gameNumber = 1) {
  const base = `${(awayAbbr || '').toLowerCase()}${(homeAbbr || '').toLowerCase()}`
  return gameNumber > 1 ? `${base}-${gameNumber}` : base
}

// Build the path for a game section. `apiDate` is YYYY-MM-DD.
export function gamePath(apiDate, awayAbbr, homeAbbr, section, gameNumber = 1) {
  return `/${apiDateToUrl(apiDate)}/${matchupSlug(awayAbbr, homeAbbr, gameNumber)}/${section}`
}

// `name` joins `d`/`s` as an optional hint on every one of these: it changes
// only the SPELLING of the address, never which page it opens, so a caller that
// hasn't loaded the name yet builds a working link without it.
//
// Every builder below that has a pattern entry (route/patterns.js) is a
// one-liner over it; `hinted` turns the `{ name, d, s }` options these have
// always taken into the entry's route-shaped params.
const hinted = (opts = {}) => ({ slugName: opts.name, asOf: opts.d, sportId: opts.s })
export function playerPath(id, opts = {}) {
  return buildPath('player', { id, ...hinted(opts) })
}
export function teamPath(id, opts = {}) {
  return buildPath('team', { id, ...hinted(opts) })
}
// The Game Notes archive, bare or opened on one club (or 'all').
export function gameNotesPath(teamId = null) {
  return buildPath('game-notes', { teamId })
}

export function postseasonSeriesPath(seriesId) {
  return buildPath('postseason-series', { seriesId })
}
export function postseasonLivePath(seriesId, cutoffDate = null) {
  return buildPath('postseason-series', { seriesId, asOf: cutoffDate })
}
// Which page one /postseason/{id} address opens. The finished page only with
// no `?d=` and an id postseason-history.json holds (the link seriesHref below
// builds for a decided series); the live page, heading into `?d=` or today,
// for everything else. `historyIds`: Set or array.
export function seriesPageFor(seriesId, asOf, historyIds) {
  const ids = historyIds instanceof Set ? historyIds : new Set(historyIds ?? [])
  return !asOf && ids.has(seriesId) ? 'finished' : 'live'
}
// Where a bracket series links. The finished page reads only
// postseason-history.json, which gets a season after its World Series, by a
// hand-run script (trap 7). So: the finished page when the series was decided
// before the cutoff AND that file holds its id; the live page otherwise. A
// series with an empty slot has no id and no link. `historyIds`: Set or array.
export function seriesHref(series, cutoffDate, historyIds) {
  if (!series?.id) return null
  const ids = historyIds instanceof Set ? historyIds : new Set(historyIds ?? [])
  return series.decided && ids.has(series.id)
    ? postseasonSeriesPath(series.id)
    : postseasonLivePath(series.id, cutoffDate)
}
// Where a game page's series band links (GameView): the LIVE page heading into
// the game's own date, never the finished page. The finished page shows how
// the series ended, and the game on screen can be the game that ended it.
// Null with no series id (an empty slot, a bracket still loading) or no date.
export function gameSeriesHref(series, officialDate) {
  return series?.id && officialDate ? postseasonLivePath(series.id, officialDate) : null
}
export function tradeDeadlinePath() {
  return buildPath('trade-deadline-season')
}
export function tradeDeadlineSeasonPath(year) {
  return buildPath('trade-deadline-season', { season: year })
}
export function umpirePath(id, name, season = {}) {
  return seasonPath(`/umpire/${entitySegment(id, name)}`, season)
}
export function umpireRankingsPath(season = {}) {
  return seasonPath(pathOf('umpire-rankings'), season)
}
// The league-wide view of ONE situational record. `metric` is a row id from
// teamRecords.js's RECORD_GROUPS / COUNT_METRICS, `half` a HALVES key — this is
// how every row of the Numbers tab's Records card opens its own ranking. Built
// on top of linkQuery so the `?d=`/`?s=` hints stay identical to every other
// link's, rather than a second hand-built query that could drift from theirs.
export function situationalRecordsPath({ category, metric, half, month, sort, order, ...opts } = {}) {
  const base = linkQuery(opts)
  const q = new URLSearchParams(base.slice(1))
  if (category) q.set('category', category)
  if (metric) q.set('metric', metric)
  if (half && half !== 'all') q.set('half', half)
  // A calendar month, 1-12. The fourth scope lever beside the level and the
  // All-Star half; absent means the whole season, so it never rides along on a
  // link that did not ask for it.
  if (month) q.set('month', String(month))
  if (sort && sort !== 'pct') q.set('sort', sort)
  if (order === 'asc' || order === 'desc') q.set('order', order)
  const qs = q.toString()
  return `/situational-records${qs ? `?${qs}` : ''}`
}
export function managerPath(id, name) {
  return buildPath('manager', { id, slugName: name })
}
export function foulsPath(season = {}) {
  return seasonPath(pathOf('fouls'), season)
}
// The league run value board. No arguments: the role filter and the club filter
// are page state, not an address, the same call StandingsPage and the four
// broadcast reports already made (see lib/route/table.js).
export function runValuePath(opts = {}) {
  return `${pathOf('run-value')}${linkQuery(opts)}`
}
// The league ABS challenge board, for the same reason and with the same shape:
// the level chip and every board's sort are page state, not an address.
export function absChallengesPath(season = {}) {
  return seasonPath(pathOf('abs-challenges'), season)
}
export function gamePhotosPath(gamePk) {
  return buildPath('photos', { gamePk })
}
// The Logbook, optionally paged to one season. A bare `/logbook` lets the page
// pick the newest season the local collection actually has.
export function logbookPath(season = null) {
  return buildPath('logbook', { season })
}
// The retrospective over the whole collection — deliberately not season-paged,
// so 'stats' can never collide with a season segment.
export function logbookStatsPath() {
  return buildPath('logbook-stats')
}
// Starting a new book — its own page, so no other book is on screen while you
// decide what one looks like. Optionally carrying a stamp, for the same reason
// every other Logbook path can: you may start a book in order to put THIS
// keepsake in it, and the flow must not drop it on the way.
export function logbookNewPath(gamePk = null) {
  return buildPath('logbook', { creating: true, placing: gamePk || null })
}
// A specific named book (ADR-0036's shelf), optionally paged to one season —
// the additive counterpart to logbookPath() for a user with more than one
// book. `DEFAULT_BOOK_ID` is a legitimate argument here, but only through
// lib/logbookNav.js, which owns the one rule for choosing between the two
// addresses that book can have; read that file's header before building
// either by hand.
export function bookPath(bookId, season = null) {
  return buildPath('logbook', { bookId, season })
}
// The retrospective over one specific book, additive counterpart to
// logbookStatsPath().
export function bookStatsPath(bookId) {
  return buildPath('logbook-stats', { bookId })
}
// The book, opened in placement mode for one freshly minted stamp. See the
// `?place=` note on the logbook entry in route/patterns.js for why this is a query rather than a route.
export function logbookPlacePath(gamePk) {
  return buildPath('logbook', { placing: gamePk })
}
// My Tally. A fixed address with no parameters — same reasoning as /logbook
// (docs/game-log.md §2): the URL outlives any redirect we would maintain, so it
// never changes even if the destination is renamed again.
export function profilePath() {
  return pathOf('profile')
}
export function teamLeadersPath(id, opts = {}) {
  return buildPath('team-leaders', { id, ...hinted(opts) })
}
// A team address by its old tab segment ('roster' / 'games' / 'numbers' / 'contracts' /
// 'minors' / 'leaders'), plus 'overview' for the bare '/team/{id}'. An old tab segment
// parses to the one-scroll page on that band. Goes through linkQuery like every other team
// link, so a dated page keeps `?d=`/`?s=`.
// One club season's page (#2779): the page's own as-of season keeps that date (`?d=`), any other
// past season is `?y=`, and the current season is the bare page. `now` is for tests.
export function teamSeasonPath(id, season, { name, asOf, now = new Date() } = {}) {
  const d = asOf && Number(asOf.slice(0, 4)) === season ? asOf : yearAsOf(String(season), now)
  return teamPath(id, { name, d })
}
export function teamTabPath(id, tab, opts = {}) {
  return tab === 'overview'
    ? teamPath(id, opts)
    : buildPath('team', { id, tab, ...hinted(opts) })
}
// Stamp In — the club's played season, one stamp per game you watched
// (ADR-0042). Built in exactly one place, the Schedule card's button on the
// Games tab, and carried through linkQuery like every other team link so a
// dated visit stays dated across the hop. Do not build a second entry point.
export function teamStampInPath(id, opts = {}) {
  return buildPath('team-stamp-in', { id, ...hinted(opts) })
}
// A club's professional photos, merged across its whole season (unsealed,
// same footing as gamePhotosPath). Built in exactly one place today — the
// Photos rail's own "Full season" door — and carried through linkQuery like
// every other team link.
export function teamPhotosPath(id, opts = {}) {
  return buildPath('team-photos', { id, ...hinted(opts) })
}
// Every photo from the club's games, both clubs (TeamPhotosPage's other mode).
export function teamGamePhotosPath(id, opts = {}) {
  return buildPath('team-photos', { id, allGames: true, ...hinted(opts) })
}
// A club's roster moves for the whole season (a move carries no score). Built
// in two places: the club's own Transactions deck, and every club chip on the
// home slate's wire.
export function teamTransactionsPath(id, opts = {}) {
  return buildPath('team-transactions', { id, ...hinted(opts) })
}
// The league-wide Standing out page; `d` is the slider's cutoff, none for the latest night.
export function outliersPath(opts = {}) {
  return buildPath('outliers', hinted(opts))
}
// The broader leader pages. `mlb` is the bare `/leaders` (the top-level entry);
// every other league/level scope carries its key. Org leaders take a club id.
export function leadersPath(scope = 'mlb', opts = {}) {
  return buildPath('leaders', { scope, ...hinted(opts) })
}
// A farm system's leader board is a page about a CLUB, so its address names one
// the same way '/team/...' does — teamSegment, not entitySegment, so the org
// names itself off the static table without the caller passing anything.
export function orgLeadersPath(orgId, opts = {}) {
  return buildPath('leaders', { scope: 'org', orgId, ...hinted(opts) })
}
