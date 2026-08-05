// Position innings — the "where he's played" diamond (fielding innings per
// position) and the starter/reliever IP pair. Innings ("2039.2" = 2039 ⅔) sum
// through the same outs math as pitching IP, so a career scope adds correctly
// across levels. See api/positionInnings scope loader for the fetch side, and
// ../person.js's header for this module's overall spoiler footing.

import { ipToOuts } from '../rehab-policy.js'
import { num, outsToIp } from './shared.js'

// The eight defensive spots plus the mound, in the diamond's render order.
const FIELD_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'P']

// Sum fielding innings per position across raw fielding splits. A mid-season
// trade emits per-team rows PLUS a team-less synthetic sum for a position
// (verified: Jazz Chisholm's 2024 CF = a team-less 829.1 alongside 815.1 MIA +
// 14.0 NYY), so per position prefer the team-tagged rows and drop the synthetic
// — the same guard levelSeasonStat uses. A career / multi-level fan-out carries
// only team-less rows (one per level), so those still sum across levels. DH
// carries no defensive innings (verified: innings 0.0), so it rides a games-only
// line beneath the diamond instead of a spot on it.
export function fieldingView(splits) {
  const byPos = new Map()
  for (const s of splits ?? []) {
    const pos = s.position?.abbreviation
    if (!pos) continue
    if (!byPos.has(pos)) byPos.set(pos, [])
    byPos.get(pos).push(s)
  }
  const preferTeamRows = (rows) => {
    const teamRows = rows.filter((r) => r.team?.id)
    return teamRows.length ? teamRows : rows
  }
  const outsByPos = new Map()
  let dhGames = 0
  for (const [pos, rows] of byPos) {
    const use = preferTeamRows(rows)
    if (pos === 'DH') {
      dhGames = use.reduce((t, r) => t + num(r.stat?.gamesPlayed), 0)
      continue
    }
    outsByPos.set(pos, use.reduce((t, r) => t + ipToOuts(r.stat?.innings), 0))
  }
  const positions = FIELD_POSITIONS.filter((pos) => outsByPos.has(pos)).map((pos) => {
    const outs = outsByPos.get(pos)
    return { pos, innings: outsToIp(outs), played: outs > 0 }
  })
  if (!positions.length && !dhGames) return null
  return { positions, dh: dhGames ? { games: dhGames } : null }
}

// Dedupe one stint's SP/RP splits per code — prefer the team-tagged rows,
// dropping the team-less synthetic aggregate a mid-season trade emits — and
// return outs per code.
function stintStarterRelieverOuts(splits) {
  const byCode = { sp: [], rp: [] }
  for (const s of splits ?? []) {
    const code = s.split?.code
    if (byCode[code]) byCode[code].push(s)
  }
  const outs = (rows) => {
    const teamRows = rows.filter((s) => s.team?.id)
    return (teamRows.length ? teamRows : rows).reduce((t, s) => t + ipToOuts(s.stat?.inningsPitched), 0)
  }
  return { sp: outs(byCode.sp), rp: outs(byCode.rp) }
}

// One (season, level) stint's SP/RP as IP strings.
export function starterRelieverView(splits) {
  const { sp, rp } = stintStarterRelieverOuts(splits)
  if (!sp && !rp) return null
  return { starter: outsToIp(sp), reliever: outsToIp(rp) }
}

// Career SP/RP: sum outs across several stints (each deduped first, so a traded
// season isn't double-counted), then format. Input is fetchStarterRelieverStints'
// [{ stint, splits }].
export function starterRelieverCareer(stintSplits) {
  let sp = 0
  let rp = 0
  for (const { splits } of stintSplits ?? []) {
    const o = stintStarterRelieverOuts(splits)
    sp += o.sp
    rp += o.rp
  }
  if (!sp && !rp) return null
  return { starter: outsToIp(sp), reliever: outsToIp(rp) }
}

// The unique (season, sportId) stints a pitcher appeared in, from his raw
// year-by-year splits — the fan-out list for a lazy career SP/RP fetch.
export function pitchingStints(splits) {
  const seen = new Set()
  const out = []
  for (const s of splits ?? []) {
    const season = Number(s.season)
    const sportId = s.sport?.id
    if (!season || !sportId) continue
    const key = `${season}-${sportId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ season, sportId })
  }
  return out
}
