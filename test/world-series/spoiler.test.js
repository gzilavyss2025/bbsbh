// The event notes are reachable only from the modules that own a gate. The reveal-only builder
// (buildWsLastTimeGameNotes) may be imported only by the manifest's importer list.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(join(dir, d.name)) : /\.(jsx?|mjs)$/.test(d.name) ? [join(dir, d.name)] : [])
const importing = (re) => walk('src').filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.slice(4)).sort()
const manifest = JSON.parse(readFileSync('src/api/spoiler-manifest.json', 'utf8'))
const find = (o) => (o && typeof o === 'object' ? o['callout-notes/worldSeriesEvents.js'] ?? Object.values(o).map(find).find(Boolean) : undefined)
const entry = find(manifest)

test('the manifest classes the module mixed, with the roll-up builder reveal-only', () => {
  assert.equal(entry.class, 'mixed')
  assert.deepEqual(entry.revealOnlyExports, ['buildWsLastTimeGameNotes'])
})

test('only the roll-up imports the reveal-only builder, and it is on the importer list', () => {
  const names = importing(/buildWsLastTimeGameNotes[^;]*from\s+['"][^'"]*worldSeriesEvents/s).filter((f) => !f.endsWith('worldSeriesEvents.js'))
  assert.deepEqual(names, ['api/callout-notes/rollup.js'])
  for (const f of names) assert.ok(entry.importers.includes(f), f)
})

test('the module has the callers it has a gate for, and no others', () => {
  assert.deepEqual(importing(/worldSeriesEvents\.js['"]/), [
    'api/callout-notes/liveAtBat.js',
    'api/callout-notes/rollup.js',
    'api/prehalf-callouts.js',
    'hooks/postseason/useWsEvents.js',
  ])
})
