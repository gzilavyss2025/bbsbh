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
// A pitch belongs to whoever was on the mound when it was thrown. The play's
// matchup names only the pitcher who FINISHED the plate appearance, so a
// change mid-PA is read from its `pitching_substitution` action event
// (player.id is the new arm); pitches before it go to the arm already in
// that half (about.halfInning).

import { pitchDotCategory, pitchCallCode } from '../playbyplay/pitchInfo.js'
import { roundNameAt } from '../../lib/postseason/roundTag.js'
import { monthDayNameYear } from '../../lib/dates.js'
import { normalizePitch } from '../../lib/zone/zoneGeometry.js'

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
        side,
        role: s.gamesStarted > 0 ? 'Start' : 'Relief',
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

// The game the card names, for a card that is shared on its own: the round
// ("WS"), the date, and the final line. A result, like everything here.
function gameFacts(feed) {
  const g = feed?.gameData
  const ls = feed?.liveData?.linescore
  const side = (k) => ({ abbr: g?.teams?.[k]?.abbreviation ?? '', runs: ls?.teams?.[k]?.runs ?? null })
  const innings = ls?.currentInning ?? null
  return {
    round: roundNameAt(g?.game?.type, g?.teams?.home?.sport?.id),
    date: monthDayNameYear(g?.datetime?.officialDate),
    away: side('away'),
    home: side('home'),
    final: g?.status?.codedGameState === 'F',
    innings: innings && innings !== 9 ? innings : null,
  }
}

// Every pitch this pitcher threw, in order, with what the card needs.
function pitchesFor(feed, pitcherId) {
  const out = []
  const onMound = {}
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const half = play?.about?.halfInning
    const finisher = play?.matchup?.pitcher?.id
    const bat = play?.matchup?.batSide?.code ?? null
    let current = onMound[half] ?? finisher
    for (const e of play?.playEvents ?? []) {
      if (e?.details?.eventType === 'pitching_substitution' && e.player?.id != null) current = e.player.id
      if (!e?.isPitch || current !== pitcherId) continue
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
        // Movement in inches, catcher's view: the same pfx the season arsenal averages.
        pfxX: pd.coordinates?.pfxX ?? null,
        pfxZ: pd.coordinates?.pfxZ ?? null,
        // Location against THIS batter's zone (half-plate units, zone heights), so a
        // night of different hitters plots on one zone (lib/zone/zoneGeometry.js).
        loc: normalizePitch(pd.coordinates?.pX, pd.coordinates?.pZ, pd.strikeZoneTop, pd.strikeZoneBottom),
        ev: e.hitData?.launchSpeed ?? null,
        la: e.hitData?.launchAngle ?? null,
      })
    }
    if (half != null) onMound[half] = finisher
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
        pfxX: avg(ps.map((p) => p.pfxX).filter((v) => v != null)),
        pfxZ: avg(ps.map((p) => p.pfxZ).filter((v) => v != null)),
        whiffs,
        zonePct: pct(zoned.filter((p) => p.inZone).length, zoned.length),
        chasePct: pct(outside.filter((p) => SWING.has(p.call)).length, outside.length),
        swStrPct: pct(whiffs, ps.length),
      }
    })
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))

  const batted = pitches.filter((p) => p.ev != null)
  return {
    game: gameFacts(feed),
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
