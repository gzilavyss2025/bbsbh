// The MLB end of the prospect-traits spike: locating each player's rookie
// season and grading it.
//
// WHICH SEASON IS THE ROOKIE SEASON. The one containing `rookieUntil` — the
// date the player crossed 130 AB / 50 IP cumulative and stopped being a rookie.
// That is the app's own definition (public/data/rookies.json) and it is the
// season a Rookie of the Year ballot would cover, so it is reused rather than
// reinvented. It is NOT always the debut season: a reliever who debuts in
// September and needs four more years to reach 50 innings has a rookie season
// four years after his debut. `rookieLagYears` carries that gap so a spec can
// exclude the slow burns; the headline numbers are reported both ways.
//
// WHAT "ABOVE AVERAGE" MEANS. Two readings, both kept, because they answer
// different questions and a reader deserves to know they disagree:
//   rate  — OPS against the same season's league OPS (hitters), ERA against the
//           same season's league ERA (pitchers). Asks "did he play well?"
//   WAR   — FanGraphs season WAR from public/data/war-history. Asks "was the
//           season worth something?", which folds in how much he played.
// A man can clear one and miss the other, and which one you use changes who
// counts as an above-average rookie. That is a finding, not a nuisance.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { here } from './lib.mjs'
import { shardKey100 } from '../../src/lib/shardKey.js'

const repo = join(here, '..', '..')
const j = async (p) => JSON.parse(await readFile(p, 'utf8'))

// innings come back as "58.1" = 58 and 1/3. Reused rather than re-derived, the
// same conversion src/api/rehab-policy.js's ipToOuts makes.
function ipToInnings(ip) {
  if (ip == null) return 0
  const n = Number(ip)
  if (!Number.isFinite(n)) return 0
  const whole = Math.trunc(n)
  const frac = Math.round((n - whole) * 10)
  return whole + frac / 3
}

function sumStats(rows) {
  const agg = {}
  let ipTotal = 0
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.stat ?? {})) {
      if (typeof v === 'number') agg[k] = (agg[k] ?? 0) + v
    }
    ipTotal += ipToInnings(r.stat?.inningsPitched)
  }
  agg.__ip = ipTotal
  return agg
}

export async function buildOutcomes(players) {
  const mlb = await j(join(here, 'mlb.json'))
  const league = await j(join(here, 'league.json'))

  // WAR shards, loaded once. 2010 is the floor — anything earlier gets null,
  // which is honest rather than a zero that reads as "replacement level".
  const warShards = new Map()
  async function warFor(id, season) {
    const key = shardKey100(id)
    if (!warShards.has(key)) {
      try {
        warShards.set(key, await j(join(repo, 'public', 'data', 'war-history', `${key}.json`)))
      } catch {
        warShards.set(key, null)
      }
    }
    const shard = warShards.get(key)
    if (!shard) return null
    const bat = shard.bat?.[id]?.[season]
    const pit = shard.pit?.[id]?.[season]
    if (bat == null && pit == null) return null
    return (bat ?? 0) + (pit ?? 0)
  }

  const leagueRate = (season, group) => {
    const l = league[`${season}:${group}`]
    if (!l?.agg) return null
    const a = l.agg
    if (group === 'hitting') {
      const pa = a.plateAppearances
      const ab = a.atBats
      const obpDen = a.atBats + a.baseOnBalls + a.hitByPitch + a.sacFlies
      const obp = (a.hits + a.baseOnBalls + a.hitByPitch) / obpDen
      const slg = a.totalBases / ab
      return { ops: obp + slg, obp, slg, pa }
    }
    const innings = a.outs / 3
    return {
      era: (a.earnedRuns * 9) / innings,
      kPer9: (a.strikeOuts * 9) / innings,
      bbPer9: (a.baseOnBalls * 9) / innings,
      innings,
    }
  }

  const out = []
  for (const p of players) {
    const rows = mlb[p.id] ?? []
    const season = p.rookieSeason
    const seasonRows = rows.filter((r) => r.season === season)
    if (!seasonRows.length) {
      out.push({ ...p, rookieFound: false })
      continue
    }
    const s = sumStats(seasonRows)
    const lg = leagueRate(season, p.group)
    const war = await warFor(p.id, season)

    let rate = null
    let rateName = null
    let pt = null
    if (p.group === 'hitting') {
      const obpDen = s.atBats + s.baseOnBalls + s.hitByPitch + s.sacFlies
      const obp = obpDen ? (s.hits + s.baseOnBalls + s.hitByPitch) / obpDen : null
      const slg = s.atBats ? s.totalBases / s.atBats : null
      const ops = obp != null && slg != null ? obp + slg : null
      rate = ops != null && lg?.ops ? (ops / lg.ops) * 100 : null
      rateName = 'OPS+ (crude, no park factor)'
      pt = s.plateAppearances ?? null
    } else {
      const innings = s.__ip
      const era = innings > 0 ? (s.earnedRuns * 9) / innings : null
      // ERA- style, inverted so that HIGHER IS BETTER for both groups: a 100
      // is league average, 120 means a 20% better run-prevention rate.
      rate = era != null && lg?.era ? (lg.era / era) * 100 : null
      rateName = 'ERA+ (crude, no park factor)'
      pt = innings
    }

    out.push({
      ...p,
      rookieFound: true,
      rookieSeasonPT: pt,
      rookieRate: Number.isFinite(rate) ? rate : null,
      rateName,
      rookieWar: war,
      rookieLagYears: season - p.debutYear,
      rookieRaw: s,
    })
  }
  return out
}
