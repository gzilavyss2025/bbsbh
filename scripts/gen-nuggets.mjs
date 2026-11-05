// Regenerates public/data/nuggets/{season}.json: the nugget store (issue #2809). A nugget
// is the first day a player's regular-season total met a named threshold
// (src/lib/nuggets/thresholds.js), with how many players had met it by then and the
// anchor picked for that count (src/lib/anchors/pick.js), frozen. The pure half and the
// rules are scripts/lib/nuggets/nuggets.mjs; the reader is src/api/nuggets/nuggets.js.
//
// Each run:
//   1. Two season-totals calls (hitting, pitching), regular season, MLB only.
//   2. Players who meet a threshold and have no entry yet are the new crossers.
//   3. Each new crosser's game log dates the crossing, so a late run loses nothing.
//   4. Append them with their count and anchor. Old entries are never rewritten. If a game
//      log fails to load, that threshold waits a night (mintOrHold), so no count is short.
// A second run adds nothing. A backfill is the same code on a missing file.
//
// Also writes public/data/nuggets/index.json: the seasons on file and the run's
// generatedAt, the stamp check-data-freshness.mjs reads for this directory.
//
// Season: the season in play (lib/time/season-in-play.mjs), or --season=YYYY. A season
// with no totals (the calendar year before Opening Day) writes nothing.
// Run by the nightly workflow; by hand: node scripts/gen-nuggets.mjs [--season=2026]
import { join } from 'node:path'
import { readdir } from 'node:fs/promises'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { parseArgs, strOpt } from './lib/args.mjs'
import { sumByPlayer, crossingDate, newCrossers, mintOrHold } from './lib/nuggets/nuggets.mjs'
import { THRESHOLDS } from '../src/lib/nuggets/thresholds.js'
import { pick } from '../src/lib/anchors/pick.js'

const DIR = join(import.meta.dirname, '..', 'public', 'data', 'nuggets')
const CONCURRENCY = 6

const arg = strOpt(parseArgs(process.argv.slice(2)), 'season')
const season = arg ? Number(arg) : await fetchSeasonInPlay()
const OUT = join(DIR, `${season}.json`)

const groups = [...new Set(THRESHOLDS.map((t) => t.group))]
const totals = {}
for (const group of groups) {
  const body = await getJson(`/api/v1/stats?stats=season&group=${group}&season=${season}&sportIds=1&gameType=R&playerPool=all&limit=3000`)
  totals[group] = sumByPlayer(body?.stats?.[0]?.splits)
}
if (groups.every((g) => totals[g].size === 0)) {
  console.log(`nuggets: ${season} has no season totals yet; nothing written`)
  process.exit(0)
}

const prev = await readJsonOr(OUT, null)
const nuggets = prev?.season === season ? { ...prev.nuggets } : {}

// One game log per player and group, however many thresholds he crossed.
const logs = new Map()
const gameLog = (id, group) => {
  const key = `${id}|${group}`
  if (!logs.has(key)) {
    logs.set(key, getJson(`/api/v1/people/${id}/stats?stats=gameLog&group=${group}&season=${season}&gameType=R&sportId=1`)
      .then((b) => b?.stats?.[0]?.splits ?? []))
  }
  return logs.get(key)
}

let added = 0
for (const t of THRESHOLDS) {
  const have = nuggets[t.id] ?? []
  const ids = newCrossers(totals[t.group], t, have)
  const dated = await mapConcurrent(ids, CONCURRENCY, async (player) => ({ player, date: crossingDate(await gameLog(player, t.group), t) }))
  const { list, held } = mintOrHold(have, dated, { pickAnchor: (count, o) => pick(count, { unit: 'people', ...o }) })
  if (held) console.warn(`nuggets: ${t.id}: a game log failed to load; this threshold waits for the next run`)
  const undated = dated.filter((c) => c && !c.date).length
  if (undated) console.warn(`nuggets: ${t.id}: ${undated} crosser(s) whose game log never reaches the line`)
  nuggets[t.id] = list
  added += nuggets[t.id].length - have.length
}

const generatedAt = new Date().toISOString()
await writeJsonAtomic(OUT, { season, generatedAt, nuggets }, 1)
const seasons = (await readdir(DIR)).map((f) => /^(\d{4})\.json$/.exec(f)?.[1]).filter(Boolean).map(Number).sort()
await writeJsonAtomic(join(DIR, 'index.json'), { generatedAt, seasons }, 1)
const total = Object.values(nuggets).reduce((n, l) => n + l.length, 0)
console.log(`nuggets: ${season}, ${added} new, ${total} in all across ${THRESHOLDS.length} thresholds`)
