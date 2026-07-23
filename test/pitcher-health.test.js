// Unit coverage for the in-game "laboring" read (src/api/pitcherHealth.js's
// laboringFor) — regression pin for the Margin Notes "Laboring" text
// (pitcher-callouts.js) reading `ip` off this function's return value rather
// than a hardcoded "tonight", which was wrong for a day game and didn't say
// what the rate was measured through.
import assert from 'node:assert/strict'
import test from 'node:test'
import { laboringFor } from '../src/api/pitcherHealth.js'

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
