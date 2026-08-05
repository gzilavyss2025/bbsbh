// Unit coverage for the routing layer (src/lib/route.js) — 230 lines of pure,
// order-sensitive parsing that was previously untested. parseRoute's branch
// ordering is load-bearing (its own comments warn "must come BEFORE the generic
// game branch"), and it decides whether a link carries the spoiler-safe cutoff
// (`?d=` / `?s=`) onto a player/team page. A parse regression silently
// misroutes or drops that cutoff, so the branches and the path round-trips are
// worth pinning.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseRoute,
  sectionToStep,
  stepToSection,
  urlDateToApi,
  apiDateToUrl,
  slatePath,
  matchupSlug,
  gamePath,
  playerPath,
  teamPath,
  teamTabPath,
  leadersPath,
  orgLeadersPath,
  teamLeadersPath,
  umpirePath,
  gamePhotosPath,
  logbookPath,
  logbookStatsPath,
  logbookPlacePath,
} from '../src/lib/route.js'

// --------------------------------------------------------------------------
// parseRoute — home / slate
// --------------------------------------------------------------------------
test('the bare root and empty input are the home slate', () => {
  assert.deepEqual(parseRoute('/'), { name: 'home' })
  assert.deepEqual(parseRoute(''), { name: 'home' })
  assert.deepEqual(parseRoute(undefined), { name: 'home' })
})

test('a bare 8-digit path is the slate paged to that day', () => {
  assert.deepEqual(parseRoute('/07052026'), { name: 'home', date: '2026-07-05' })
})

// The five routes the Team Identity Lab replaced were unlisted and linked from
// nowhere, so they were dropped outright rather than redirected. A stale
// bookmark must land on the slate — never on the generic game route, which
// would try to resolve 'team-color-lab' as a date.
test('the retired lab routes fall through to the home slate', () => {
  for (const stale of [
    '/team-color-lab',
    '/team-color-lab-aaa',
    '/team-color-lab-aa',
    '/team-color-lab-higha',
    '/team-color-lab-a',
    '/team-pattern-lab',
  ]) {
    assert.deepEqual(parseRoute(stale), { name: 'home' }, stale)
  }
})

test('an impossible calendar date falls through to today rather than erroring', () => {
  // '13452026' is 8 digits but not a real date — no `date`, just today's slate.
  assert.deepEqual(parseRoute('/13452026'), { name: 'home' })
  assert.deepEqual(parseRoute('/02302026'), { name: 'home' }) // Feb 30
})

// --------------------------------------------------------------------------
// parseRoute — the standalone named pages
// --------------------------------------------------------------------------
test('single-segment named routes resolve to their route name', () => {
  const cases = {
    '/logos': 'logos',
    '/about': 'about',
    '/prospects': 'prospects',
    '/rehab': 'rehab',
    '/milestones': 'milestones',
    '/awards': 'awards-history',
    '/postseason-history': 'postseason-history',
    '/postseason-leaders': 'postseason-leaders',
    '/all-star-rosters': 'all-star-rosters',
    '/all-star-legacy': 'all-star-legacy',
    '/standings': 'standings',
    '/admin': 'admin',
    '/umpires': 'umpire-rankings',
    '/scorecard-lab': 'scorecard-lab',
    '/identity-lab': 'identity-lab',
    '/uniform-names': 'uniform-names',
    '/game-notes-debug': 'game-notes-debug',
    '/wordmark-lab': 'wordmark-lab',
    '/first-scorebook': 'first-scorebook',
    '/photos': 'photos',
  }
  for (const [path, name] of Object.entries(cases)) {
    assert.equal(parseRoute(path).name, name, path)
  }
})

// --------------------------------------------------------------------------
// parseRoute — id pages and the spoiler-cutoff query
// --------------------------------------------------------------------------
test('player and team routes carry the id plus the optional cutoff hints', () => {
  assert.deepEqual(parseRoute('/player/12345'), {
    name: 'player',
    id: '12345',
    asOf: null,
    sportId: null,
  })
  assert.deepEqual(parseRoute('/player/12345?d=2026-07-05&s=11'), {
    name: 'player',
    id: '12345',
    asOf: '2026-07-05',
    sportId: 11,
  })
  assert.deepEqual(parseRoute('/team/158?d=2026-07-05'), {
    name: 'team',
    id: '158',
    asOf: '2026-07-05',
    sportId: null,
  })
})

