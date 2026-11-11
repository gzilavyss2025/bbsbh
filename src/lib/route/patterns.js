// THE ROUTE TABLE, PART TWO: the pages whose address carries an id, a year, a
// slug or a query (#3034). Part one (table.js) holds the exact addresses.
//
// An entry:
//   name   the route name its parse returns (App.jsx keys its screen on it)
//   head   the first path segment; parseRoute tries only the entries whose
//          head matches, in this array's order, and the first non-null wins
//   parse  (parts, q, { asOf, sportId }) -> the route object, or null when the
//          address is not this page (null falls through to the hand-written
//          shapes in lib/route.js, and from there to the game route)
//   build  (route-shaped params) -> the address. `parse(build(r))` deep-equals
//          `r` (test/route-table.test.js). A `slugName` param is the name a
//          '{slug}-{id}' segment spells; it changes the spelling only, so parse
//          does not return it. An id-like param (bookId, gamePk, orgId, a
//          trade-deadline season) counts as given when its KEY is present, even
//          if its value is not: a book whose id has not loaded must build a
//          broken book address, never the default book's (#3052 review).
//
// ORDER MATTERS WITHIN A HEAD: the specific '/team/{id}/{page}' entries come
// before 'team', whose parse takes any other third segment (#1164), and
// 'logbook-stats' comes before 'logbook', whose season branch would read
// 'stats' as a bad year.
//
// Still parsed by hand in lib/route.js, and why:
//   - the slates ('/', '/{MMDDYYYY}', '/{league}[/{MMDDYYYY}]') and the game
//     route ('/{MMDDYYYY}/{matchup}/{section}'): their first segment is a value,
//     not a word, so they have no head; they are the fallback shapes.
//   - the season views, '/umpire/{id}' among them (seasons/route.js), '/scout',
//     '/from', the two records pages and '/learn/{slug}?edit': each already has
//     its own parser module, called in order from the hand parser.
//
// Pure, no React: the node unit suite imports this.

import { entitySegment, idFromSlug, linkQuery, teamSegment } from './segments.js'

// Newest SEASONS year in api/tradeDeadline.js. test/route.test.js checks that
// '/trade-deadline' parses to SEASONS' newest year, so a stale value fails there.
const LATEST_TRADE_DEADLINE_SEASON = 2026

// The old player-hub tab addresses (#1898). The tabs are gone: each opens the one
// player page, which scrolls to the tab's section, so every shared link still works.
// Any other segment is the bare page; a fourth one (the old '/analytics/{year}') is
// dropped, and the tab it hangs off is kept.
const PLAYER_OLD_TABS = new Set(['stats', 'analytics', 'history'])

// Where each old team tab address lands on the one-scroll team page (ADR-0082, #1107).
// `/numbers` lands on Standings, where the Numbers tab's lead content went.
export const TEAM_TAB_BAND = {
  roster: 'roster',
  games: 'games',
  numbers: 'standings',
  contracts: 'money',
  minors: 'farm',
}

// A Logbook season segment, or null: a non-numeric or out-of-range one falls back
// to the bare page rather than stranding it on a season that cannot exist.
function bookSeason(seg) {
  const season = Number(seg)
  return Number.isInteger(season) && season >= 1876 && season <= 2200 ? season : null
}

// A `?place=` gamePk, or null. Deliberately strict: a mangled value drops the
// mode rather than putting the book into placement for a game that isn't real.
function toGamePkParam(value) {
  if (!value || !/^\d+$/.test(value)) return null
  const pk = Number(value)
  return Number.isInteger(pk) && pk > 0 ? pk : null
}

const hints = (r) => linkQuery({ d: r.asOf, s: r.sportId })
const team = (r) => `/team/${teamSegment(r.id, r.slugName)}`

// One standalone '/team/{id}/{sub}' page. NOT a tab: each has its own door.
// Stamp In (ADR-0042): the played season, one stamp per game you watched.
// Photos: the club's professional photos across its season (unsealed).
// Transactions: the roster moves, where the home slate's wire sends a reader.
// Franchise (#2763): the club across all its seasons. Leaders: the club's board.
function teamPage(name, sub) {
  return {
    name,
    head: 'team',
    parse: (p, q, { asOf, sportId }) =>
      p.length === 3 && p[2] === sub ? { name, id: idFromSlug(p[1]), asOf, sportId } : null,
    build: (r) => `${team(r)}/${sub}${hints(r)}`,
  }
}

