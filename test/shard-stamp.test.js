import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeShards, writeShardsWithStamp } from '../scripts/lib/io.js'
import { collectDatasets, evaluate } from '../scripts/check-data-freshness.mjs'

// A DIRECTORY dataset can only report its age through an index.json — the
// freshness guard reads that one file and nothing else. glove-target/ shipped
// without one on 2026-09-10, so the guard could not check it, counted it as
// unstamped, went one over UNSTAMPED_BUDGET, and failed the nightly job on
// 2026-09-11/12/13 while every generator in that job kept working. These tests
// are the two halves of that: the stamp is written, and the guard sees it.

const fresh = () => mkdtempSync(join(tmpdir(), 'bbsbh-shard-stamp-'))
const list = (dir) => readdirSync(dir).sort()
const read = (dir, f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))

test('a stamped run writes the shards and one index beside them', async () => {
  const dir = join(fresh(), 'glove-target')
  const { written } = await writeShardsWithStamp(
    dir,
    [
      ['00', { season: 2026, pit: {} }],
      ['01', { season: 2026, pit: {} }],
    ],
    { season: 2026, buckets: 2 },
  )
  assert.deepEqual(list(dir), ['00.json', '01.json', 'index.json'])
  // `written` counts SHARDS. The index is an implementation detail of the
  // stamp, and a generator that logs "wrote N bucket(s)" must not say 3.
  assert.equal(written, 2)
  const index = read(dir, 'index.json')
  assert.equal(index.season, 2026)
  assert.equal(index.buckets, 2)
  assert.ok(Date.now() - Date.parse(index.generatedAt) < 60_000, 'stamp is this run')
})

// The trap that decides WHERE the index write goes. writeShards deletes every
// *.json its own run did not write, so an index written after the shards is an
// index the next run sweeps — and that sweep is silent apart from a count the
// generator prints as a real swept shard.
test('the next run keeps the index and reports no phantom sweep', async () => {
  const dir = join(fresh(), 'glove-target')
  const shards = [['00', { season: 2026, pit: {} }]]
  await writeShardsWithStamp(dir, shards, { season: 2026, buckets: 1 })
  const first = read(dir, 'index.json').generatedAt

  const { written, swept } = await writeShardsWithStamp(dir, shards, { season: 2026, buckets: 1 })
  assert.deepEqual(list(dir), ['00.json', 'index.json'])
  assert.equal(written, 1)
  assert.equal(swept, 0, 'the index must not be swept and counted as a lost shard')
  assert.ok(Date.parse(read(dir, 'index.json').generatedAt) >= Date.parse(first))
})

// The sweep still has to do its job around the index: a bucket that empties out
// must go, or a shard outlives the pitchers it describes.
test('a shard the run no longer writes is still swept', async () => {
  const dir = join(fresh(), 'glove-target')
  await writeShardsWithStamp(dir, [['00', {}], ['01', {}]], { season: 2026, buckets: 2 })
  const { written, swept } = await writeShardsWithStamp(dir, [['00', {}]], {
    season: 2026,
    buckets: 1,
  })
  assert.deepEqual(list(dir), ['00.json', 'index.json'])
  assert.equal(written, 1)
  assert.equal(swept, 1)
})

// No upstream season is a legitimate exit, and the generator takes it with
// process.exit(0). Without a stamp it would leave a bare directory the guard
// cannot tell from a generator that produced nothing — which is the whole
// failure shape check-data-freshness.mjs exists for.
test('a run with nothing to write is still stamped', async () => {
  const dir = join(fresh(), 'glove-target')
  const { written, swept } = await writeShardsWithStamp(dir, [], { season: null, buckets: 0 })
  assert.deepEqual(list(dir), ['index.json'])
  assert.equal(written, 0)
  assert.equal(swept, 0)
  assert.equal(read(dir, 'index.json').season, null)
})

// End to end: the guard has to actually read what the helper writes. Two
// directories, one stamped and one not, driven through the guard's own
// collector rather than a hand-built fixture.
test('the freshness guard checks a stamped directory and cannot check a bare one', async () => {
  const data = fresh()
  await writeShardsWithStamp(join(data, 'stamped'), [['00', {}]], { season: 2026, buckets: 1 })
  await writeShards(join(data, 'bare'), [['00', {}]])

  const datasets = collectDatasets(data)
  const byName = Object.fromEntries(datasets.map((d) => [d.name, d]))
  assert.ok(byName['stamped/'].stamp?.value, 'index.json is the directory stamp')
  assert.equal(byName['bare/'].stamp, null)

  const { unstamped, stale, checked } = evaluate(datasets)
  assert.deepEqual(unstamped, ['bare/'])
  assert.deepEqual(stale, [])
  assert.equal(checked, 1)
})

// And the age check has to bite through the index, or the stamp is decoration.
test('a stamped directory the cron stopped writing reads as stale', async () => {
  const data = fresh()
  const dir = join(data, 'stamped')
  await writeShardsWithStamp(dir, [['00', {}]], { season: 2026, buckets: 1 })
  writeFileSync(
    join(dir, 'index.json'),
    JSON.stringify({ generatedAt: '2026-09-10T07:10:00Z', season: 2026, buckets: 1 }),
  )
  const { stale } = evaluate(collectDatasets(data), { now: Date.parse('2026-09-13T12:44:00Z') })
  assert.equal(stale.length, 1)
  assert.equal(stale[0].name, 'stamped/')
})
