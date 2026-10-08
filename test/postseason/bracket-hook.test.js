// usePostseasonBracket, the one door the UI slices use (#1227). Two rules the
// hook itself must keep, and a render cannot show: the cutoff never passes
// today, and Scores Unlocked does not apply (Gary's decision, 2026-09-28) —
// the bracket code never reads the switch and writes nothing to storage.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { bracketCutoff, bracketFor, usePostseasonBracket } from '../../src/hooks/postseason/usePostseasonBracket.js'

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
    ...readdirSync(new URL('../../src/lib/postseason/primer/', import.meta.url)).map(
      (f) => new URL(`../../src/lib/postseason/primer/${f}`, import.meta.url),
    ),

    // The primer's right column (the small bracket and the leaders ledger).
    new URL('../../src/components/bracket/BracketNow.jsx', import.meta.url),
    new URL('../../src/components/postseason/SeriesLeadersLedger.jsx', import.meta.url),
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

// Review of #1233: useAsync keeps the last cutoff's data for one render after
// the cutoff changes. Paging from 10-06 back to 10-05 would then draw the
// bracket heading into 10-06 on 10-05's slate — a later result on an earlier
// date. The hook hands back a bracket only when it was built for THIS cutoff.
test('a bracket built for another cutoff is never handed back', () => {
  const built = { cutoff: '2025-10-06', series: [] }
  assert.equal(bracketFor(built, '2025-10-06'), built)
  assert.equal(bracketFor(built, '2025-10-05'), null)
  assert.equal(bracketFor(null, '2025-10-05'), null)
  assert.equal(bracketFor(built, null), null)
})

// The series pages' parts stand on the same footing (ADR-0087 d.3, d.4): no
// seal, no kraft token, no read of Scores Unlocked.
test('the series pages never seal and never read Scores Unlocked', () => {
  const dir = (rel) =>
    readdirSync(new URL(`../../src/${rel}/`, import.meta.url), { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => new URL(`../../src/${rel}/${e.name}`, import.meta.url))
  const files = [
    ...dir('components/postseason'),
    ...dir('components/postseason/edges'),
    ...dir('hooks/postseason'),
    ...dir('screens/postseason-live'),
    ...dir('styles/postseason'),
    new URL('../../src/screens/PostseasonSeriesPage.jsx', import.meta.url),
  ]
  for (const url of files) {
    const src = readFileSync(fileURLToPath(url), 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    for (const banned of ['useScoresUnlocked', 'spoilersOffFor', 'SealBox', '--seal']) {
      assert.ok(!src.includes(banned), `${fileURLToPath(url)} uses ${banned}`)
    }
  }
})
