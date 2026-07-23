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
  leadersPath,
  orgLeadersPath,
  teamLeadersPath,
  umpirePath,
  gamePhotosPath,
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
    '/umpires': 'umpire-rankings',
    '/top-games': 'top-games',
    '/scorecard-lab': 'scorecard-lab',
    '/game-notes-debug': 'game-notes-debug',
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
