// The bench/bullpen cards' strike-through, read as of the half ON SCREEN.
//
// The rule these pin: a roster row is crossed off only when the player's entry
// sits at or below BOTH ceilings — the reveal mark (never hint at a sealed
// half) and the half the reader is looking at (never claim a 1st-inning bench
// was missing a man who pinch-hit in the 8th). The second was missing, so a
// reader who unsealed a whole game and paged back to the top of the 1st found
// every late substitute already crossed off there.
import assert from 'node:assert/strict'
import test from 'node:test'
import { enteredAsOf, halfIndex, selectBench, selectBullpen } from '../src/api/select.js'

const TOP_8 = halfIndex(8, 'top') // 14
const FINAL = halfIndex(9, 'bottom') // 17

// A nine-inning game in which one bench catcher pinch-hits in the top of the
// 8th and one reliever throws that same half. Only the fields the two card
// selectors read.
function feed() {
  return {
    gameData: {
      players: {
        ID1: { id: 1, lastFirstName: 'Raleigh, Cal', primaryNumber: '29', primaryPosition: { abbreviation: 'C' } },
        ID2: { id: 2, lastFirstName: 'Bench, Warm', primaryNumber: '7', primaryPosition: { abbreviation: '2B' } },
        ID3: { id: 3, lastFirstName: 'Arm, Late', primaryNumber: '55', primaryPosition: { abbreviation: 'P' }, pitchHand: { description: 'Right' } },
        ID4: { id: 4, lastFirstName: 'Starter, Sam', primaryNumber: '1', primaryPosition: { abbreviation: 'P' }, pitchHand: { description: 'Left' } },
      },
    },
    liveData: {
      boxscore: {
        teams: {
          away: {
            players: {
              ID1: { person: { id: 1 }, jerseyNumber: '29', gameStatus: { isSubstitute: true }, position: { abbreviation: 'PH' }, allPositions: [{ abbreviation: 'PH' }] },
              ID2: { person: { id: 2 }, jerseyNumber: '7', position: { abbreviation: '2B' }, allPositions: [{ abbreviation: '2B' }] },
              ID3: { person: { id: 3 }, jerseyNumber: '55', position: { abbreviation: 'P' }, allPositions: [{ abbreviation: 'P' }] },
              ID4: { person: { id: 4 }, jerseyNumber: '1', position: { abbreviation: 'P' }, allPositions: [{ abbreviation: 'P' }] },
            },
            bench: [2],
            bullpen: [3],
            pitchers: [4, 3],
          },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 1, halfInning: 'top' },
            matchup: { pitcher: { id: 4 } },
            playEvents: [{ isPitch: true }],
          },
          {
            about: { inning: 8, halfInning: 'top' },
            matchup: { pitcher: { id: 3 } },
            playEvents: [
              { details: { eventType: 'offensive_substitution' }, player: { id: 1 } },
              { isPitch: true },
            ],
          },
        ],
      },
    },
  }
}

test('enteredAsOf keeps the lower of the reveal mark and the half on screen', () => {
  const sub = { enteredIdx: TOP_8 }
  // Replay: the whole game is unsealed, but the page is showing the 1st.
  assert.equal(enteredAsOf(sub, FINAL, halfIndex(1, 'top')), false)
  assert.equal(enteredAsOf(sub, FINAL, halfIndex(7, 'bottom')), false)
  // The half he entered in, and every half after it.
  assert.equal(enteredAsOf(sub, FINAL, TOP_8), true)
  assert.equal(enteredAsOf(sub, FINAL, halfIndex(9, 'top')), true)
  // The reveal mark is still a ceiling: standing on the SEALED next half must
  // not report an entry the reader has not reached (ADR-0005).
  assert.equal(enteredAsOf(sub, TOP_8 - 1, TOP_8), false)
  // Scoring forward, the two ceilings agree — the live flow is unchanged.
  assert.equal(enteredAsOf(sub, TOP_8, TOP_8), true)
  // A player who never entered is never struck, and a null half means "no one
  // half in view" — the reveal mark alone decides.
  assert.equal(enteredAsOf({ enteredIdx: null }, FINAL, TOP_8), false)
  assert.equal(enteredAsOf(sub, FINAL, null), true)
  assert.equal(enteredAsOf(undefined, FINAL, TOP_8), false)
})

test('a pinch-hitter is available again when the reader pages back to the 1st', () => {
  const [ph] = selectBench(feed(), 'away').filter((p) => p.id === 1)
  assert.equal(ph.enteredIdx, TOP_8)
  assert.equal(enteredAsOf(ph, FINAL, halfIndex(1, 'top')), false)
  assert.equal(enteredAsOf(ph, FINAL, TOP_8), true)
  // The bench man who never left it is available at every half.
  const [warm] = selectBench(feed(), 'away').filter((p) => p.id === 2)
  assert.equal(enteredAsOf(warm, FINAL, TOP_8), false)
})

test('a reliever is back in the bullpen when the reader pages back before his entry', () => {
  const [arm] = selectBullpen(feed(), 'away').filter((p) => p.id === 3)
  assert.equal(arm.enteredIdx, TOP_8)
  assert.equal(enteredAsOf(arm, FINAL, halfIndex(4, 'bottom')), false)
  assert.equal(enteredAsOf(arm, FINAL, TOP_8), true)
})
