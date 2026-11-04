#!/usr/bin/env node
// freeze-season: keep one season's copy of the stores that know only today (#2776).
//
// The team page's Money band and the Farm prospects and depth chart read three
// files that the nightly jobs rewrite in place: top-prospects.json
// (fetch-top-prospects.mjs), salaries.json and team-contracts/{id}.json
// (fever/gen-salaries.mjs). Once a season ends, the next season's data replaces
// them. This copies them into public/data/frozen/{season}/ under the same names,
// so a past-season page (?y=, #2585) can still draw them, and lists the season in
// src/lib/data/frozen-seasons.json, which the page reads synchronously to decide
// whether the Money band exists (hiddenTeamSections).
//
// The nightly cron runs it with --nightly (#2778), after both producers, on
// every night: no input gate, because the night it matters is a quiet offseason
// one. It decides for itself (freezeDecision below):
//   - season not over yet (seasonOver, ADR-0074): exit 0, nothing written.
//   - November or December and statsapi's season row can't be read: exit 1,
//     naming the season it cannot decide on (from Jan 1 no row is needed).
//   - the season that is over is already in frozen-seasons.json: exit 0.
//   - over, not frozen, every live file still that season: freeze it, exit 0.
//   - over, not frozen, a live file already on a later season: exit 1 and name
//     the season. It can no longer be frozen from the live files; recover it by
//     hand from git history (check out the last commit whose live files were
//     that season, then run --season with it).
//   - a live file on an earlier season: exit 1 too (a producer is stuck).
// A frozen season is never rewritten unless you pass --force (hand mode only).
//
// Usage: node scripts/frozen/freeze-season.mjs --nightly
//        node scripts/frozen/freeze-season.mjs --season 2026 [--force]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const dataDir = join(root, 'public', 'data')
const indexPath = join(root, 'src', 'lib', 'data', 'frozen-seasons.json')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

// The season each live file describes. top-prospects.json carries no season,
// so its stamp's year stands in: a post-World Series stamp in that season's year
// is the season's final list.
function readLive() {
  const clubFiles = readdirSync(join(dataDir, 'team-contracts')).filter((f) => f.endsWith('.json'))
  const prospects = readJson(join(dataDir, 'top-prospects.json'))
  return {
    clubFiles,
    salaries: readJson(join(dataDir, 'salaries.json')).season,
    clubs: clubFiles.map((f) => readJson(join(dataDir, 'team-contracts', f)).season),
    prospectsYear: Number(String(prospects.generatedAt ?? '').slice(0, 4)) || null,
  }
}

// Each live file that is not `season`, as "name is X" lines.
function liveMismatches(live, season) {
  const out = []
  if (live.salaries !== season) out.push({ file: 'salaries.json', is: live.salaries })
  live.clubs.forEach((s, i) => {
    if (s !== season) out.push({ file: `team-contracts/${live.clubFiles?.[i] ?? i}`, is: s })
  })
  if (live.prospectsYear !== season) out.push({ file: 'top-prospects.json (stamp year)', is: live.prospectsYear })
  return out
}

// Pure. `over` is seasonOver()'s answer (a season or null), `frozen` the list in
// frozen-seasons.json, `live` readLive()'s shape. Returns { action, season,
// exitCode, message }; action is wait | noop | freeze | too-late | mismatch.
export function freezeDecision({ over, frozen, live }) {
  if (over == null) return { action: 'wait', season: null, exitCode: 0, message: 'no season is over yet; nothing to freeze' }
  if (frozen.includes(over)) return { action: 'noop', season: over, exitCode: 0, message: `${over} is already frozen` }
  const off = liveMismatches(live, over)
  if (off.length === 0) return { action: 'freeze', season: over, exitCode: 0, message: `freezing ${over}` }
  const list = off.map((m) => `${m.file} is ${m.is ?? 'unknown'}`).join(', ')
  if (off.some((m) => Number(m.is) > over)) {
    return {
      action: 'too-late',
      season: over,
      exitCode: 1,
      message: `could not freeze ${over}: the live files have moved on (${list}). Recover ${over} by hand from git history.`,
    }
  }
  return { action: 'mismatch', season: over, exitCode: 1, message: `could not freeze ${over}: live files are behind (${list})` }
}

function freeze(season, clubFiles, force) {
  const out = join(dataDir, 'frozen', String(season))
  if (existsSync(out) && !force) throw new Error(`${season} is already frozen (pass --force to rewrite it)`)
  mkdirSync(join(out, 'team-contracts'), { recursive: true })
  cpSync(join(dataDir, 'salaries.json'), join(out, 'salaries.json'))
  cpSync(join(dataDir, 'top-prospects.json'), join(out, 'top-prospects.json'))
  for (const f of clubFiles) cpSync(join(dataDir, 'team-contracts', f), join(out, 'team-contracts', f))
  const seasons = readFrozen()
  if (!seasons.includes(season)) {
    writeFileSync(indexPath, `${JSON.stringify([...seasons, season].sort((a, b) => a - b))}\n`)
  }
  console.log(`froze ${season}: salaries.json, top-prospects.json, ${clubFiles.length} club ledgers → public/data/frozen/${season}/`)
}

const readFrozen = () => (existsSync(indexPath) ? readJson(indexPath) : [])

async function main() {
  const args = process.argv.slice(2)
  const fail = (msg) => {
    console.error(`freeze-season: ${msg}`)
    process.exit(1)
  }

  if (args.includes('--nightly')) {
    const { fetchSeasonOver } = await import('../lib/time/season-in-play.mjs')
    let over
    try {
      over = await fetchSeasonOver()
    } catch (e) {
      fail(e.message)
    }
    const live = readLive()
    const d = freezeDecision({ over, frozen: readFrozen(), live })
    if (d.exitCode !== 0) fail(d.message)
    if (d.action !== 'freeze') return console.log(`freeze-season: ${d.message}`)
    return freeze(d.season, live.clubFiles, false)
  }

  const season = Number(args[args.indexOf('--season') + 1])
  if (!args.includes('--season') || !Number.isInteger(season)) {
    fail('usage: --nightly, or --season YYYY [--force]')
  }
  const live = readLive()
  const off = liveMismatches(live, season)
  if (off.length) fail(off.map((m) => `${m.file} is ${m.is ?? 'unknown'}, not ${season}`).join('; '))
  try {
    freeze(season, live.clubFiles, args.includes('--force'))
  } catch (e) {
    fail(e.message)
  }
}

if (import.meta.main) await main()
