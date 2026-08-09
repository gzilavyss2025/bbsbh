import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { leanInputFromRows } from '../src/api/umpires.js'

// The season's accuracy data ships as two things, and between them they ARE the
// archive that used to be one 2 MB file: umpire-accuracy-summary.json, every
// umpire's season aggregates (the ranking pool), and umpire-accuracy/{id}.json,
// one man's scored game rows (his game log). No surface loads the league's rows.
//
// That only holds while every figure a surface shows is derivable from the
// aggregates. The lean is the one that nearly wasn't: its ingredient is
// per-game, so the generator sums it into the aggregate as favorNet/
// favorNetGames. These tests hold that seam.

const root = new URL('../public/data/', import.meta.url)
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'))
const summary = read('umpire-accuracy-summary.json')
const rowFiles = readdirSync(new URL('umpire-accuracy/', root)).filter((f) => f.endsWith('.json'))

test('no league-wide archive is served', () => {
  // Deleting it is the point of the split: it was the merge base AND a served
  // file, and a second copy of an append-only history is a second thing that
  // can go stale. The generator reads the row shards back instead.
  assert.throws(() => read('umpire-accuracy.json'), /ENOENT/)
})

test('the aggregates file stays small enough for a lineup page to load', () => {
  const size = statSync(new URL('umpire-accuracy-summary.json', root)).size
  assert.ok(size < 400 * 1024, `aggregates are ${Math.round(size / 1024)} KB`)
  // It must also carry no game rows — that is what keeps it flat as the season
  // grows.
  for (const [id, u] of Object.entries(summary.umpires)) {
    assert.equal(u.games, undefined, `${id}: aggregates carry game rows`)
  }
})

test("each aggregate's lean matches the rows in that umpire's own shard", () => {
  // The seam: the generator sums the rows into favorNet/favorNetGames, the app
  // divides. If the two ever drift, the Tendencies card publishes a number no
  // game log supports — so recompute it here from the shipped rows.
  let checked = 0
  for (const f of rowFiles) {
    const shard = read(`umpire-accuracy/${f}`)
    const rec = summary.umpires[String(shard.id)]
    assert.ok(rec, `${f}: rows with no aggregate`)
    for (const [key, level] of [
      ['season', 'MLB'],
      ['seasonAAA', 'AAA'],
    ]) {
      const agg = rec[key]
      if (!agg) continue
      const { favorNet, favorNetGames } = leanInputFromRows(shard.games, level)
      assert.equal(agg.favorNetGames, favorNetGames, `${f}: ${key} game count`)
      assert.ok(Math.abs((agg.favorNet ?? 0) - favorNet) < 1e-9, `${f}: ${key} net favor`)
      if (favorNetGames) checked++
    }
  }
  assert.ok(checked > 50, `only ${checked} aggregates had a favor-based lean to check`)
})

test('a row shard carries the name its own merge base will need', () => {
  // The shards are the generator's merge base now. Without the name, an umpire
  // who worked in April and not in tonight's window comes back nameless.
  for (const f of rowFiles) {
    const shard = read(`umpire-accuracy/${f}`)
    assert.equal(String(shard.id), f.replace('.json', ''), `${f}: id does not match its name`)
    assert.ok(shard.name, `${f}: no name`)
    assert.ok(Array.isArray(shard.games) && shard.games.length, `${f}: no rows`)
  }
})

// --- what the surfaces fetch --------------------------------------------------

const fetched = []
function stubFetch() {
  fetched.length = 0
  globalThis.fetch = async (url) => {
    fetched.push(url)
    const shard = /^\/data\/umpire-accuracy\/(\d+)\.json$/.exec(url)
    const body =
      url === '/data/umpire-accuracy-summary.json'
        ? SUMMARY
        : shard
          ? { id: Number(shard[1]), name: 'Ada Ump', games: ROWS[shard[1]] ?? [] }
          : UMPIRE_SHARD // /data/umpires/{id}.json — his assignment log
    return { ok: true, status: 200, json: async () => body }
  }
}

const UMPIRE_SHARD = { id: 1, name: 'Ada Ump', season: 2026, generatedAt: 'x', games: [] }

// Two umpires past the five-game ranking floor and one below it.
const ump = (id, name, accuracy, games, lean) => ({
  id,
  name,
  season: {
    games,
    called: 1000,
    correct: Math.round(1000 * accuracy),
    expanded: 20,
    squeezed: 10,
    high: 8,
    low: 6,
    inside: 4,
    outside: 12,
    accuracy,
    cellCalled: Array(9).fill(100),
    cellStrikeCall: Array(9).fill(40),
    cellMiss: [5, 4, 3, 2, 1, 2, 3, 4, 5],
    favorNet: lean * games,
    favorNetGames: games,
  },
  seasonAAA: null,
  seasonPost: null,
})

const SUMMARY = {
  season: 2026,
  umpires: {
    1: ump(1, 'Ada Ump', 0.94, 20, 0.5),
    2: ump(2, 'Bo Ump', 0.91, 12, -0.3),
    3: ump(3, 'Cy Ump', 0.99, 2, 0.1),
  },
}
const ROWS = { 1: [{ gamePk: 1, level: 'MLB', gameType: 'R', favorAway: 0.3, favorHome: 0.2 }] }

test('the umpire page reads one aggregates file and one row shard', async () => {
  stubFetch()
  const mod = await import('../src/api/umpires.js?case=page')
  const u = await mod.loadUmpire(1)
  assert.ok(u.accuracy, 'his aggregate')
  assert.ok(u.accuracy.byGamePk[1], 'his rows')
  assert.equal(u.rank.rank, 1, 'ranked against the pool')
  // The lean comes off the aggregate, so it survives without the league's rows.
  assert.equal(u.lean.source, 'favor')
  assert.ok(Math.abs(u.lean.lean - 0.5) < 1e-9)
  assert.ok(u.lean.tier, 'and it is placed on the scale')
  assert.deepEqual(
    [...new Set(fetched)].sort(),
    ['/data/umpire-accuracy-summary.json', '/data/umpire-accuracy/1.json', '/data/umpires/1.json'],
  )
})

test('rankings and the one-line summary read the aggregates alone', async () => {
  stubFetch()
  const mod = await import('../src/api/umpires.js?case=rank')
  const ranked = await mod.loadUmpireRankings()
  const one = await mod.umpireAccuracySummary(2)
  // The sub-floor umpire is out, best first.
  assert.deepEqual(
    ranked.ranked.map((r) => [r.id, r.rank]),
    [
      [1, 1],
      [2, 2],
    ],
  )
  assert.equal(one.rank, 2)
  assert.equal(one.total, 2)
  assert.deepEqual([...new Set(fetched)], ['/data/umpire-accuracy-summary.json'])
})
