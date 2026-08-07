// Writes the READ-SIDE view of the rookie dataset: public/data/rookies/.
//
// public/data/rookies.json stays the master record — one append-only
// {debutDate, rookieUntil} row per player who has ever debuted, owned by
// gen-rookies-backfill.mjs (the one-time historical sweep) and gen-rookies.mjs
// (the nightly append/close job). The app never fetches it: at 21,000+ rows it
// is 1.2 MB, and every game page was downloading and parsing all of it to draw
// a pill. This module derives two much cheaper views from it, and BOTH
// generators call it after they write the master, so the two can never drift.
//
//   rookies/status.json        { generatedAt, players: { id: 1 | 0 } }
//   rookies/records/{NN}.json  { players: { id: {debutDate, rookieUntil} } }
//
// status.json is the whole-league answer the ROOKIE and DEBUT pills need and
// nothing else — 1 = rookie window still open, 0 = closed — about a fifth of
// the master's size. It cannot be id-sharded: a game asks about ~80 scattered
// personIds at once, which would touch nearly every shard. The DATES are only
// ever wanted one player at a time (the player page's timeline), so those keep
// the full record and ARE id-sharded, on the same personId % 100 buckets the
// reader computes (rookieShardKey, src/api/rookies.js — imported, never
// re-implemented here, since the two must agree exactly).
import { join } from 'node:path'
import { writeJsonAtomic } from './io.js'
import { rookieShardKey } from '../../src/api/rookies.js'

export async function writeRookieShards(dataDir, master) {
  const outDir = join(dataDir, 'rookies')
  const status = {}
  const buckets = new Map() // shard key -> { [id]: record }

  for (const [id, rec] of Object.entries(master.players ?? {})) {
    status[id] = rec?.rookieUntil === null || rec?.rookieUntil === undefined ? 1 : 0
    const key = rookieShardKey(id)
    if (!buckets.has(key)) buckets.set(key, {})
    buckets.get(key)[id] = rec
  }

  for (const [key, players] of buckets) {
    await writeJsonAtomic(join(outDir, 'records', `${key}.json`), { players })
  }
  await writeJsonAtomic(join(outDir, 'status.json'), {
    generatedAt: master.generatedAt ?? null,
    players: status,
  })
  return { players: Object.keys(status).length, shards: buckets.size }
}
