// Regenerates public/data/outliers/{season}.json — every MLB player's "Standing out"
// callouts (src/api/hotcold/rule.js) as they stood after each game date of the season, for
// the league-wide /outliers page and its date slider (#2453). NIGHTLY: node scripts/gen-outliers.mjs [season]
//
// Fetch: the season's regular-season game logs, 25 ids a call, four calls at once (about
// 70 calls and 6 seconds for a full season). The players come from the season leaderboard
// with playerPool=ALL. The league side is public/data/season-checkpoints/tails.json (the
// hand-run gen-season-checkpoints.mjs). The rule is run for each player and each game date by
// lib/outliers/walk.mjs; only flagged days and their closing markers are written.
//
// Shape: { season, generatedAt, first, last, players: [{ i, n, r: 'h'|'p', f: entries }] }.
// `first` and `last` are the first and last game dates in the logs. An entry is [date, flags]
// or [date, 0], the closing marker (see lib/outliers/walk.mjs).
//
// public/data/outliers/index.json carries only `generatedAt`, the folder's stamp for the freshness check.
// A season with no game logs yet (January to opening day) writes nothing, so last season's
// file stays and the reader's year has no file: the page then shows its offseason state.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chunk, mapConcurrent } from './lib/concurrency.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { walkPlayer } from './lib/outliers/walk.mjs'
import { getJson } from './lib/statsapi.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const season = Number(process.argv[2] ?? new Date().getUTCFullYear())
const tails = JSON.parse(readFileSync(join(root, 'public/data/season-checkpoints/tails.json'), 'utf8'))

const logs = []
for (const role of ['hitting', 'pitching']) {
  const j = await getJson(`/api/v1/stats?stats=season&group=${role}&season=${season}&sportId=1&gameType=R&playerPool=ALL&limit=5000`)
  const ids = [...new Set((j.stats?.[0]?.splits ?? []).map((s) => s.player?.id).filter(Boolean))]
  await mapConcurrent(chunk(ids, 25), 4, async (batch) => {
    const p = await getJson(`/api/v1/people?personIds=${batch.join(',')}&hydrate=stats(group=[${role}],type=[gameLog],season=${season},sportId=1,gameType=[R])`)
    for (const person of p.people ?? []) {
      const rows = (person.stats ?? []).find((s) => s.group?.displayName === role)?.splits ?? []
      if (rows.length) logs.push({ role, id: person.id, name: person.fullName, rows })
    }
  }, { strict: true })
}

const dates = logs.flatMap((l) => l.rows.map((r) => r.date)).filter(Boolean).sort()
if (!dates.length) {
  // Keep the folder's stamp fresh: check-data-freshness fails on a stamp older than a day.
  await writeJsonAtomic(join(root, 'public/data/outliers/index.json'), { generatedAt: new Date().toISOString(), season })
  console.log(`no ${season} game logs yet: not writing the season file`)
  process.exit(0)
}
// A short run (a failed batch) must not replace the committed file: each role needs its own floor.
for (const role of ['hitting', 'pitching']) {
  const n = logs.filter((l) => l.role === role).length
  if (n < 300) throw new Error(`only ${n} ${role} logs, expected over 600: not writing`)
}

const players = []
for (const l of logs) {
  const f = walkPlayer({ role: l.role, rows: l.rows, tails })
  if (f.length) players.push({ i: l.id, n: l.name, r: l.role[0], f })
}
players.sort((a, b) => a.i - b.i || a.r.localeCompare(b.r))
const out = join(root, 'public/data/outliers', `${season}.json`)
const generatedAt = new Date().toISOString()
await writeJsonAtomic(out, { season, generatedAt, first: dates[0], last: dates.at(-1), players })
// The folder's clock for scripts/check-data-freshness.mjs. Nothing in the app reads it.
await writeJsonAtomic(join(root, 'public/data/outliers/index.json'), { generatedAt, season })
console.log(`${season}: ${logs.length} logs, ${players.length} players flagged, ${dates[0]} to ${dates.at(-1)} → ${out}`)
