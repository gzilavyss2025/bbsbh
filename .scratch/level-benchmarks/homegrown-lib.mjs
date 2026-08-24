// Shared pieces of the homegrown-dependence spike (docs/homegrown-dependence.md).
// Two scripts need the identical rule and the identical sweep -- the cohort
// resolver (homegrown-firstorg.mjs) and the full-MLB-population resolver
// (homegrown-pull.mjs) -- and the whole spike turns on the two agreeing, so
// they share one implementation rather than two that can drift.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'
import { mapConcurrent } from '../../scripts/lib/concurrency.mjs'

export const here = dirname(fileURLToPath(import.meta.url))

// sportId 17 (Arizona Fall League, winter ball, the WBC) is deliberately
// absent: every club under it carries parentOrgId 11, "Office of the
// Commissioner", which is not an organization in the sense this spike means.
export const MILB_SPORT_IDS = [11, 12, 13, 14, 15, 16]
export const COMMISSIONER_ORG_ID = 11

// Ascending = lower level. Used to pick the ENTRY point when a player's first
// professional season spans more than one level.
export const LEVEL_RANK = { 16: 0, 15: 1, 14: 2, 13: 3, 12: 4, 11: 5 }
export const LEVEL_NAME = { 16: 'Rookie/Complex', 15: 'Short-A', 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }

// Read-through JSON cache. Every network step in this spike is behind one, so
// a rerun after an edit costs nothing and the caches double as the record of
// what was actually pulled.
export async function cached(name, build) {
  const path = join(here, name)
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    const built = await build()
    await writeFile(path, JSON.stringify(built))
    return built
  }
}

// Season-scoped team -> org map across all six MiLB levels. NOT the current
// affiliate file: an id reused across a relocation would silently mis-attribute
// every player who passed through it. sportId 15 404s from 2021 on (the level
// was abolished at the reorg) -- counted, not fatal.
export async function buildOrgMap({ seasonMin, seasonMax, cacheName = 'orgmap-ext.json' }) {
  const rawMap = await cached(cacheName, async () => {
    const jobs = []
    for (const sportId of MILB_SPORT_IDS) {
      for (let s = seasonMin; s <= seasonMax; s++) jobs.push({ sportId, season: s })
    }
    console.log(`sweeping team->org map (${jobs.length} calls)...`)
    const out = {}
    let missing = 0
    await mapConcurrent(jobs, 8, async ({ sportId, season }) => {
      let data
      try {
        data = await getJson(`/api/v1/teams?sportId=${sportId}&season=${season}`)
      } catch {
        missing++
        return
      }
      for (const t of data.teams ?? []) {
        if (!t.parentOrgId) continue
        out[`${t.id}:${season}`] = [t.parentOrgId, t.parentOrgName || '']
      }
    })
    console.log(`org map: ${Object.keys(out).length} (team,season) entries, ${missing} (sportId,season) pairs absent`)
    return out
  })
  return new Map(Object.entries(rawMap))
}

// Every minor-league team-season a player appears in, at any of the six levels,
// under EITHER stat group. `group=hitting,pitching` returns both blocks in one
// response (verified), so this is 6 calls per player rather than 12.
//
// Both halves matter. Skipping the low levels loses the entry point for anyone
// traded between rookie ball and his first full-season assignment; skipping the
// other group loses every pre-conversion season of a position-changer (Sergio
// Santos, a 2002 first-round SHORTSTOP for Arizona, reads as a 2013 Blue Jays
// pitcher if only his current group is swept).
export async function sweepMilbSeasons(personId) {
  const rows = []
  for (const sportId of MILB_SPORT_IDS) {
    try {
      const data = await getJson(
        `/api/v1/people/${personId}/stats?stats=yearByYear&group=hitting,pitching&sportId=${sportId}`,
      )
      for (const block of data.stats ?? []) {
        for (const split of block.splits ?? []) {
          if (!split.team?.id) continue
          rows.push({ season: Number(split.season), sportId, teamId: split.team.id })
        }
      }
    } catch {
      // level never played, or the level did not exist that season
    }
  }
  return rows
}

// THE RULE. Player P is homegrown to org X iff X is the parent org of P's first
// professional minor-league season. Within that first season -- a player can
// appear at two levels in it -- the ENTRY point is the lowest level he reached.
//
// Returns null for a player with no minor-league record at all (a direct-to-MLB
// international signing, or a foreign professional), and for one whose entry
// club has no parent org in the map. Both are reported rather than silently
// folded into somebody's share.
export function firstProOrg(milbRows, lookup) {
  if (!milbRows?.length) return null
  const firstSeason = Math.min(...milbRows.map((r) => r.season))
  const inFirst = milbRows.filter((r) => r.season === firstSeason).sort((a, b) => LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId])
  for (const r of inFirst) {
    const hit = lookup(`${r.teamId}:${r.season}`)
    if (!hit) continue
    return { orgId: hit[0], orgName: hit[1], season: firstSeason, sportId: r.sportId, teamId: r.teamId }
  }
  return null
}

// src/api/person/identity.js's draftInfo() rule, ported verbatim: prefer the
// drafts[] entry whose year matches person.draftYear. NOT drafts[0], which can
// be an earlier UNSIGNED draft -- Aaron Judge was a 31st-round high-school pick
// in 2010 before his 2013 first round, and raw.json's ped.draftRound carries
// that bug because pull.mjs's fetchPedigree used drafts[0].
export function draftInfo(person) {
  const year = person?.draftYear
  const drafts = person?.drafts ?? []
  const signed = drafts.find((d) => String(d.year) === String(year)) ?? (drafts.length ? drafts[drafts.length - 1] : null)
  if (!signed && !year) return null
  return {
    year: year ?? signed?.year ?? '',
    round: signed?.pickRound ?? '',
    teamId: signed?.teamId ?? null,
    teamName: signed?.teamName ?? '',
  }
}

export function median(arr) {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
