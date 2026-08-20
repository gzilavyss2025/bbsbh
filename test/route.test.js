// Unit coverage for the routing layer (src/lib/route.js) — 230 lines of pure,
// order-sensitive parsing that was previously untested. parseRoute's branch
// ordering is load-bearing (its own comments warn "must come BEFORE the generic
// game branch"), and it decides whether a link carries the as-of cutoff
// (`?d=` / `?s=`) onto a player/team page. Nothing in the UI stamps that cutoff
// on any more (ADR-0034's amendment — stats pages open live), but a URL that
// carries one must still parse it and still reproduce it across a tab switch,
// or an already-shared dated link answers two different ways in one visit. So
// the branches and the path round-trips are still worth pinning; what changed
// is who supplies `d`, not what `d` means.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseRoute,
  slugify,
  idFromSlug,
  entitySegment,
  teamSegment,
  managerPath,
  sectionToStep,
  stepToSection,
  urlDateToApi,
  apiDateToUrl,
  slatePath,
  LEAGUE_SLUG,
  matchupSlug,
  gamePath,
  playerPath,
  teamPath,
  teamTabPath,
  leadersPath,
  orgLeadersPath,
  teamLeadersPath,
  teamStampInPath,
  teamPhotosPath,
  situationalRecordsPath,
  umpirePath,
  gamePhotosPath,
  logbookPath,
  logbookStatsPath,
  logbookPlacePath,
  logbookNewPath,
  bookPath,
  bookStatsPath,
  profilePath,
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

// ADR-0056. MLB and today are each the ABSENCE of a segment, so the two
// defaults never appear in a URL and the bare '/' is the one canonical home
// slate. If either default ever started emitting a segment, the same page would
// have two addresses and the link-sharing this exists for would be undermined.
test('the home slate carries no league of its own — MLB is the absence of one', () => {
  assert.equal('sportId' in parseRoute('/'), false)
  assert.equal('sportId' in parseRoute('/07052026'), false)
  assert.equal(slatePath(null), '/')
  assert.equal(slatePath(null, 1), '/')
  assert.equal(slatePath('2026-07-05', 1), '/07052026')
})

test('a league prefix picks that league’s slate, with or without a day', () => {
  assert.deepEqual(parseRoute('/aaa'), { name: 'home', sportId: 11 })
  assert.deepEqual(parseRoute('/aa/08152026'), {
    name: 'home',
    date: '2026-08-15',
    sportId: 12,
  })
  assert.deepEqual(parseRoute('/higha'), { name: 'home', sportId: 13 })
  assert.deepEqual(parseRoute('/a/07052026'), {
    name: 'home',
    date: '2026-07-05',
    sportId: 14,
  })
})

// 'aplus' is the leader board's own spelling of High-A ('/leaders/aplus'). It
// is accepted so a reader who learned that spelling lands somewhere sensible,
// but it is never emitted — slatePath writes 'higha'.
test('the leader board’s aplus spelling is accepted but never emitted', () => {
  assert.deepEqual(parseRoute('/aplus'), { name: 'home', sportId: 13 })
  assert.equal(slatePath(null, 13), '/higha')
})

test('every league slug round-trips through slatePath and parseRoute', () => {
  for (const [sportId, slug] of Object.entries(LEAGUE_SLUG)) {
    const built = slatePath('2026-08-15', Number(sportId))
    assert.equal(built, `/${slug}/08152026`, slug)
    assert.deepEqual(
      parseRoute(built),
      { name: 'home', date: '2026-08-15', sportId: Number(sportId) },
      slug,
    )
  }
})

// Same shrug the bare-date branch takes: a hand-mangled day degrades to that
// league's today rather than erroring or dropping the league on the floor.
test('a league with an impossible day falls back to that league’s today', () => {
  assert.deepEqual(parseRoute('/aaa/13452026'), { name: 'home', sportId: 11 })
  assert.deepEqual(parseRoute('/aa/02302026'), { name: 'home', sportId: 12 })
  assert.deepEqual(parseRoute('/a/nonsense'), { name: 'home', sportId: 14 })
})

