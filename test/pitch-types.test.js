// The pitch-type language (src/lib/pitch/pitchTypes.js, docs/pitch-types.md).
// These cases pin the rules that keep it a shared language: no two pitches may
// share a mark, and an unknown code must degrade, not throw.
import assert from 'node:assert/strict'
import test from 'node:test'
import { PITCH_FAMILIES, PITCH_TYPES, pitchMark } from '../src/lib/pitch/pitchTypes.js'

test('every pitch code is unique and names a real family', () => {
  const codes = PITCH_TYPES.map((t) => t.code)
  assert.equal(new Set(codes).size, codes.length)
  for (const t of PITCH_TYPES) assert.ok(PITCH_FAMILIES[t.family], `${t.code} has no family`)
})

test('no two pitches share a shape, colour and fill', () => {
  const seen = new Map()
  for (const t of PITCH_TYPES) {
    const m = pitchMark(t.code)
    const key = `${m.shape}|${m.color}|${m.ring}`
    assert.ok(!seen.has(key), `${t.code} looks the same as ${seen.get(key)}`)
    seen.set(key, t.code)
  }
})

test('a ring mark sits beside a solid mark of the same family', () => {
  for (const t of PITCH_TYPES.filter((x) => x.ring)) {
    assert.ok(PITCH_TYPES.some((x) => !x.ring && x.family === t.family), `${t.code} has no solid sibling`)
  }
})

test('the mark follows the family shape', () => {
  assert.equal(pitchMark('FF').shape, 'circle')
  assert.equal(pitchMark('ST').shape, 'diamond')
  assert.equal(pitchMark('CH').shape, 'square')
  assert.equal(pitchMark('KN').shape, 'triangle')
})

test('a code is case-blind and an unknown code gets the hollow hexagon', () => {
  assert.equal(pitchMark('ff').code, 'FF')
  for (const bad of ['PO', '', null, undefined]) {
    const m = pitchMark(bad)
    assert.deepEqual([m.code, m.shape, m.ring], ['UN', 'hexagon', true])
  }
})

// #2974: even brightness, 3:1 on light and dark paper. Grounds are the shipped
// --surface-card / --surface-inset hexes in each theme (src/tokens/colors.css).
import { auditPitchPalette } from '../src/lib/pitch/pitchLuminance.js'
const GROUNDS = { 'light card': '#FBF6E9', 'light inset': '#FFFDF6', 'dark card': '#121212', 'dark inset': '#1C1C1C' }

test('the shipped palette is even in brightness and clears 3:1 on both papers', () => {
  assert.deepEqual(auditPitchPalette(GROUNDS), [])
})

test('the audit catches a pale pitch, a loud pitch and a loud UN', () => {
  const swap = (code, color) => PITCH_TYPES.map((t) => (t.code === code ? { ...t, color } : t))
  const pale = auditPitchPalette(GROUNDS, swap('KN', '#EEF2F7'))
  assert.ok(pale.some((f) => f.startsWith('KN #EEF2F7')), 'KN fails 3:1 on light paper')
  assert.ok(pale.some((f) => f.startsWith('luminance spread')), 'KN breaks the band')
  assert.ok(auditPitchPalette(GROUNDS, swap('SL', '#2266EE')).some((f) => f.startsWith('luminance spread')))
  assert.ok(auditPitchPalette(GROUNDS, undefined, { code: 'UN', color: '#FA1400' }).some((f) => f.startsWith('UN')))
})