export const PATTERN_ROUTES = [
  {
    name: 'player',
    head: 'player',
    // '/player/{name-id}', and the old tab addresses '/player/{id}/{tab}[/…]'.
    parse: (p, q, { asOf, sportId }) =>
      p.length >= 2 && p.length <= 4
        ? {
            name: 'player',
            id: idFromSlug(p[1]),
            asOf,
            sportId,
            ...(p.length > 2 && PLAYER_OLD_TABS.has(p[2]) && { tab: p[2] }),
          }
        : null,
    build: (r) => `/player/${entitySegment(r.id, r.slugName)}${r.tab ? `/${r.tab}` : ''}${hints(r)}`,
  },
  teamPage('team-stamp-in', 'stamp-in'),
  teamPage('team-transactions', 'transactions'),
  teamPage('team-franchise', 'franchise'),
  teamPage('team-leaders', 'leaders'),
  {
    // '/team/{id}/photos', and '/team/{id}/photos/games' for both clubs' photos.
    name: 'team-photos',
    head: 'team',
    parse: (p, q, { asOf, sportId }) => {
      if (p[2] !== 'photos') return null
      const page = { name: 'team-photos', id: idFromSlug(p[1]), asOf, sportId }
      if (p.length === 3) return page
      return p.length === 4 && p[3] === 'games' ? { ...page, allGames: true } : null
    },
    build: (r) => `${team(r)}/photos${r.allGames ? '/games' : ''}${hints(r)}`,
  },
  {
    // '/team/{name-id}'. An old tab address ('/team/{id}/roster', or the same
    // five behind '/team/{id}/next/') lands on that tab's band (#1107). An unknown
    // third segment lands on the bare page, never a game (#1164).
    name: 'team',
    head: 'team',
    parse: (p, q, { asOf, sportId }) => {
      const page = { name: 'team', id: idFromSlug(p[1]), asOf, sportId }
      if (p.length === 2) return page
      if (p.length === 3) return Object.hasOwn(TEAM_TAB_BAND, p[2]) ? { ...page, tab: p[2] } : page
      if (p.length === 4 && p[2] === 'next')
        return Object.hasOwn(TEAM_TAB_BAND, p[3]) ? { ...page, tab: p[3] } : page
      return null
    },
    build: (r) => `${team(r)}${r.tab ? `/${r.tab}` : ''}${hints(r)}`,
  },
  {
    // Managers carry no as-of hint: a coaching record is never score-revealing.
    name: 'manager',
    head: 'manager',
    parse: (p) => (p.length === 2 ? { name: 'manager', id: idFromSlug(p[1]) } : null),
    build: (r) => `/manager/${entitySegment(r.id, r.slugName)}`,
  },
  {
    // '/leaders' is MLB; '/leaders/{scope}' a league or level; '/leaders/org/{id}'
    // a club's farm system, named like a '/team/' address (teamSegment).
    name: 'leaders',
    head: 'leaders',
    parse: (p, q, { asOf, sportId }) => {
      if (p.length === 1) return { name: 'leaders', scope: 'mlb', asOf, sportId }
      if (p.length === 2) return { name: 'leaders', scope: p[1].toLowerCase(), asOf, sportId }
      if (p.length === 3 && p[1] === 'org')
        return { name: 'leaders', scope: 'org', orgId: Number(idFromSlug(p[2])), asOf, sportId }
      return null
    },
    build: (r) => {
      if (r.scope === 'org' && 'orgId' in r) return `/leaders/org/${teamSegment(r.orgId, r.slugName)}${hints(r)}`
      return `${!r.scope || r.scope === 'mlb' ? '/leaders' : `/leaders/${r.scope}`}${hints(r)}`
    },
  },
  {
    // League-wide Standing out; `?d=` is the slider's cutoff.
    name: 'outliers',
    head: 'outliers',
    parse: (p, q, { asOf }) => (p.length === 1 ? { name: 'outliers', asOf } : null),
    build: (r) => `/outliers${hints(r)}`,
  },
  {
    // A series id ('2025-division-112-158') matches postseason-history.json's own
    // `series.id`. One address for both series pages; seriesPageFor picks the
    // page. `?d=` is the cutoff the live page shows the series heading into.
    name: 'postseason-series',
    head: 'postseason',
    parse: (p, q, { asOf }) =>
      p.length === 2 ? { name: 'postseason-series', seriesId: p[1], asOf } : null,
    build: (r) => `/postseason/${r.seriesId}${linkQuery({ d: r.asOf })}`,
  },
  {
    // '/free-agents' is the latest class; '/free-agents/{year}' one season's.
    name: 'free-agents',
    head: 'free-agents',
    parse: (p) =>
      p.length <= 2
        ? { name: 'free-agents', season: p.length === 2 && /^\d{4}$/.test(p[1]) ? Number(p[1]) : null }
        : null,
    build: (r) => (r.season ? `/free-agents/${r.season}` : '/free-agents'),
  },
  {
    // The year matches public/data/trade-deadline/{year}.json. A non-numeric
    // segment falls back to the latest season.
    name: 'trade-deadline-season',
    head: 'trade-deadline',
    parse: (p) => {
      if (p.length > 2) return null
      const season = p.length === 2 ? Number(p[1]) : NaN
      return { name: 'trade-deadline-season', season: Number.isFinite(season) ? season : LATEST_TRADE_DEADLINE_SEASON }
    },
    build: (r) => (!('season' in r) ? '/trade-deadline' : `/trade-deadline/${r.season}`),
  },
  {
    // The Game Notes archive (#1258). `?team=` is one MLB club, 'all' every
    // club; anything else is the page's default.
    name: 'game-notes',
    head: 'game-notes',
    parse: (p, q) => {
      if (p.length !== 1) return null
      if (q.get('team') === 'all') return { name: 'game-notes', teamId: 'all' }
      const id = Number(q.get('team'))
      return { name: 'game-notes', teamId: Number.isInteger(id) && id > 0 ? id : null }
    },
    build: (r) => (r.teamId ? `/game-notes?team=${r.teamId}` : '/game-notes'),
  },
  {
    // High-res game photo finder, unsealed. '/photos/{gamePk}' deep-links one
    // game's gallery; a non-numeric segment is the plain browse view.
    name: 'photos',
    head: 'photos',
    parse: (p) => {
      if (p.length === 1) return { name: 'photos' }
      if (p.length !== 2) return null
      const gamePk = Number(p[1])
      return Number.isFinite(gamePk) ? { name: 'photos', gamePk } : { name: 'photos' }
    },
    build: (r) => (!('gamePk' in r) ? '/photos' : `/photos/${r.gamePk}`),
  },
  {
    // The Logbook retrospective (ADR-0035): '/logbook/stats' for the whole
    // collection, '/logbook/book/{bookId}/stats' for one book. Above 'logbook'.
    name: 'logbook-stats',
    head: 'logbook',
    parse: (p) => {
      if (p.length === 2 && p[1] === 'stats') return { name: 'logbook-stats' }
      if (p.length === 4 && p[1] === 'book' && p[3] === 'stats')
        return { name: 'logbook-stats', bookId: p[2] }
      return null
    },
    build: (r) => (!('bookId' in r) ? '/logbook/stats' : `/logbook/book/${r.bookId}/stats`),
  },
  {
    // The Logbook (ADR-0035): this user's game stamps, scores plain because a
    // stamp exists only for a game its owner finished revealing. `season: null`
    // is "the newest season you have", resolved by the page. '/logbook/new'
    // starts a book; '/logbook/book/{bookId}[/{season}]' is a named book
    // (ADR-0036). `?place={gamePk}` is placement mode for one stamp, a transient
    // mode of the page, so a query and not a route name.
    name: 'logbook',
    head: 'logbook',
    parse: (p, q) => {
      const placing = toGamePkParam(q.get('place'))
      if (p.length === 1) return { name: 'logbook', season: null, placing }
      if (p.length === 2 && p[1] === 'new')
        return { name: 'logbook', creating: true, season: null, placing }
      if (p.length === 2) return { name: 'logbook', season: bookSeason(p[1]), placing }
      if (p[1] !== 'book') return null
      if (p.length === 3) return { name: 'logbook', bookId: p[2], season: null, placing }
      if (p.length === 4) return { name: 'logbook', bookId: p[2], season: bookSeason(p[3]), placing }
      return null
    },
    build: (r) => {
      const base = r.creating
        ? '/logbook/new'
        : `${!('bookId' in r) ? '/logbook' : `/logbook/book/${r.bookId}`}${r.season ? `/${r.season}` : ''}`
      return r.placing == null ? base : `${base}?place=${Number(r.placing)}`
    },
  },
]

const BY_NAME = new Map(PATTERN_ROUTES.map((r) => [r.name, r]))

// The address of a pattern route. Throws on an unknown name, like pathOf.
export function buildPath(name, params = {}) {
  const entry = BY_NAME.get(name)
  if (!entry) throw new Error(`No pattern route named '${name}'`)
  return entry.build(params)
}

// The route a pattern entry parses this address to, or null.
export function parsePattern(parts, q, ctx) {
  for (const entry of PATTERN_ROUTES) {
    if (entry.head !== parts[0]) continue
    const route = entry.parse(parts, q, ctx)
    if (route) return route
  }
  return null
}
