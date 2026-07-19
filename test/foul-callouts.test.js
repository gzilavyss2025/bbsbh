import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  foulCountsFromCodes,
  buildCallouts,
  buildFoulVolumeNote,
  buildBullpenThinNote,
} from '../src/api/callout-notes.js'

// --- foulCountsFromCodes: the strike simulation behind the marathon card ----

test('counts fouls and two-strike fouls from a code sequence', () => {
  // ball, called, whiff (0-2), then three fouls at two strikes, in play
  const r = foulCountsFromCodes(['B', 'C', 'S', 'F', 'F', 'F', 'X'])
  assert.equal(r.fouls, 3)
  assert.equal(r.twoStrikeFouls, 3)
})

test('fouls before two strikes count as fouls only', () => {
  // foul (0-1), foul (0-2), foul at two strikes
  const r = foulCountsFromCodes(['F', 'F', 'F'])
  assert.equal(r.fouls, 3)
  assert.equal(r.twoStrikeFouls, 1)
})

test('a two-strike foul tip is not an AB-extending foul', () => {
  const r = foulCountsFromCodes(['C', 'S', 'T'])
  assert.equal(r.fouls, 1)
  assert.equal(r.twoStrikeFouls, 0) // strike three, caught — the AB ended
})

test('empty and null code lists are safe', () => {
  assert.deepEqual(foulCountsFromCodes([]), { fouls: 0, twoStrikeFouls: 0 })
  assert.deepEqual(foulCountsFromCodes(null), { fouls: 0, twoStrikeFouls: 0 })
})

// --- marathonAb play card ----------------------------------------------------

const BUNDLE = {
  away: { teamId: 1, name: 'Away Club' },
  home: { teamId: 2, name: 'Home Club' },
}

test('marathon at-bat fires at six fouls with the historical prior', () => {
  const entry = {
    atBatIndex: 12,
    batterId: 99,
    eventType: 'single',
    pitches: ['C', 'S', 'F', 'F', 'F', 'F', 'F', 'F', 'D'],
  }
  const notes = buildCallouts(entry, { bundle: BUNDLE, battingSide: 'away' })
  const m = notes.find((n) => n.kind === 'marathonAb')
  assert.ok(m, 'expected a marathonAb note')
  assert.match(m.text, /Fouled off 6 pitches/)
  assert.match(m.text, /\.291/) // six two-strike fouls easily clears the prior floor
  assert.equal(m.score, 45)
})

test('five fouls is not a marathon', () => {
  const entry = {
    atBatIndex: 3,
    batterId: 99,
    eventType: 'field_out',
    pitches: ['F', 'F', 'F', 'F', 'F', 'X'],
  }
  const notes = buildCallouts(entry, { bundle: BUNDLE, battingSide: 'home' })
  assert.equal(notes.find((n) => n.kind === 'marathonAb'), undefined)
})

// --- foulVolume pre-half note ------------------------------------------------

function volumeFeed({ pitcherIds }) {
  // Two away batting halves (top 1, top 2) vs the home pitcher(s): 60 pitches,
  // 20 of them fouls — far past the 1.35× gate at a 0.19 league rate.
  const plays = []
  for (let half = 0; half < 2; half++) {
    for (let i = 0; i < 6; i++) {
      const pid = pitcherIds[Math.min(half, pitcherIds.length - 1)]
      plays.push({
        about: { inning: half + 1, halfInning: 'top' },
        matchup: { pitcher: { id: pid }, batter: { id: 10 + i } },
        playEvents: [
          ...Array.from({ length: 3 }, () => ({ isPitch: true, details: { code: 'B' } })),
          ...Array.from({ length: 2 }, () => ({ isPitch: true, details: { code: 'F' } })),
        ],
      })
    }
  }
  return {
    gameData: {
      players: {
        ID77: { fullName: 'Brandon Woodruff', lastName: 'Woodruff', firstName: 'Brandon' },
        ID78: { fullName: 'Reliever Guy', lastName: 'Guy', firstName: 'Reliever' },
      },
    },
    liveData: { plays: { allPlays: plays } },
  }
}

test('foulVolume fires on a foul-heavy count off a lone starter', () => {
  const bundle = { ...BUNDLE, foulRate: { perPitch: 0.19 } }
  const note = buildFoulVolumeNote(volumeFeed({ pitcherIds: [77] }), bundle, 3, 'top')
  assert.ok(note, 'expected a foulVolume note')
  assert.match(note.text, /fouled off 24 of Woodruff's 60 pitches/)
  assert.equal(note.personId, 77)
  assert.equal(note.side, 'away')
})

test('foulVolume stands down once the starter is out', () => {
  const bundle = { ...BUNDLE, foulRate: { perPitch: 0.19 } }
  assert.equal(buildFoulVolumeNote(volumeFeed({ pitcherIds: [77, 78] }), bundle, 3, 'top'), null)
})

test('foulVolume needs the league baseline (MiLB bundles lack it)', () => {
  assert.equal(buildFoulVolumeNote(volumeFeed({ pitcherIds: [77] }), BUNDLE, 3, 'top'), null)
})

// --- bullpenThin pre-half note -----------------------------------------------

function workloadWith(entries) {
  return { season: 2026, asOf: '2026-07-18', pitchers: entries, baselines: {} }
}
// Three straight days of work ending the day before the game.
const threeStraight = (teamId) => ({
  name: 'Tired Arm',
  teamId,
  role: 'RP',
  apps: [
    { d: '2026-07-18', p: 18, gs: 0 },
    { d: '2026-07-17', p: 15, gs: 0 },
    { d: '2026-07-16', p: 12, gs: 0 },
  ],
  season: { g: 40, gs: 0, pitches: 600, outs: 120, bf: 160, strikes: 400 },
})
const fresh = (teamId) => ({
  name: 'Fresh Arm',
  teamId,
  role: 'RP',
  apps: [{ d: '2026-07-10', p: 12, gs: 0 }],
  season: { g: 30, gs: 0, pitches: 400, outs: 90, bf: 120, strikes: 260 },
})

test('bullpenThin fires when two relievers are down', () => {
  const workload = workloadWith({
    501: { ...threeStraight(2), name: 'Arm One' },
    502: { ...threeStraight(2), name: 'Arm Two' },
    503: fresh(2),
  })
  const note = buildBullpenThinNote(BUNDLE, 'home', workload, '2026-07-19')
  assert.ok(note, 'expected a bullpenThin note')
  assert.match(note.text, /2 Home Club relievers/)
  assert.match(note.text, /Arm One, Arm Two/)
  assert.equal(note.score, 40)
})

test('bullpenThin stays quiet with one arm down or a stale file', () => {
  const oneDown = workloadWith({ 501: threeStraight(2), 503: fresh(2) })
  assert.equal(buildBullpenThinNote(BUNDLE, 'home', oneDown, '2026-07-19'), null)
  const twoDown = workloadWith({ 501: threeStraight(2), 502: threeStraight(2) })
  assert.equal(buildBullpenThinNote(BUNDLE, 'home', twoDown, '2026-08-19'), null)
})
