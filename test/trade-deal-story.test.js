// The trade simulator's deal as a wire story (src/screens/trade/dealStory.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dealStory } from '../src/screens/trade/dealStory.js'

const MIL = 158, AZ = 109
const text = (story) => story.cutline.map((s) => s.text).join('')

test('a deal reads as the wire writes a trade, from the first club', () => {
  const ashby = { id: 1, name: 'Aaron Ashby', pos: 'P', throws: 'L', onForty: true }
  const carroll = { id: 2, name: 'Corbin Carroll', pos: 'RF', onForty: true }
  const s = dealStory({ a: MIL, b: AZ, sendsA: [ashby], sendsB: [carroll], picksB: [{ year: 2027, round: 'A', number: 31 }] })
  assert.equal(text(s), 'Acquired RF Corbin Carroll from the Arizona Diamondbacks for LHP Aaron Ashby. The Brewers also get a 2027 Competitive Balance Round A pick.')
  // The partner club is linked, so the row draws its mark; the faces carry In / Out.
  assert.equal(s.cutline.find((seg) => seg.teamId)?.teamId, AZ)
  assert.deepEqual(s.rail.map((r) => [r.playerId, r.banner]), [[2, 'In'], [1, 'Out']])
})

test('picks and cash alone are no wire story', () => {
  assert.equal(dealStory({ a: MIL, b: AZ, sendsA: [], sendsB: [], cashA: 2 }), null)
})
