// Shared loaders for the extension-value spike. Kept separate from
// build-panel.mjs and analyze-extension-value.mjs so both can import the
// same joins without re-reading disk twice per run.
//
// Reuses the repo's own parsing/identity modules rather than re-deriving
// them (CLAUDE.md: "Never guess a feed field path"; the money-status rules
// live once in src/lib/contracts/parseMoney.js).

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from '../../scripts/lib/csv.mjs'
import { parseMoneyCell } from '../../src/lib/contracts/parseMoney.js'
import { shardKey100 } from '../../src/lib/shardKey.js'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = join(HERE, '..', '..')

export function loadCsv(name) {
  const text = readFileSync(join(REPO_ROOT, 'scripts/data/contracts', `${name}.csv`), 'utf8')
  return parseCsv(text)
}

export function loadIdentity(name) {
  return JSON.parse(
    readFileSync(join(REPO_ROOT, 'public/data/contracts-history/identity', `${name}.json`), 'utf8'),
  )
}

// mlbId -> { bat: {year:war}, pit: {year:war} }. Loads all 100 war-history
// shards once (2.1 MB total) rather than re-opening a shard per lookup.
export function loadWarHistory() {
  const dir = join(REPO_ROOT, 'public/data/war-history')
  const byId = new Map()
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    const shard = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    for (const kind of ['bat', 'pit']) {
      const bucket = shard[kind] ?? {}
      for (const [id, seasons] of Object.entries(bucket)) {
        if (!byId.has(id)) byId.set(id, { bat: {}, pit: {} })
        byId.get(id)[kind] = seasons
      }
    }
  }
  return byId
}

// WAR (bat+pit, two-way summed) for one player in one season, or null if the
// player has no row for that season at all in EITHER table (distinct from a
// recorded 0.0). Verified against shardKey100 -- see src/lib/shardKey.js.
export function warInSeason(warById, mlbId, season) {
  const rec = warById.get(String(mlbId))
  if (!rec) return null
  const b = rec.bat[String(season)]
  const p = rec.pit[String(season)]
  if (b === undefined && p === undefined) return null
  return (b ?? 0) + (p ?? 0)
}

export function sumWar(warById, mlbId, firstYear, finalYear) {
  let total = 0
  let anyRow = false
  for (let y = firstYear; y <= finalYear; y += 1) {
    const w = warInSeason(warById, mlbId, y)
    if (w !== null) {
      anyRow = true
      total += w
    }
  }
  return anyRow ? total : null
}

// Confirms the shard bucketing this spike relies on: personId % 100 (see
// src/lib/shardKey.js). Not re-derived -- imported directly above -- but the
// spike's docs cite this by name, so it is exported here for the analysis
// script to print alongside the join stats.
export { shardKey100 }

export function money(row, column, context) {
  return parseMoneyCell(row[column], column, context)
}
