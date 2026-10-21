// Coverage for the slate's display order (src/lib/resultCards.js):
// reorderLiveGames and reorderNationalBroadcasts, the tiers GameSelect applies
// to every slate.
import assert from 'node:assert/strict'
import test from 'node:test'
import { reorderLiveGames, reorderNationalBroadcasts, splitSeriesGame } from '../src/lib/resultCards.js'

const pks = (games) => games.map((g) => g.gamePk)

// --------------------------------------------------------------------------
// The slate's four display tiers: the favorite team's game, the games already
// underway (reorderLiveGames), the national broadcasts among the games that
// haven't started (reorderNationalBroadcasts), then the rest — Finals last
// throughout. The default state here is 'Preview' (scheduled, not yet
// underway), so a case that cares about a game being live says so.
// --------------------------------------------------------------------------
const slateWithState = (...entries) =>
  entries.map(([gamePk, abstractState = 'Preview']) => ({ gamePk, abstractState }))

test('reorderLiveGames: games underway float above the ones that have not started', () => {
  const games = slateWithState([1], [2, 'Live'], [3], [4, 'Live'])
  assert.deepEqual(pks(reorderLiveGames(games)), [2, 4, 1, 3])
})

test('reorderLiveGames: the pinned favorite keeps slot 0 even when it has not started', () => {
  const games = slateWithState([1], [2, 'Live'], [3, 'Live'])
  const isPinned = (g) => g.gamePk === 1
  assert.deepEqual(pks(reorderLiveGames(games, isPinned)), [1, 2, 3])
})

test('reorderLiveGames: Finals stay at the bottom, below every scheduled game', () => {
  const games = slateWithState([1], [2, 'Live'], [3, 'Final'])
  assert.deepEqual(pks(reorderLiveGames(games)), [2, 1, 3])
})

test('reorderLiveGames: an all-live or all-scheduled slate is a no-op', () => {
  const allLive = slateWithState([1, 'Live'], [2, 'Live'])
  assert.equal(reorderLiveGames(allLive), allLive)
  const allScheduled = slateWithState([1], [2])
  assert.equal(reorderLiveGames(allScheduled), allScheduled)
})

// The rule this whole change exists for: a national game that hasn't thrown a
// pitch may not outrank a game already in progress.
test('reorderNationalBroadcasts: a national game that has not started stays below the live games', () => {
  const games = slateWithState([1, 'Live'], [2, 'Live'], [3], [4])
  const national = { 4: 'FOX' }
  assert.deepEqual(pks(reorderNationalBroadcasts(games, national)), [1, 2, 4, 3])
})

test('reorderNationalBroadcasts: with no pinned game, national games group at the front in relative order', () => {
  const games = slateWithState([1], [2], [3], [4])
  const national = { 2: 'FOX', 4: 'TBS' }
  assert.deepEqual(pks(reorderNationalBroadcasts(games, national)), [2, 4, 1, 3])
})

test('reorderNationalBroadcasts: with a pinned game leading, national games sit right behind it', () => {
  const games = slateWithState([1], [2], [3], [4])
  const isPinned = (g) => g.gamePk === 1
  const national = { 3: 'Peacock' }
  assert.deepEqual(pks(reorderNationalBroadcasts(games, national, isPinned)), [1, 3, 2, 4])
})

test('reorderNationalBroadcasts: a live national game is left where the live tier put it', () => {
  // Its promotion already happened — it's live. Regrouping it here would drop
  // it back below the other live games it belongs among.
  const games = slateWithState([1, 'Live'], [2, 'Live'], [3])
  const national = { 2: 'ESPN' }
  assert.equal(reorderNationalBroadcasts(games, national), games)
})

test('reorderNationalBroadcasts: Final games are left in place, never promoted above still-playing games', () => {
  const games = slateWithState([1], [2], [3, 'Final'], [4])
  const national = { 3: 'FOX' }
  assert.deepEqual(pks(reorderNationalBroadcasts(games, national)), [1, 2, 3, 4])
})

test('reorderNationalBroadcasts: no national games on the slate is a no-op', () => {
  const games = slateWithState([1], [2], [3])
  assert.equal(reorderNationalBroadcasts(games, {}), games)
})

test('reorderNationalBroadcasts: an empty/unloaded map is a no-op', () => {
  const games = slateWithState([1], [2], [3])
  assert.equal(reorderNationalBroadcasts(games, null), games)
})

// The four tiers composed, in the order GameSelect applies them.
test('the slate tiers compose: favorite, then live, then national scheduled, then the rest', () => {
  const games = slateWithState([1], [2], [3, 'Live'], [4], [5, 'Live'], [6, 'Final'])
  const isPinned = (g) => g.gamePk === 1
  const national = { 4: 'FOX', 6: 'TBS' }
  const liveFirst = reorderLiveGames(games, isPinned)
  assert.deepEqual(pks(reorderNationalBroadcasts(liveFirst, national, isPinned)), [1, 3, 5, 4, 2, 6])
})

// The World Series game leaves the list so the page can open with its card.
test('splitSeriesGame: the Series game is the lead, the rest keep their order', () => {
  const games = slateWithState([1], [2, 'Live'], [3], [4])
  const { lead, rest } = splitSeriesGame(games, 3)
  assert.equal(lead.gamePk, 3)
  assert.deepEqual(pks(rest), [1, 2, 4])
})

test('splitSeriesGame: no pk, or a pk not on the slate, changes nothing', () => {
  const games = slateWithState([1], [2])
  for (const pk of [null, 99]) {
    const { lead, rest } = splitSeriesGame(games, pk)
    assert.equal(lead, null)
    assert.equal(rest, games)
  }
})
