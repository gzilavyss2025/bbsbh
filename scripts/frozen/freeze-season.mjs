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
// Run once per season, by hand, after the World Series and before Jan 1, while
// the live files still describe that season. A frozen season is never rewritten
// unless you pass --force.
//
// Usage: node scripts/frozen/freeze-season.mjs --season 2026 [--force]
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const dataDir = join(root, 'public', 'data')
const indexPath = join(root, 'src', 'lib', 'data', 'frozen-seasons.json')

const args = process.argv.slice(2)
const season = Number(args[args.indexOf('--season') + 1])
const force = args.includes('--force')
if (!args.includes('--season') || !Number.isInteger(season)) {
  console.error('usage: node scripts/frozen/freeze-season.mjs --season YYYY [--force]')
  process.exit(1)
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const fail = (msg) => {
  console.error(`freeze-season: ${msg}`)
  process.exit(1)
}

// Each live file must still be the season being frozen. top-prospects.json
// carries no season, so its stamp's year stands in: a post-World Series stamp
// in that season's year is the season's final list.
const salaries = readJson(join(dataDir, 'salaries.json'))
if (salaries.season !== season) fail(`salaries.json is season ${salaries.season}, not ${season}`)
const clubFiles = readdirSync(join(dataDir, 'team-contracts')).filter((f) => f.endsWith('.json'))
for (const f of clubFiles) {
  const s = readJson(join(dataDir, 'team-contracts', f)).season
  if (s !== season) fail(`team-contracts/${f} is season ${s}, not ${season}`)
}
const prospects = readJson(join(dataDir, 'top-prospects.json'))
const stampYear = Number(String(prospects.generatedAt ?? '').slice(0, 4))
if (stampYear !== season) fail(`top-prospects.json was generated in ${stampYear || 'an unknown year'}, not ${season}`)

const out = join(dataDir, 'frozen', String(season))
if (existsSync(out) && !force) fail(`${season} is already frozen (pass --force to rewrite it)`)
mkdirSync(join(out, 'team-contracts'), { recursive: true })
cpSync(join(dataDir, 'salaries.json'), join(out, 'salaries.json'))
cpSync(join(dataDir, 'top-prospects.json'), join(out, 'top-prospects.json'))
for (const f of clubFiles) cpSync(join(dataDir, 'team-contracts', f), join(out, 'team-contracts', f))

const seasons = existsSync(indexPath) ? readJson(indexPath) : []
if (!seasons.includes(season)) {
  writeFileSync(indexPath, `${JSON.stringify([...seasons, season].sort((a, b) => a - b))}\n`)
}
console.log(`froze ${season}: salaries.json, top-prospects.json, ${clubFiles.length} club ledgers → public/data/frozen/${season}/`)
