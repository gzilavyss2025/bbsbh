// The pitcher game card (#2969): one pitcher's night, shaped from one game's
// live feed. REVEAL-ONLY: every number here is a result, so it is called only
// inside the box score's SealBox reveal render (ADR-0001, ADR-0002), and the
// manifest holds its importers.
//
// Feed paths, checked against gamePk 813024 on 2026-11-06 and 2026-11-16:
//   allPlays[].matchup.pitcher.id / .batSide.code
//   playEvents[].details.type.code / .description (pitch type)
//   playEvents[].pitchData.startSpeed / .zone (1–9 is the zone) /
//     .coordinates.pX/pZ / .breaks.breakVerticalInduced/breakHorizontal
//   playEvents[].hitData.launchSpeed / .launchAngle
//   boxscore.teams.{away,home}.players.ID{id}.stats.pitching (the line)
//
// A pitch belongs to the play's pitcher of record. A change in the middle of a
// plate appearance credits that PA's earlier pitches to the reliever; the
// feed's per-PA matchup is all it gives, and the box line (from the box score
// itself) stays exact either way.

import { pitchDotCategory, pitchCallCode } from '../playbyplay/pitchInfo.js'

const SWING = new Set(['whiff', 'foul', 'inplay'])

// Hard-hit: exit velocity of 95 mph or more (Statcast's definition).
export const isHardHit = (ev) => ev != null && ev >= 95

// Barrel, by Statcast's published launch window: 98 mph opens 26–30°, the
// floor drops a degree per mph, the ceiling reaches 31° at 99 and 33° at 100,
// then widens to 8–50° at 116. The feed carries no barrel flag (checked
// 2026-11-06), so this is computed.
export function isBarrel(ev, la) {
  if (ev == null || la == null || ev < 98) return false
  const lo = Math.max(8, 26 - (ev - 98))
  const hi = ev < 100 ? 30 + (ev - 98) : Math.min(50, 33 + ((ev - 100) * 17) / 16)
  return la >= lo && la <= hi
}

const pct = (n, d) => (d > 0 ? n / d : null)
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

function boxLine(feed, pitcherId) {
  const teams = feed?.liveData?.boxscore?.teams ?? {}
  for (const side of ['away', 'home']) {
    const p = teams[side]?.players?.[`ID${pitcherId}`]
    const s = p?.stats?.pitching
    if (s && s.battersFaced != null) {
      return {
        name: p.person?.fullName ?? '',
        ip: s.inningsPitched ?? '',
        h: s.hits ?? 0,
        r: s.runs ?? 0,
        er: s.earnedRuns ?? 0,
        bb: s.baseOnBalls ?? 0,
        k: s.strikeOuts ?? 0,
        hr: s.homeRuns ?? 0,
        pitches: s.numberOfPitches ?? s.pitchesThrown ?? 0,
        strikes: s.strikes ?? 0,
      }
    }
  }
  return null
}

// Every pitch this pitcher threw, in order, with what the card needs.
function pitchesFor(feed, pitcherId) {
  const out = []
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    if (play?.matchup?.pitcher?.id !== pitcherId) continue
    const bat = play.matchup?.batSide?.code ?? null
    for (const e of play.playEvents ?? []) {
      if (!e?.isPitch) continue
      const pd = e.pitchData ?? {}
      const zone = pd.zone ?? null
      out.push({
        type: e.details?.type?.code ?? 'UN',
        typeName: e.details?.type?.description ?? 'Unknown',
        call: pitchDotCategory(pitchCallCode(e)),
        bat,
        velo: pd.startSpeed ?? null,
        inZone: zone == null ? null : zone >= 1 && zone <= 9,
        pX: pd.coordinates?.pX ?? null,
        pZ: pd.coordinates?.pZ ?? null,
        ivb: pd.breaks?.breakVerticalInduced ?? null,
        hb: pd.breaks?.breakHorizontal ?? null,
        ev: e.hitData?.launchSpeed ?? null,
        la: e.hitData?.launchAngle ?? null,
      })
    }
  }
  return out
}

// Returns null when the pitcher has no line in this game (MiLB gaps included).
export function buildPitcherGameCard(feed, pitcherId) {
  const line = boxLine(feed, pitcherId)
  if (!line) return null
  const pitches = pitchesFor(feed, pitcherId)
  const total = pitches.length
  const vsR = pitches.filter((p) => p.bat === 'R').length
  const vsL = pitches.filter((p) => p.bat === 'L').length

  const byType = new Map()
  for (const p of pitches) {
    if (!byType.has(p.type)) byType.set(p.type, [])
    byType.get(p.type).push(p)
  }

  const mix = [...byType.entries()]
    .map(([type, ps]) => {
      const zoned = ps.filter((p) => p.inZone != null)
      const outside = zoned.filter((p) => !p.inZone)
      const whiffs = ps.filter((p) => p.call === 'whiff').length
      return {
        type,
        name: ps[0].typeName,
        count: ps.length,
        usage: pct(ps.length, total),
        usageVsR: pct(ps.filter((p) => p.bat === 'R').length, vsR),
        usageVsL: pct(ps.filter((p) => p.bat === 'L').length, vsL),
        velo: avg(ps.map((p) => p.velo).filter((v) => v != null)),
        ivb: avg(ps.map((p) => p.ivb).filter((v) => v != null)),
        hb: avg(ps.map((p) => p.hb).filter((v) => v != null)),
        whiffs,
        zonePct: pct(zoned.filter((p) => p.inZone).length, zoned.length),
        chasePct: pct(outside.filter((p) => SWING.has(p.call)).length, outside.length),
        swStrPct: pct(whiffs, ps.length),
      }
    })
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))

  const batted = pitches.filter((p) => p.ev != null)
  return {
    line: {
      ...line,
      swStr: pitches.filter((p) => p.call === 'whiff').length,
      barrels: batted.filter((p) => isBarrel(p.ev, p.la)).length,
      hardHit: batted.filter((p) => isHardHit(p.ev)).length,
    },
    mix,
    pitches,
  }
}
