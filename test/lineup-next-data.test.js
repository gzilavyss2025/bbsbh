import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rosterFallbackGroups, startingIdsFor } from '../src/screens/lineup/next/useLineupData.js'

const rosterRow = (id, name, pos, type = 'Hitter', jersey = '1') => ({
  person: { id, fullName: name },
  jerseyNumber: jersey,
  position: { abbreviation: pos, type },
})

test('the pregame roster leaves out pitchers and sorts by position', () => {
  const rows = rosterFallbackGroups([
    rosterRow(3, 'Cy Young', 'P', 'Pitcher'),
    rosterRow(2, 'Short Stop', 'SS'),
    rosterRow(1, 'Cat Cher', 'C'),
  ])
  assert.deepEqual(rows.map((r) => r.id), [1, 2])
  assert.equal(rows[0].pos, 'C')
})

test('an empty or missing roster gives no rows', () => {
  assert.deepEqual(rosterFallbackGroups(null), [])
  assert.deepEqual(rosterFallbackGroups([]), [])
})

test('the starting ids hold both probable pitchers even with no lineup posted', () => {
  const feed = {
    gameData: { probablePitchers: { away: { id: 11 }, home: { id: 22 } }, teams: { away: { id: 1 }, home: { id: 2 } }, players: {} },
    liveData: { boxscore: { teams: { away: { players: {}, battingOrder: [] }, home: { players: {}, battingOrder: [] } } } },
  }
  const ids = startingIdsFor(feed)
  assert.deepEqual([...ids].sort(), [11, 22])
})