test('umpire and manager routes carry no cutoff query (never score-revealing)', () => {
  assert.deepEqual(parseRoute('/umpire/427'), { name: 'umpire', id: '427' })
  assert.deepEqual(parseRoute('/manager/999'), { name: 'manager', id: '999' })
  assert.deepEqual(parseRoute('/postseason/2025-division-112-158'), {
    name: 'postseason-series',
    seriesId: '2025-division-112-158',
  })
})

test('trade deadline routes: index, per-season, and a non-numeric season falls back to the index', () => {
  assert.deepEqual(parseRoute('/trade-deadline'), { name: 'trade-deadline' })
  assert.deepEqual(parseRoute('/trade-deadline/2022'), {
    name: 'trade-deadline-season',
    season: 2022,
  })
  assert.deepEqual(parseRoute('/trade-deadline/nope'), { name: 'trade-deadline' })
})

// --------------------------------------------------------------------------
// parseRoute — leaders scopes (the ordering-sensitive branches)
// --------------------------------------------------------------------------
test('leaders scopes resolve, lowercasing the scope key', () => {
  assert.deepEqual(parseRoute('/leaders'), { name: 'leaders', scope: 'mlb', asOf: null, sportId: null })
  assert.deepEqual(parseRoute('/leaders/AL'), { name: 'leaders', scope: 'al', asOf: null, sportId: null })
  assert.deepEqual(parseRoute('/leaders/org/158'), {
    name: 'leaders',
    scope: 'org',
    orgId: 158,
    asOf: null,
    sportId: null,
  })
})

test('the 3-segment leaders/team branches win over the generic game branch', () => {
  // '/leaders/org/158' and '/team/158/leaders' are both 3-segment paths that a
  // naive game parse (date/matchup/section) would otherwise swallow.
  assert.equal(parseRoute('/leaders/org/158').name, 'leaders')
  assert.deepEqual(parseRoute('/team/158/leaders'), {
    name: 'team-leaders',
    id: '158',
    asOf: null,
    sportId: null,
  })
})

// --------------------------------------------------------------------------
// teamTabPath / parseRoute — the team hub's five tabs
// --------------------------------------------------------------------------
test('teamTabPath builds each tab path and carries the spoiler cutoff through', () => {
  assert.equal(teamTabPath(158, 'overview'), '/team/158')
  assert.equal(teamTabPath(158, 'roster'), '/team/158/roster')
  assert.equal(teamTabPath(158, 'games'), '/team/158/games')
  assert.equal(teamTabPath(158, 'numbers'), '/team/158/numbers')
  assert.equal(teamTabPath(158, 'minors'), '/team/158/minors')
  assert.equal(teamTabPath(158, 'leaders'), '/team/158/leaders')
  // The spoiler-relevant case: a tab switch must reproduce the same ?d=/?s=
  // a dated team link arrived with — dropping either would show a visitor
  // mid-scoring stats past the half-inning they've reached (PRD non-negotiable 1).
  assert.equal(
    teamTabPath(158, 'roster', { d: '2026-07-05', s: 11 }),
    '/team/158/roster?d=2026-07-05&s=11',
  )
  assert.equal(
    teamTabPath(158, 'overview', { d: '2026-07-05', s: 11 }),
    '/team/158?d=2026-07-05&s=11',
  )
})

test('parseRoute resolves all five team-hub tab URLs, carrying the cutoff query', () => {
  for (const tab of ['roster', 'games', 'numbers', 'minors']) {
    assert.deepEqual(
      parseRoute(`/team/158/${tab}`),
      { name: `team-${tab}`, id: '158', asOf: null, sportId: null },
      tab,
    )
  }
  assert.deepEqual(parseRoute('/team/158/leaders'), {
    name: 'team-leaders',
    id: '158',
    asOf: null,
    sportId: null,
  })
  assert.deepEqual(parseRoute('/team/158'), { name: 'team', id: '158', asOf: null, sportId: null })
  assert.deepEqual(parseRoute('/team/158/roster?d=2026-07-05&s=11'), {
    name: 'team-roster',
    id: '158',
    asOf: '2026-07-05',
    sportId: 11,
  })
})

