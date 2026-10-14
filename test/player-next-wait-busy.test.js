// Slot holds its height until nothing inside the module says aria-busy="true"
// (Slot.jsx Probe, #2073 slice 07a). A module whose loading block lacks aria-busy
// would end the hold at once and let the card jump when the data lands.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../src/screens/player/next/modules', import.meta.url).pathname
const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.jsx') ? [p] : []
  })

test('every module wait block returned as a <div> carries aria-busy', () => {
  const bad = []
  for (const f of files(ROOT)) {
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/return .*<div className="[^"]*--(wait|loading)\b/.test(line) && !line.includes('aria-busy')) {
          bad.push(`${f.slice(ROOT.length + 1)}:${i + 1}`)
        }
      })
  }
  assert.deepEqual(bad, [])
})
