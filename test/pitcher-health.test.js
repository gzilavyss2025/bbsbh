// Unit coverage for the in-game "laboring" read (src/api/pitcherHealth.js's
// laboringFor) — regression pin for the Margin Notes "Laboring" text
// (pitcher-callouts.js) reading `ip` off this function's return value rather
// than a hardcoded "tonight", which was wrong for a day game and didn't say
// what the rate was measured through.
import assert from 'node:assert/strict'
import test from 'node:test'
import { laboringFor, computeVeloVariety } from '../src/api/pitcherHealth.js'
import { CENTURY_MPH } from '../src/api/pitchArsenal.js'

const workload = (seasonPitches, seasonOuts) => ({ season: { pitches: seasonPitches, outs: seasonOuts } })

test('laboringFor carries the row\'s own reveal-clamped IP for the note text', () => {
  // 60 pitches through 3.0 IP (9 outs) = 20 P/IP; season norm 15.9 P/IP
  // (477 pitches / 90 outs = 15.9) — ratio 1.26, above the 1.15 flag.
  const line = { ip: '3.0', pitches: 60 }
  const r = laboringFor(line, workload(477, 90))
  assert.ok(r)
  assert.equal(r.ip, '3.0')
  assert.equal(r.laboring, true)
  assert.ok(Math.abs(r.pitchesPerInning - 20) < 0.01)
  assert.ok(Math.abs(r.baseline - 15.9) < 0.01)
})

test('laboringFor returns null below the minimum revealed-outs sample (6 outs)', () => {
  const line = { ip: '1.2', pitches: 15 } // 5 outs
  assert.equal(laboringFor(line, workload(477, 90)), null)
})

test('laboringFor returns null without a season baseline (no workload data)', () => {
  const line = { ip: '3.0', pitches: 20 }
  assert.equal(laboringFor(line, undefined), null)
  assert.equal(laboringFor(line, { season: {} }), null)
})

test('laboringFor reports laboring: false for a normal, non-elevated pace', () => {
  // 45 pitches through 3.0 IP = 15 P/IP, under the 15.9 * 1.15 flag line.
  const line = { ip: '3.0', pitches: 45 }
  const r = laboringFor(line, workload(477, 90))
  assert.ok(r)
  assert.equal(r.laboring, false)
})

// --- computeVeloVariety --------------------------------------------------------
const pitch = (typeCode, description, startSpeed) => ({
  isPitch: true,
  details: { type: { code: typeCode, description } },
  pitchData: startSpeed == null ? undefined : { startSpeed },
})
const play = (inning, half, pitcherId, events) => ({
  about: { inning, halfInning: half },
  matchup: { pitcher: { id: pitcherId } },
  playEvents: events,
})
const feedWith = (plays) => ({ liveData: { plays: { allPlays: plays } } })

test('computeVeloVariety counts distinct pitch types at CENTURY_MPH+, sorted fastest first', () => {
  const feed = feedWith([
    play(1, 'top', 300, [
      pitch('FF', 'Four-Seam Fastball', CENTURY_MPH + 1),
      pitch('SI', 'Sinker', CENTURY_MPH + 0.4),
      pitch('SL', 'Slider', 88), // never clears the floor
    ]),
  ])
  const out = computeVeloVariety(feed, 0) // revealedThrough = halfIndex(1, 'top')
  assert.equal(out[300].count, 2)
  assert.deepEqual(
    out[300].types.map((t) => t.code),
    ['FF', 'SI'],
    'fastest reading sorts first',
  )
  assert.equal(out[300].types[0].maxVelo, CENTURY_MPH + 1)
})

test('computeVeloVariety never reads a pitch in a half beyond revealedThrough', () => {
  const feed = feedWith([
    play(1, 'top', 300, [pitch('FF', 'Four-Seam Fastball', CENTURY_MPH + 1), pitch('SI', 'Sinker', CENTURY_MPH + 0.4)]),
    play(2, 'top', 300, [pitch('CU', 'Curveball', CENTURY_MPH + 5)]), // halfIndex 2 — sealed
  ])
  const out = computeVeloVariety(feed, 0) // only inning 1 top revealed
  assert.equal(out[300].count, 2, 'the sealed half\'s curveball must not count')
  assert.ok(
    !out[300].types.some((t) => t.code === 'CU'),
    'a spoiler-risk regression would leak the sealed pitch type in here',
  )
})

test('computeVeloVariety returns nothing for a pitcher with fewer than 2 qualifying types', () => {
  const feed = feedWith([play(1, 'top', 300, [pitch('FF', 'Four-Seam Fastball', CENTURY_MPH + 1)])])
  const out = computeVeloVariety(feed, 0)
  assert.equal(out[300].count, 1)
})