// 'a', 'aa' and 'aaa' are short enough to make a prefix match tempting; this
// parse does an exact lookup, and these are the routes that would break first
// if that ever changed.
test('a league slug never shadows a named route that starts the same way', () => {
  assert.equal(parseRoute('/about').name, 'about')
  assert.equal(parseRoute('/admin').name, 'admin')
  assert.equal(parseRoute('/awards').name, 'awards-history')
  assert.equal(parseRoute('/attendance').name, 'attendance')
  assert.equal(parseRoute('/all-star-rosters').name, 'all-star-rosters')
  assert.equal(parseRoute('/leaders/aaa').name, 'leaders')
  assert.equal(parseRoute('/leaders/aaa').scope, 'aaa')
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

// The same stance the slate above takes, applied to `?d=`. Every dated loader
// funnels asOf into dayBefore(), whose `new Date(...).toISOString()` raises
// RangeError on an unparseable date, and the throw surfaced three different
// ways: "Couldn't load this team" / "…this player" on the hub and the profile,
// a /leaders banner reading "Stats entering Invalid Date", and a completely
// blank /situational-records.
test('an unparseable ?d= degrades to live rather than riding into the loaders', () => {
  for (const bad of [
    '07152026', // the slate's own MMDDYYYY shape, which `?d=` does not take
    '2026-13-01',
    '2026-02-30', // a real SHAPE that is not a real day
    '2026-7-5', // a real day in the wrong shape — still an Invalid Date downstream
    'yesterday',
    '',
  ]) {
    for (const path of ['/team/158', '/team/158/roster', '/player/677594', '/leaders', '/situational-records']) {
      assert.equal(parseRoute(`${path}?d=${bad}`).asOf, null, `${path}?d=${bad} must not survive`)
    }
  }
})

test('a real as-of date still rides through untouched', () => {
  assert.equal(parseRoute('/team/158?d=2026-07-05').asOf, '2026-07-05')
  assert.equal(parseRoute('/player/677594?d=2024-02-29').asOf, '2024-02-29') // leap day
  // The guard must not eat the other query param on its way past.
  assert.equal(parseRoute('/team/158?d=07152026&s=11').sportId, 11)
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
    '/situational-records': 'situational-records',
    // The four broadcast reports (REPORT_ROUTES, lib/reportPages.js). The farm
    // board's address spells the searched-for phrase out; its route NAME stays
    // the shorter 'farm-system' — the one pair in the set where the two
    // deliberately differ.
    '/attendance': 'attendance',
    '/pace-of-play': 'pace',
    '/farm-system-rankings': 'farm-system',
    '/bullpen-availability': 'bullpens',
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
  const BREW = '/team/milwaukee-brewers-158'
  assert.equal(teamTabPath(158, 'overview'), BREW)
  assert.equal(teamTabPath(158, 'roster'), `${BREW}/roster`)
  assert.equal(teamTabPath(158, 'games'), `${BREW}/games`)
  assert.equal(teamTabPath(158, 'numbers'), `${BREW}/numbers`)
  assert.equal(teamTabPath(158, 'minors'), `${BREW}/minors`)
  assert.equal(teamTabPath(158, 'leaders'), `${BREW}/leaders`)
  // The spoiler-relevant case: a tab switch must reproduce the same ?d=/?s=
  // a dated team link arrived with — dropping either would show a visitor
  // mid-scoring stats past the half-inning they've reached (PRD non-negotiable 1).
  assert.equal(
    teamTabPath(158, 'roster', { d: '2026-07-05', s: 11 }),
    `${BREW}/roster?d=2026-07-05&s=11`,
  )
  assert.equal(
    teamTabPath(158, 'overview', { d: '2026-07-05', s: 11 }),
    `${BREW}?d=2026-07-05&s=11`,
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
// teamStampInPath / parseRoute — the Stamp In page (ADR-0042)
// --------------------------------------------------------------------------
test('teamStampInPath builds the page path and carries the cutoff query', () => {
  assert.equal(teamStampInPath(158), '/team/milwaukee-brewers-158/stamp-in')
  assert.equal(
    teamStampInPath(158, { d: '2026-07-05', s: 11 }),
    '/team/milwaukee-brewers-158/stamp-in?d=2026-07-05&s=11',
  )
})

test('parseRoute resolves the Stamp In page, cutoff query included', () => {
  assert.deepEqual(parseRoute('/team/158/stamp-in'), {
    name: 'team-stamp-in',
    id: '158',
    asOf: null,
    sportId: null,
  })
  assert.deepEqual(parseRoute('/team/158/stamp-in?d=2026-07-05&s=11'), {
    name: 'team-stamp-in',
    id: '158',
    asOf: '2026-07-05',
    sportId: 11,
  })
})

test('the stamp-in branch wins over the generic 3-segment game branch', () => {
  // Same ordering trap as the team tabs above: '/team/158/stamp-in' is three
  // segments, so a generic parse would read it as date='team',
  // matchup='158', section='stamp-in'.
  assert.equal(parseRoute('/team/158/stamp-in').name, 'team-stamp-in')
  assert.equal(parseRoute('/team/158/stamp-in').id, '158')
})

// --------------------------------------------------------------------------
// situationalRecordsPath / parseRoute — one situational record across a whole level
// --------------------------------------------------------------------------
test('situationalRecordsPath carries the explorer state and the usual scope hints', () => {
  assert.equal(situationalRecordsPath(), '/situational-records')
  assert.equal(situationalRecordsPath({ metric: 'scored-4-plus' }), '/situational-records?metric=scored-4-plus')
  assert.equal(
    situationalRecordsPath({
      metric: 'lead-8',
      category: 'late-innings',
      half: 'post',
      sort: 'played',
      order: 'asc',
      s: 11,
      d: '2026-07-05',
    }),
    '/situational-records?d=2026-07-05&s=11&category=late-innings&metric=lead-8&half=post&sort=played&order=asc',
  )
  // 'all' is the default, so it stays out of the URL rather than pinning the
  // page to a lever the reader never touched.
  assert.equal(situationalRecordsPath({ metric: 'lead-8', half: 'all' }), '/situational-records?metric=lead-8')
})

test('parseRoute reads the split and the half back off the URL', () => {
  assert.deepEqual(parseRoute('/situational-records'), {
    name: 'situational-records',
    asOf: null,
    sportId: null,
    category: null,
    metric: null,
    half: null,
    sort: null,
    order: null,
  })
  assert.deepEqual(parseRoute('/situational-records?category=late-innings&metric=lead-8&half=post&sort=played&order=asc&s=12&d=2026-07-05'), {
    name: 'situational-records',
    asOf: '2026-07-05',
    sportId: 12,
    category: 'late-innings',
    metric: 'lead-8',
    half: 'post',
    sort: 'played',
    order: 'asc',
  })
})

test('the old team-records URL remains an inbound alias', () => {
  assert.equal(parseRoute('/team-records').name, 'situational-records')
})

// --------------------------------------------------------------------------
// teamPhotosPath / parseRoute — the season photos page
// --------------------------------------------------------------------------
test('teamPhotosPath builds the page path and carries the cutoff query', () => {
  assert.equal(teamPhotosPath(158), '/team/milwaukee-brewers-158/photos')
  assert.equal(
    teamPhotosPath(158, { d: '2026-07-05', s: 11 }),
    '/team/milwaukee-brewers-158/photos?d=2026-07-05&s=11',
  )
})

test('parseRoute resolves the season photos page, cutoff query included', () => {
  assert.deepEqual(parseRoute('/team/158/photos'), {
    name: 'team-photos',
    id: '158',
    asOf: null,
    sportId: null,
  })
  assert.deepEqual(parseRoute('/team/158/photos?d=2026-07-05&s=11'), {
    name: 'team-photos',
    id: '158',
    asOf: '2026-07-05',
    sportId: 11,
  })
})

test('the photos branch wins over the generic 3-segment game branch', () => {
  // Same ordering trap as stamp-in above: '/team/158/photos' is three
  // segments, so a generic parse would read it as date='team',
  // matchup='158', section='photos'.
  assert.equal(parseRoute('/team/158/photos').name, 'team-photos')
  assert.equal(parseRoute('/team/158/photos').id, '158')
})

test('the single-segment /photos game-finder route still parses on its own', () => {
  // Guards against the new 3-segment branch swallowing the pre-existing
  // '/photos' and '/photos/{gamePk}' routes (different `parts[0]`, but worth
  // pinning given how many near-miss branches sit in this parser).
  assert.deepEqual(parseRoute('/photos'), { name: 'photos' })
  assert.deepEqual(parseRoute('/photos/717404'), { name: 'photos', gamePk: 717404 })
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
  // The two sections that aren't pages of the scorebook — the shareable poster
  // studio and the printable pre-pitch sheet. Both are real, deep-linkable
  // addresses; the sheet's URL is what a phone's share sheet actually hands off.
  assert.deepEqual(sectionToStep('preview'), { step: 4, inning: 1, half: 'top' })
  assert.deepEqual(sectionToStep('sheet'), { step: 5, inning: 1, half: 'top' })
})

test('a legacy inning{n} link still parses as the top half', () => {
  assert.deepEqual(sectionToStep('inning3'), { step: 2, inning: 3, half: 'top' })
})

test('an unknown section is treated as lineup1', () => {
  assert.deepEqual(sectionToStep('garbage'), { step: 0, inning: 1, half: 'top' })
  assert.deepEqual(sectionToStep(''), { step: 0, inning: 1, half: 'top' })
})

test('sectionToStep and stepToSection round-trip for the innings viewer', () => {
  for (const section of ['top1', 'bottom3', 'top10', 'lineup1', 'lineup2', 'boxscore', 'preview', 'sheet']) {
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
  assert.equal(
    teamPath(158, { d: '2026-07-05' }),
    '/team/milwaukee-brewers-158?d=2026-07-05',
  )
  assert.equal(teamLeadersPath(158), '/team/milwaukee-brewers-158/leaders')
  assert.equal(umpirePath(427), '/umpire/427')
})

test('leadersPath uses the bare /leaders for mlb and keys every other scope', () => {
  assert.equal(leadersPath('mlb'), '/leaders')
  assert.equal(leadersPath('al'), '/leaders/al')
  assert.equal(orgLeadersPath(158), '/leaders/org/milwaukee-brewers-158')
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

// Starting a book is one of the answers to "which book does this stamp go
// in", so `?place=` has to survive the trip through it. It used to be parsed
// away to null here, which meant taking that route mid-placement dropped the
// keepsake back into the tray with nothing said.
test('/logbook/new is the create page, and it can be holding a stamp', () => {
  assert.deepEqual(parseRoute('/logbook/new'), {
    name: 'logbook',
    creating: true,
    season: null,
    placing: null,
  })
  assert.equal(logbookNewPath(), '/logbook/new')
  assert.equal(logbookNewPath(823035), '/logbook/new?place=823035')
  assert.deepEqual(parseRoute(logbookNewPath(823035)), {
    name: 'logbook',
    creating: true,
    season: null,
    placing: 823035,
  })
})

// --------------------------------------------------------------------------
// A specific named book (ADR-0036's shelf) — additive routes, byte-for-byte
// alongside the two above rather than a replacement for them.
// --------------------------------------------------------------------------
test('a bare book route opens that book with no season resolved yet', () => {
  assert.deepEqual(parseRoute('/logbook/book/b1abcxyz'), {
    name: 'logbook',
    bookId: 'b1abcxyz',
    season: null,
    placing: null,
  })
  assert.equal(bookPath('b1abcxyz'), '/logbook/book/b1abcxyz')
  assert.deepEqual(parseRoute(bookPath('b1abcxyz')), {
    name: 'logbook',
    bookId: 'b1abcxyz',
    season: null,
    placing: null,
  })
})

test('?place= rides along on a book route the same way it does the bare one', () => {
  assert.deepEqual(parseRoute('/logbook/book/b1abcxyz?place=823035'), {
    name: 'logbook',
    bookId: 'b1abcxyz',
    season: null,
    placing: 823035,
  })
})

test("a book's season segment parses, and an impossible one falls back to that book's bare page", () => {
  assert.deepEqual(parseRoute('/logbook/book/b1abcxyz/2026'), {
    name: 'logbook',
    bookId: 'b1abcxyz',
    season: 2026,
    placing: null,
  })
  assert.equal(bookPath('b1abcxyz', 2026), '/logbook/book/b1abcxyz/2026')
  assert.deepEqual(parseRoute(bookPath('b1abcxyz', 2026)), {
    name: 'logbook',
    bookId: 'b1abcxyz',
    season: 2026,
    placing: null,
  })
  for (const bad of ['/logbook/book/b1abcxyz/1200', '/logbook/book/b1abcxyz/9999']) {
    assert.deepEqual(
      parseRoute(bad),
      { name: 'logbook', bookId: 'b1abcxyz', season: null, placing: null },
      bad,
    )
  }
})

// The identical regression the bare '/logbook/stats' block above exists for,
// one segment deeper: `Number(parts[3])` would parse 'stats' as NaN and
// silently fall through to that book's bare page unless the 'stats' branch is
// checked FIRST.
test("a book's /stats is the retrospective, not season NaN falling through to that book's bare page", () => {
  assert.deepEqual(parseRoute('/logbook/book/b1abcxyz/stats'), {
    name: 'logbook-stats',
    bookId: 'b1abcxyz',
  })
  assert.equal(bookStatsPath('b1abcxyz'), '/logbook/book/b1abcxyz/stats')
  assert.deepEqual(parseRoute(bookStatsPath('b1abcxyz')), {
    name: 'logbook-stats',
    bookId: 'b1abcxyz',
  })
})

// --------------------------------------------------------------------------
// parseRoute — /profile (My Tally)
// --------------------------------------------------------------------------

test('/profile is My Tally, and its path builder round-trips', () => {
  assert.deepEqual(parseRoute('/profile'), { name: 'profile' })
  assert.equal(profilePath(), '/profile')
  assert.deepEqual(parseRoute(profilePath()), { name: 'profile' })
})

// The neighbours it sits among in the ordered single-segment list. None of them
// is a prefix of 'profile' and 'profile' is a prefix of none of them, but the
// list is order-sensitive by design (its own header says so), so pin it rather
// than trusting a reading of the file.
test('/profile collides with none of its single-segment neighbours', () => {
  assert.deepEqual(parseRoute('/photos'), { name: 'photos' })
  assert.deepEqual(parseRoute('/postseason-history'), { name: 'postseason-history' })
  assert.deepEqual(parseRoute('/postseason-leaders'), { name: 'postseason-leaders' })
  assert.deepEqual(parseRoute('/prospects'), { name: 'prospects' })
})

// There is deliberately no '/profile/{sub}' — sections live on the one page, and
// Clerk's <UserProfile> is mounted routing="virtual" so it never asks this
// parser for a wildcard. A stale or hand-typed sub-path must degrade to the
// slate rather than throwing or resolving as a game (date='profile').
test('an unknown /profile sub-segment degrades to the slate rather than a game', () => {
  assert.deepEqual(parseRoute('/profile/security'), { name: 'home' })
  assert.deepEqual(parseRoute('/profile/x/y'), {
    name: 'game',
    date: 'profile',
    matchup: 'x',
    section: 'y',
  })
})

// A query string is not part of this route's identity — `?nointro` rides along
// on every e2e URL (e2e/fixtures.js) and must not change what parses.
test('/profile ignores a query string', () => {
  assert.deepEqual(parseRoute('/profile?nointro'), { name: 'profile' })
})


// --------------------------------------------------------------------------
// Addresses that carry a name (ADR-0057)
//
// The whole point of the scheme is that it is ADDITIVE: the slug is new, and
// every address that existed before it must still resolve to exactly the same
// page. That is what most of this section pins.
// --------------------------------------------------------------------------
test('slugify folds diacritics rather than dropping them', () => {
  // The bug this exists to prevent: strip the combining marks WITHOUT
  // decomposing first and 'José Ramírez' becomes 'jos-ram-rez', an address no
  // reader would ever connect to the plain spelling of his name.
  assert.equal(slugify('José Ramírez'), 'jose-ramirez')
  assert.equal(slugify('Yoán Moncada'), 'yoan-moncada')
  assert.equal(slugify('Jung Hoo Lee'), 'jung-hoo-lee')
})

test('slugify collapses punctuation and never leaves a stray hyphen', () => {
  assert.equal(slugify("D'Angelo Ortiz Jr."), 'd-angelo-ortiz-jr')
  assert.equal(slugify('  St. Louis  Cardinals '), 'st-louis-cardinals')
  assert.equal(slugify('Rocket City Trash Pandas'), 'rocket-city-trash-pandas')
  // Capped, and the cap may not leave the slug ending on a hyphen.
  const long = slugify('A'.repeat(30) + ' ' + 'B'.repeat(30))
  assert.ok(long.length <= 48)
  assert.doesNotMatch(long, /-$/)
})

test('slugify returns empty for a name with nothing sluggable in it', () => {
  for (const name of [null, undefined, '', '—', '   ', '###']) {
    assert.equal(slugify(name), '', String(name))
  }
})

test('idFromSlug reads the id off either address shape', () => {
  assert.equal(idFromSlug('545361'), '545361')
  assert.equal(idFromSlug('mike-trout-545361'), '545361')
  // The id is the LAST hyphen group, so a club whose own name ends in a number
  // cannot be mistaken for it.
  assert.equal(idFromSlug('area-code-51-5015'), '5015')
  // Neither shape: handed back untouched, so a mangled URL fails where it
  // always did (at the fetch) rather than somewhere new.
  assert.equal(idFromSlug('not-an-id'), 'not-an-id')
  assert.equal(idFromSlug(''), '')
})

test('entitySegment emits the bare id when it cannot spell a name', () => {
  assert.equal(entitySegment(545361, 'Mike Trout'), 'mike-trout-545361')
  assert.equal(entitySegment(545361, null), '545361')
  assert.equal(entitySegment(545361, '—'), '545361')
  // A half-loaded row must never mint 'mike-trout-undefined'.
  assert.equal(entitySegment(undefined, 'Mike Trout'), '')
  assert.equal(entitySegment('abc', 'Mike Trout'), 'abc')
})

test('every MLB club names its own address with no caller passing one', () => {
  // The reason the team hub needed no per-caller change: a tab button knows an
  // id and a tab key and nothing else, and the static table fills in the rest.
  assert.equal(teamSegment(158), 'milwaukee-brewers-158')
  assert.equal(teamSegment(134), 'pittsburgh-pirates-134')
  // The relocating Athletics' duplicated halves collapse (teams.js
  // teamFullName), so the address is not 'athletics-athletics-133'.
  assert.equal(teamSegment(133), 'athletics-133')
  // A MiLB club is not in that table: bare until its own feed supplies a name.
  assert.equal(teamSegment(5015), '5015')
  assert.equal(teamSegment(5015, 'Biloxi Shuckers'), 'biloxi-shuckers-5015')
})

test('for a club the static table knows, the table beats the passed name', () => {
  // The opposite precedence to every other builder here, and deliberate. A club
  // is called several things across this site — the standings row says 'Rays',
  // the off-day tile says 'D-backs', the hub says 'Tampa Bay Rays' — and a link
  // borrows whichever spelling it happens to be rendering. One club must have
  // ONE address, so the table decides for the 30 it knows. Without this, the
  // standings linked '/team/rays-139' while the hub linked
  // '/team/tampa-bay-rays-139' and the canonical named a third thing.
  assert.equal(teamSegment(139, 'Rays'), 'tampa-bay-rays-139')
  assert.equal(teamSegment(109, 'D-backs'), 'arizona-diamondbacks-109')
  assert.equal(teamTabPath(139, 'numbers', { name: 'Rays' }), '/team/tampa-bay-rays-139/numbers')
  // A club it does NOT know still takes the caller's word.
  assert.equal(teamSegment(5015, 'Biloxi Shuckers'), 'biloxi-shuckers-5015')
})

test('a slugged address parses to exactly what the bare id parses to', () => {
  const cases = [
    ['/player/545361', '/player/mike-trout-545361'],
    ['/team/158', '/team/milwaukee-brewers-158'],
    ['/team/158/roster', '/team/milwaukee-brewers-158/roster'],
    ['/team/158/leaders', '/team/milwaukee-brewers-158/leaders'],
    ['/team/158/stamp-in', '/team/milwaukee-brewers-158/stamp-in'],
    ['/team/158/photos', '/team/milwaukee-brewers-158/photos'],
    ['/umpire/427044', '/umpire/pat-hoberg-427044'],
    ['/manager/117277', '/manager/pat-murphy-117277'],
    ['/leaders/org/158', '/leaders/org/milwaukee-brewers-158'],
  ]
  for (const [bare, slugged] of cases) {
    assert.deepEqual(parseRoute(slugged), parseRoute(bare), slugged)
  }
})

test('an old bare-id link keeps resolving, query hints included', () => {
  // The compatibility promise: no redirect, no lookup table, forever. Every
  // link shared, bookmarked or stamped before the slug existed is this shape.
  assert.deepEqual(parseRoute('/player/545361?d=2026-07-05&s=11'), {
    name: 'player',
    id: '545361',
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

test('a WRONG slug still resolves to the id it carries', () => {
  // A traded player's old link, a hand-edited address, a name we spelled
  // differently last season: the id decides, the slug is decoration. This is
  // what lets the canonical re-spell the address without breaking anything.
  assert.equal(parseRoute('/player/completely-wrong-545361').id, '545361')
  assert.equal(parseRoute('/team/chicago-cubs-158/roster').id, '158')
})

test('built slugged paths round-trip through parseRoute', () => {
  assert.deepEqual(parseRoute(playerPath(545361, { name: 'Mike Trout' })), {
    name: 'player',
    id: '545361',
    asOf: null,
    sportId: null,
  })
  assert.equal(parseRoute(teamTabPath(158, 'numbers')).id, '158')
  assert.equal(parseRoute(umpirePath(427044, 'Pat Hoberg')).id, '427044')
  assert.equal(parseRoute(managerPath(117277, 'Pat Murphy')).id, '117277')
})

test('a name only changes the spelling of an address, never the page', () => {
  assert.equal(playerPath(545361, { name: 'Mike Trout' }), '/player/mike-trout-545361')
  assert.equal(playerPath(545361), '/player/545361')
  assert.equal(umpirePath(427044, 'Pat Hoberg'), '/umpire/pat-hoberg-427044')
  assert.equal(umpirePath(427044), '/umpire/427044')
  assert.equal(managerPath(117277, 'Pat Murphy'), '/manager/pat-murphy-117277')
  assert.equal(managerPath(117277), '/manager/117277')
  // …and it rides in front of the query, never inside it.
  assert.equal(
    playerPath(545361, { name: 'Mike Trout', d: '2026-07-05', s: 11 }),
    '/player/mike-trout-545361?d=2026-07-05&s=11',
  )
})
