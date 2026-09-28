// usePostseasonBracket, the one door the UI slices use (#1227). Two rules the
// hook itself must keep, and a render cannot show: the cutoff never passes
// today, and Scores Unlocked does not apply (Gary's decision, 2026-09-28) —
// the bracket code never reads the switch and writes nothing to storage.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { bracketCutoff, usePostseasonBracket } from '../../src/hooks/postseason/usePostseasonBracket.js'

test('bracketCutoff caps a future slate date at today', () => {
  assert.equal(bracketCutoff('2026-10-15', '2026-09-28'), '2026-09-28')
  assert.equal(bracketCutoff('2026-09-28', '2026-09-28'), '2026-09-28')
  assert.equal(bracketCutoff('2025-10-09', '2026-09-28'), '2025-10-09')
  assert.equal(bracketCutoff(null, '2026-09-28'), null)
  // Outside the postseason window too: the slate may preview a future date
  // there, but the bracket's results read would then run through today.
  assert.equal(bracketCutoff('2027-04-01', '2027-03-20'), '2027-03-20')
})

test('the hook is a function the UI can call', () => {
  assert.equal(typeof usePostseasonBracket, 'function')
})

test('the bracket code never reads Scores Unlocked and never touches storage', () => {
  const files = [
    ...readdirSync(new URL('../../src/api/postseason/', import.meta.url)).map(
      (f) => new URL(`../../src/api/postseason/${f}`, import.meta.url),
    ),
    new URL('../../src/hooks/postseason/usePostseasonBracket.js', import.meta.url),
  ]
  for (const url of files) {
    const src = readFileSync(fileURLToPath(url), 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    for (const banned of ['useScoresUnlocked', 'spoilersOffFor', 'scoresUnlocked', 'localStorage', 'sessionStorage', 'indexedDB']) {
      assert.ok(!src.includes(banned), `${fileURLToPath(url)} reads ${banned}`)
    }
  }
})
