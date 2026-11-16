import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EXCEPT } from '../scripts/check-data-freshness.mjs'

// Issue #3075. docs/scripts/generators.md lists hand-run generators; EXCEPT in
// scripts/check-data-freshness.mjs exempts their outputs from the nightly
// max-age check. Nothing kept the two in sync, so a hand-run dataset missing
// from EXCEPT passed its PR and turned the nightly job red a day later
// (eliminated.json, #3068). One-way only (Gary, 2026-11-16): every doc entry
// must be in EXCEPT; an EXCEPT entry the doc doesn't list is fine.

const DOC = path.join(import.meta.dirname, '../docs/scripts/generators.md')

// Hand-run outputs that a nightly step ALSO writes, so the freshness check
// must keep watching them. Each value is the reason.
const ALSO_NIGHTLY = {
  'outliers/': 'gen-outliers.mjs runs nightly; its doc entry says so',
  'highlights/': 'the backfill seeds it; gen-highlights.mjs updates it nightly',
  'rookies.json': 'the backfill seeds it; gen-rookies.mjs updates it nightly',
  'from/': 'gen-where-from-map.mjs writes only from/map/; gen-where-from.mjs stamps from/index.json nightly',
}

// The dataset name the freshness guard uses: a top-level file, or `dir/`.
function datasetName(p) {
  const rest = p.replace(/^public\/data\//, '')
  const slash = rest.indexOf('/')
  return slash === -1 ? rest : rest.slice(0, slash + 1)
}

// Each top-level bullet's primary output: the `public/data/...` paths on the
// bullet's first line, after the arrow. Paths mentioned later in a bullet's
// prose are inputs or neighbours, not outputs.
function handRunOutputs(markdown) {
  const start = markdown.indexOf('\n## Hand-run generators')
  assert.ok(start !== -1, 'generators.md has no "## Hand-run generators" section')
  const end = markdown.indexOf('\n## ', start + 1)
  const section = markdown.slice(start, end === -1 ? undefined : end)
  const names = new Set()
  for (const line of section.split('\n')) {
    if (!line.startsWith('- ')) continue
    const arrow = line.indexOf('→')
    if (arrow === -1) continue
    for (const [, p] of line.slice(arrow).matchAll(/`(public\/data\/[^`]+)`/g)) names.add(datasetName(p))
  }
  return [...names]
}

test('datasetName maps a doc path to the freshness guard name', () => {
  assert.equal(datasetName('public/data/eliminated.json'), 'eliminated.json')
  assert.equal(datasetName('public/data/war-history/{NN}.json'), 'war-history/')
  assert.equal(datasetName('public/data/from/map/'), 'from/')
})

test('handRunOutputs reads only the section, and only first-line outputs', () => {
  const md = [
    '## Nightly',
    '- `gen-a.mjs` → `public/data/a.json`',
    '## Hand-run generators (immutable data — NOT on a cron)',
    '- `gen-b.mjs` → `public/data/b/{NN}.json` and `public/data/b/index.json`',
    '  reads `public/data/c.json`',
    '- `gen-d.mjs` → `src/lib/d.js` (not public data)',
    '## Later',
    '- `gen-e.mjs` → `public/data/e.json`',
  ].join('\n')
  assert.deepEqual(handRunOutputs(md), ['b/'])
})

test('every hand-run output in generators.md is exempt in EXCEPT', () => {
  const outputs = handRunOutputs(readFileSync(DOC, 'utf8'))
  // A parser that silently matched nothing would pass vacuously.
  assert.ok(outputs.length >= 20, `only ${outputs.length} hand-run outputs parsed from ${DOC}`)
  const missing = outputs.filter((n) => !(n in EXCEPT) && !(n in ALSO_NIGHTLY))
  assert.deepEqual(
    missing,
    [],
    `Hand-run outputs in docs/scripts/generators.md ("Hand-run generators") missing from EXCEPT: ${missing.join(', ')}.\n` +
      'Add each to EXCEPT in scripts/check-data-freshness.mjs with the reason it is not nightly, ' +
      'or the nightly freshness step will fail. If a nightly step also writes it, add it to ALSO_NIGHTLY in this test instead.',
  )
})

test('ALSO_NIGHTLY entries are not also exempt', () => {
  for (const name of Object.keys(ALSO_NIGHTLY)) assert.ok(!(name in EXCEPT), `${name} is in both EXCEPT and ALSO_NIGHTLY`)
})
