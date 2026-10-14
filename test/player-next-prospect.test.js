// The new player page's Prospect performance view (modules/prospect/prospectView.js, #2068).
import test from 'node:test'
import assert from 'node:assert/strict'
import { prospectView } from '../src/screens/player/next/modules/prospect/prospectView.js'

const snapshot = {
  generatedAt: '2026-10-14T07:02:56.386Z',
  levelAverageAge: { 12: 25.1 },
  players: [
    { playerId: 815394, group: 'hitting', sportId: 12, percentile: 86, qualified: true, sampleSize: 268, populationSize: 640, movement: null, history: [] },
    { playerId: 808207, group: 'pitching', sportId: 12, percentile: 75, qualified: true, sampleSize: 69, populationSize: 757, movement: { delta: 7, sinceDate: '2026-10-01' }, history: [] },
    { playerId: 800724, group: 'hitting', sportId: 12, percentile: null, qualified: false, sampleSize: 28, populationSize: 640, movement: null, history: [] },
  ],
}
const tenure = { levels: { AA: { hitting: { unit: 'pa', median: 410, n: 366 }, pitching: { unit: 'outs', median: 205, n: 437 } } } }
const milb = (id, birthDate) => ({ id, birthDate, team: { id: 1, parentOrgId: 158 } })

test('qualified hitter: percentile tile, comparison, sample, no movement fact while movement is null', () => {
  const v = prospectView(snapshot, tenure, milb(815394, '2005-09-01'), null)
  assert.equal(v.state, 'qualified')
  assert.equal(v.count, 'AA')
  assert.deepEqual([v.pct, v.ordinal, v.metric, v.standing], [86, '86th', 'OPS', 'Top 14% OPS'])
  assert.equal(v.heading, 'OPS vs AA')
  assert.equal(v.comparison, 'Compared with 640 qualified AA hitters with at least 40 PA')
  assert.equal(v.confidence, 'Established sample · 268 PA')
  assert.equal(v.movement, null)
  assert.equal(v.tenure, '268 PA, about 65% of a typical AA stay (median 410 PA)')
  assert.match(v.age, /^4 years younger than the average qualified AA hitter\.$/)
})

test('qualified pitcher: innings, not outs, and a movement fact when the file has one', () => {
  const v = prospectView(snapshot, tenure, milb(808207, '2002-07-01'), null)
  assert.equal(v.metric, 'ERA')
  assert.equal(v.comparison, 'Compared with 757 qualified AA pitchers with at least 10.0 IP')
  assert.equal(v.confidence, 'Building sample · 23.0 IP')
  assert.equal(v.movement, 'Up 7 percentile points since Oct 1')
  assert.equal(v.tenure, '23.0 IP, about 34% of a typical AA stay (median 68.1 IP)')
})

test('unqualified: count of the floor, no percentile', () => {
  const v = prospectView(snapshot, tenure, milb(800724, '2005-11-01'), null)
  assert.equal(v.state, 'unqualified')
  assert.deepEqual([v.count, v.heading, v.title, v.need], ['AA', 'OPS vs AA', 'Early sample · 28 PA', '40 PA needed to join the qualified AA hitters population.'])
  assert.equal(v.pct, undefined)
  assert.equal(v.tenure, '28 PA, about 7% of a typical AA stay (median 410 PA)')
})

test('none hides the card: no trend row, an MLB player, or a page dated before the file\'s season', () => {
  assert.equal(prospectView(snapshot, tenure, milb(835022, '2007-01-01'), null), null)
  assert.equal(prospectView(snapshot, tenure, { id: 815394, team: { id: 158, parentOrgId: null } }, null), null)
  assert.equal(prospectView(snapshot, tenure, milb(815394, '2005-09-01'), '2025-09-14'), null)
  assert.ok(prospectView(snapshot, tenure, milb(815394, '2005-09-01'), '2026-09-14'))
})