test('a team tab segment is not mistaken for a date-first game route', () => {
  // The ordering trap route.js's own header warns about: '/team/{id}/roster' is
  // 3 segments, the same shape as '/{date}/{matchup}/{section}'. The
  // TEAM_TAB_ROUTES branch must be checked before the generic game branch, or
  // this parses as a bogus game with date='team', matchup='158', section='roster'.
  assert.deepEqual(parseRoute('/team/158/roster'), {
    name: 'team-roster',
    id: '158',
    asOf: null,
    sportId: null,
  })
})

// --------------------------------------------------------------------------
// parseRoute — game sections
// --------------------------------------------------------------------------
test('a 3-segment path is a game section, matchup and section lowercased', () => {
  assert.deepEqual(parseRoute('/07052026/MILari/Bottom3'), {
    name: 'game',
    date: '07052026',
    matchup: 'milari',
    section: 'bottom3',
  })
})

// --------------------------------------------------------------------------
// sectionToStep / stepToSection — the innings-viewer paging
// --------------------------------------------------------------------------
test('sectionToStep maps each section form to its step/inning/half', () => {
  assert.deepEqual(sectionToStep('lineup1'), { step: 0, inning: 1, half: 'top' })
  assert.deepEqual(sectionToStep('lineup2'), { step: 1, inning: 1, half: 'top' })
  assert.deepEqual(sectionToStep('boxscore'), { step: 3, inning: 1, half: 'top' })
  assert.deepEqual(sectionToStep('top4'), { step: 2, inning: 4, half: 'top' })
  assert.deepEqual(sectionToStep('bottom7'), { step: 2, inning: 7, half: 'bottom' })
})

test('a legacy inning{n} link still parses as the top half', () => {
  assert.deepEqual(sectionToStep('inning3'), { step: 2, inning: 3, half: 'top' })
})

test('an unknown section is treated as lineup1', () => {
  assert.deepEqual(sectionToStep('garbage'), { step: 0, inning: 1, half: 'top' })
  assert.deepEqual(sectionToStep(''), { step: 0, inning: 1, half: 'top' })
})

test('sectionToStep and stepToSection round-trip for the innings viewer', () => {
  for (const section of ['top1', 'bottom3', 'top10', 'lineup1', 'lineup2', 'boxscore']) {
    const { step, inning, half } = sectionToStep(section)
    assert.equal(stepToSection(step, inning, half), section, section)
  }
})

// --------------------------------------------------------------------------
// date <-> url conversions
// --------------------------------------------------------------------------
test('urlDateToApi and apiDateToUrl round-trip', () => {
  assert.equal(urlDateToApi('07052026'), '2026-07-05')
  assert.equal(apiDateToUrl('2026-07-05'), '07052026')
  assert.equal(apiDateToUrl(urlDateToApi('12312026')), '12312026')
})

test('urlDateToApi rejects a non-8-digit string', () => {
  assert.equal(urlDateToApi('2026-07-05'), null)
  assert.equal(urlDateToApi('abc'), null)
})

// --------------------------------------------------------------------------
// path builders — including doubleheader suffixing and cutoff query
// --------------------------------------------------------------------------
test('matchupSlug appends -{n} only for game 2+', () => {
  assert.equal(matchupSlug('MIL', 'STL'), 'milstl')
  assert.equal(matchupSlug('MIL', 'STL', 1), 'milstl')
  assert.equal(matchupSlug('MIL', 'STL', 2), 'milstl-2')
})

test('gamePath and slatePath build the expected URLs', () => {
  assert.equal(gamePath('2026-07-05', 'MIL', 'STL', 'top1'), '/07052026/milstl/top1')
  assert.equal(gamePath('2026-07-07', 'MIL', 'STL', 'boxscore', 2), '/07072026/milstl-2/boxscore')
  assert.equal(slatePath('2026-07-05'), '/07052026')
})

test('a built game path parses back to the same matchup and section', () => {
  const path = gamePath('2026-07-05', 'MIL', 'ARI', 'bottom3')
  const parsed = parseRoute(path)
  assert.equal(parsed.name, 'game')
  assert.equal(parsed.matchup, 'milari')
  assert.equal(parsed.section, 'bottom3')
})

test('link builders carry the spoiler cutoff query only when given one', () => {
  assert.equal(playerPath(123), '/player/123')
  assert.equal(playerPath(123, { d: '2026-07-05', s: 11 }), '/player/123?d=2026-07-05&s=11')
  assert.equal(teamPath(158, { d: '2026-07-05' }), '/team/158?d=2026-07-05')
  assert.equal(teamLeadersPath(158), '/team/158/leaders')
  assert.equal(umpirePath(427), '/umpire/427')
})

