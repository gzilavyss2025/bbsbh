import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// renderCard(g, idx, pickDate = dateStr) takes the day a card opens as its third
// argument. Handing it straight to Array#map passes the games array there instead,
// so gamePath() throws on every slate card tap and nothing opens (2026-11-05).
test('the slate never passes renderCard straight to .map()', () => {
  const src = readFileSync(new URL('../src/screens/GameSelect.jsx', import.meta.url), 'utf8')
  assert.equal(/\.map\(\s*renderCard\s*\)/.test(src), false)
})
