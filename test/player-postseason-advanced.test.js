// The Advanced card and the hover card, October half (#1436). The headline cards
// stay regular season. A postseason read sits beside them: the Advanced card gets
// a Regular / Postseason switch, the hover card a second line of tiles.
//
// Checked live 2026-10-07 (Ronald Acuña Jr., 660670, 6 postseason G): `stats=
// seasonAdvanced&gameType=P` answers (26 PA); `stats=sabermetrics&gameType=P`
// answers with no entry at all, so wOBA, wRC+, FIP and ERA− have no postseason
// value; `byDateRange&gameType=P` answers (6 G). A player with no postseason
// gets an empty `stats` list.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { advancedHittingView, advancedPitchingView } from '../src/api/person.js'
import { fetchHittingAdvanced, fetchPitchingAdvanced } from '../src/api/person-fetch.js'
import { loadHoverCardStats } from '../src/api/playerHoverCard.js'
import { loadPlayerAnalytics } from '../src/api/player/analytics.js'

const POST_HIT = {
  season: { gamesPlayed: 6, plateAppearances: 26, avg: '.143' },
  seasonAdvanced: {
    pitchesPerPlateAppearance: '3.900',
    walksPerPlateAppearance: '.115',
    strikeoutsPerPlateAppearance: '.231',
    walksPerStrikeout: '.500',
    iso: '.000',
    babip: '.176',
  },
  sabermetrics: null,
}

const POST_PITCH = {
  season: { gamesPlayed: 2, gamesStarted: 2, avg: '.200' },
  advanced: {
    strikeoutsPerPlateAppearance: '.300',
    walksPerPlateAppearance: '.050',
    strikeoutsMinusWalksPercentage: '.250',
    ballsInPlay: 20,
    groundOuts: 6,
    groundHits: 2,
    ops: '.600',
    qualityStarts: 1,
  },
  saber: null,
}

const factsOf = (view) => Object.fromEntries(view.facts.map((f) => [f.label, f.value]))

test('a postseason hitter card keeps the rates and prints a dash for wOBA and wRC+', () => {
  const f = factsOf(advancedHittingView(POST_HIT, { post: true }))
  assert.equal(f['wOBA'], '—')
  assert.equal(f['wRC+'], '—')
  assert.equal(f['K%'], '23.1%')
  assert.equal(f['BABIP'], '.176')
})

test('the regular hitter card still leaves a missing wOBA out', () => {
  const labels = advancedHittingView(POST_HIT).facts.map((x) => x.label)
  assert.equal(labels.includes('wOBA'), false)
})

test('a postseason pitcher card prints a dash for FIP and ERA−', () => {
  const f = factsOf(advancedPitchingView(POST_PITCH, { post: true }))
  assert.equal(f['FIP'], '—')
  assert.equal(f['ERA−'], '—')
  assert.equal(f['K%'], '30.0%')
  assert.equal(f['Quality starts'], '1 of 2')
})

test('a postseason card with no October game is null', () => {
  assert.equal(advancedHittingView({ ...POST_HIT, season: null }, { post: true }), null)
  assert.equal(advancedHittingView({ ...POST_HIT, season: { gamesPlayed: 0 } }, { post: true }), null)
  assert.equal(advancedPitchingView({ ...POST_PITCH, season: { gamesPlayed: 0 } }, { post: true }), null)
})

function stubFetch(answer) {
  const urls = []
  mock.method(globalThis, 'fetch', async (url) => {
    urls.push(String(url))
    return { ok: true, status: 200, json: async () => answer(String(url)) }
  })
  return urls
}

test('the Advanced fetchers ask for gameType=P only when told to', async () => {
  const urls = stubFetch(() => ({ stats: [] }))
  await fetchHittingAdvanced(1, 2026)
  await fetchHittingAdvanced(1, 2026, { gameType: 'P' })
  await fetchPitchingAdvanced(1, 2026, { gameType: 'P' })
  mock.restoreAll()
  assert.equal(urls[0].includes('gameType'), false)
  assert.ok(urls[1].includes('gameType=P'))
  assert.ok(urls[2].includes('gameType=P'))
})

const PERSON = {
  people: [{
    id: 660670, fullName: 'Ronald Acuña Jr.', primaryPosition: { abbreviation: 'RF', type: 'Outfielder' },
    currentTeam: { id: 144, name: 'Atlanta Braves' }, batSide: { code: 'R' }, pitchHand: { code: 'R' },
    mlbDebutDate: '2018-04-25', active: true,
  }],
}
const hoverAnswer = (post) => (url) => {
  if (url.includes('/seasons/')) return { seasons: [{ postSeasonStartDate: '2000-10-01', offseasonStartDate: '2999-12-31' }] }
  if (url.includes('/transactions')) return { transactions: [] }
  if (url.includes('/stats?')) {
    if (url.includes('gameType=P')) {
      return { stats: post ? [{ splits: [{ stat: { gamesPlayed: 6, avg: '.143', homeRuns: 0, rbi: 1, ops: '.400' } }] }] : [] }
    }
    return { stats: [{ splits: [{ stat: { gamesPlayed: 140, avg: '.290', homeRuns: 30, rbi: 80, ops: '.900' } }] }] }
  }
  return PERSON
}

test('the hover card carries a postseason line once he has played an October game', async () => {
  const urls = stubFetch(hoverAnswer(true))
  const card = await loadHoverCardStats(660670)
  mock.restoreAll()
  assert.ok(urls.some((u) => u.includes('gameType=P')))
  assert.deepEqual(card.fields.map((f) => f.v), ['.290', '30', '80', '.900'])
  assert.deepEqual(card.postFields.map((f) => f.v), ['.143', '0', '1', '.400'])
})

test('the hover card has no postseason line before he has played one', async () => {
  stubFetch(hoverAnswer(false))
  const card = await loadHoverCardStats(660670)
  mock.restoreAll()
  assert.equal(card.postFields, null)
})

// #1651: the gameType=P request goes out only once the season row's
// postSeasonStartDate has passed, so an April-September page pays for no empty read.
const GATE_PERSON = {
  id: 592450, fullName: 'Test Player', active: true, mlbDebutDate: '2015-01-01',
  currentTeam: { id: 147 }, primaryPosition: { abbreviation: 'RF', type: 'Outfielder' },
  batSide: { code: 'R' }, pitchHand: { code: 'R' },
}

// Records every URL; answers the season row with the given postseason start.
async function urlsFor(postSeasonStartDate, run) {
  const real = globalThis.fetch
  const urls = []
  globalThis.fetch = async (url) => {
    urls.push(String(url))
    const body = /\/api\/v1\/seasons\//.test(url)
      ? { seasons: [{ postSeasonStartDate, offseasonStartDate: '2999-12-31' }] }
      : /\/api\/v1\/people\/\d+\?|\/api\/v1\/people\?/.test(url) ? { people: [GATE_PERSON] } : {}
    return { ok: true, status: 200, json: async () => body }
  }
  try {
    await run()
  } finally {
    globalThis.fetch = real
  }
  return urls.filter((u) => u.includes('gameType=P'))
}

for (const [name, run] of [
  ['hover card', () => loadHoverCardStats(GATE_PERSON.id)],
  ['analytics loader', () => loadPlayerAnalytics(GATE_PERSON.id)],
]) {
  test(`${name}: no gameType=P request before the postseason starts`, async () => {
    assert.equal((await urlsFor('2999-10-01', run)).length, 0)
  })
  test(`${name}: gameType=P request goes out once the postseason has started`, async () => {
    assert.ok((await urlsFor('2000-10-01', run)).length > 0)
  })
}