test('leadersPath uses the bare /leaders for mlb and keys every other scope', () => {
  assert.equal(leadersPath('mlb'), '/leaders')
  assert.equal(leadersPath('al'), '/leaders/al')
  assert.equal(orgLeadersPath(158), '/leaders/org/158')
})

test('a built player path with a cutoff parses back to the same cutoff', () => {
  const parsed = parseRoute(playerPath(123, { d: '2026-07-05', s: 11 }))
  assert.deepEqual(parsed, { name: 'player', id: '123', asOf: '2026-07-05', sportId: 11 })
})

test('gamePhotosPath deep-links to one game and parses back with its gamePk', () => {
  assert.equal(gamePhotosPath(823035), '/photos/823035')
  assert.deepEqual(parseRoute(gamePhotosPath(823035)), { name: 'photos', gamePk: 823035 })
})

test('a non-numeric photos gamePk segment falls back to the plain browse route', () => {
  assert.deepEqual(parseRoute('/photos/not-a-number'), { name: 'photos' })
})

// --------------------------------------------------------------------------
// The Logbook (ADR-0035) — where branch ORDER is the whole test
// --------------------------------------------------------------------------
test('the bare Logbook leaves the season for the page to resolve', () => {
  assert.deepEqual(parseRoute('/logbook'), { name: 'logbook', season: null, placing: null })
  assert.equal(logbookPath(), '/logbook')
})

test('a Logbook season segment parses, and an impossible one falls back to the bare page', () => {
  assert.deepEqual(parseRoute('/logbook/2026'), { name: 'logbook', season: 2026, placing: null })
  assert.equal(logbookPath(2026), '/logbook/2026')
  assert.deepEqual(parseRoute(logbookPath(2026)), { name: 'logbook', season: 2026, placing: null })
  // Out of the 1876-2200 window, and not an integer at all: both land on the
  // bare page rather than stranding it on a season that cannot exist.
  for (const bad of ['/logbook/1200', '/logbook/9999', '/logbook/2026.5']) {
    assert.deepEqual(parseRoute(bad), { name: 'logbook', season: null, placing: null }, bad)
  }
})

// `?place=` is a transient MODE of the book, not an address — the hand-off
// from the box score's mint card into the placement flow.
test('?place= puts the book into placement mode for one game', () => {
  assert.equal(logbookPlacePath(823035), '/logbook?place=823035')
  assert.deepEqual(parseRoute(logbookPlacePath(823035)), {
    name: 'logbook',
    season: null,
    placing: 823035,
  })
  // It rides along on a season page too, so placing from a mint card doesn't
  // throw away which season you were looking at.
  assert.deepEqual(parseRoute('/logbook/2026?place=823035'), {
    name: 'logbook',
    season: 2026,
    placing: 823035,
  })
})

test('a mangled ?place= drops the mode rather than placing a game that is not real', () => {
  for (const bad of ['/logbook?place=', '/logbook?place=abc', '/logbook?place=-4', '/logbook?place=0', '/logbook?place=1.5']) {
    assert.deepEqual(parseRoute(bad), { name: 'logbook', season: null, placing: null }, bad)
  }
})

// The regression this block exists for. `/logbook/{season}` parses its second
// segment with `Number(parts[1])`, so until the 'stats' branch was placed
// ABOVE it, '/logbook/stats' resolved to season NaN -> null -> the bare
// Logbook page: no error, no 404, just the wrong screen. Any future named
// second segment needs the same placement, which is why this asserts the route
// NAME rather than merely "not the bare page".
test('/logbook/stats is the retrospective, not season NaN falling through to /logbook', () => {
  assert.deepEqual(parseRoute('/logbook/stats'), { name: 'logbook-stats' })
  assert.equal(logbookStatsPath(), '/logbook/stats')
  assert.deepEqual(parseRoute(logbookStatsPath()), { name: 'logbook-stats' })
})

test('an unknown Logbook sub-segment still falls back to the bare page', () => {
  // 'stats' is matched by name, not by "non-numeric", so every other mangled
  // link keeps the old forgiving behavior instead of 404-ing.
  assert.deepEqual(parseRoute('/logbook/nope'), { name: 'logbook', season: null, placing: null })
})
