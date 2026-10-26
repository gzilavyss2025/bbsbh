// The Field tab's defense (#2566, round 2 item 8), clamped to the reader's
// step. Pinned on 824716 SEA@BOS (test/fixtures/game-824716.gameday.json).
// computeHalfInningFeed's entries for the halves used below:
//  - top 7: 0 White for Rafaela (CF), 1 Kiner-Falefa for Sogard (2B), 2 the
//    first at-bat, thrown by Gamboa (his change leads the half, before a pitch).
//  - bottom 9: 0 the first at-bat (Milner, whose change leads the half), 1 the
//    pinch hitter, 2-3 at-bats, 4 mound visit, 5 Muñoz for Milner, 6 at-bat.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { defenseAt } from '../src/api/gameday/defense.js'

const feed = JSON.parse(readFileSync(new URL('./fixtures/game-824716.gameday.json', import.meta.url), 'utf8'))
const names = (d) => Object.fromEntries(Object.entries(d).map(([pos, p]) => [pos, p.last]))

test("top 2nd: Boston's starters with Paez", () => {
  assert.deepEqual(names(defenseAt(feed, { inning: 2, half: 'top', step: 2, revealedThrough: 1 })), {
    C: 'Wong', '1B': 'Gasper', '2B': 'Sogard', SS: 'Story', '3B': 'Durbin',
    LF: 'Duran', CF: 'Rafaela', RF: 'Anthony', DH: 'Abreu', P: 'Paez',
  })
})

test("bottom 6th: Seattle's starters with Woo", () => {
  const d = defenseAt(feed, { inning: 6, half: 'bottom', step: 3, revealedThrough: 10 })
  assert.equal(d.P.last, 'Woo')
  assert.equal(d.LF.last, 'Arozarena')
  assert.equal(d.P.id, 693433)
})

test('top 7th: the changes count once their step is revealed, and not before', () => {
  const before = defenseAt(feed, { inning: 7, half: 'top', step: 0, revealedThrough: 12 })
  assert.equal(before.CF.last, 'Rafaela')
  assert.equal(before['2B'].last, 'Sogard')
  assert.equal(before.P.last, 'Olds')
  const after = defenseAt(feed, { inning: 7, half: 'top', step: 3, revealedThrough: 12 })
  assert.equal(after.CF.last, 'White')
  assert.equal(after['2B'].last, 'Kiner-Falefa')
  assert.equal(after.P.last, 'Gamboa')
})

test('bottom 9th: Robles in LF; Milner until Muñoz’s change is revealed', () => {
  const at = (step) => defenseAt(feed, { inning: 9, half: 'bottom', step, revealedThrough: 16 })
  assert.equal(at(0).LF.last, 'Robles')
  assert.equal(at(0).P.last, 'Ferrer') // Milner's change leads the half: not on screen yet
  assert.equal(at(4).P.last, 'Milner')
  assert.equal(at(6).P.last, 'Muñoz')
})

test('a half past revealedThrough + 1 answers null; a stepped half reads null step as 0', () => {
  assert.equal(defenseAt(feed, { inning: 9, half: 'bottom', step: 6, revealedThrough: 14 }), null)
  assert.equal(defenseAt(feed, { inning: 9, half: 'bottom', step: null, revealedThrough: 16 }).P.last, 'Ferrer')
  assert.equal(defenseAt(feed, { inning: 9, half: 'bottom', step: null, revealedThrough: 17 }).P.last, 'Muñoz')
})

// Two mutated copies of 824716's top 3rd (Boston in the field).
const ev = (eventType, id, pos) => ({ type: 'action', isPitch: false, details: { eventType, description: '' }, player: { id }, position: { abbreviation: pos } })
const top3 = (f) => f.liveData.plays.allPlays.filter((p) => p.about.inning === 3 && p.about.halfInning === 'top')
const top4 = (f) => defenseAt(f, { inning: 4, half: 'top', step: 0, revealedThrough: 6 })

test("the other club's move never lands in this defense (defenseEntering's roster gate)", () => {
  const f = structuredClone(feed)
  top3(f)[1].playEvents.unshift(ev('defensive_switch', 668227, '3B')) // Arozarena, a Mariner
  assert.equal(top4(f)['3B'].last, 'Durbin')
})

test('a position player who takes the mound leaves his old spot', () => {
  const f = structuredClone(feed)
  const last = top3(f).at(-1)
  last.playEvents.unshift(ev('pitching_substitution', 681508, 'P')) // Gasper, Boston's 1B
  last.matchup.pitcher = { id: 681508 }
  const d = top4(f)
  assert.equal(d.P.last, 'Gasper')
  assert.notEqual(d['1B']?.id, 681508)
})
