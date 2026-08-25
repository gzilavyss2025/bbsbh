// One row per Triple-A stay: the prospect's own line, and a description of the
// job above him on the parent club. Everything here is a join over cached
// pulls - no network.
import { readFileSync, writeFileSync } from 'node:fs'

const BENCH = 'C:/Users/gzilavy/bbsbh/.scratch/level-benchmarks'
const dates = JSON.parse(readFileSync(`${BENCH}/dates.json`, 'utf8'))
const raw = JSON.parse(readFileSync(`${BENCH}/raw.json`, 'utf8')).players
const orgmap = JSON.parse(readFileSync(`${BENCH}/orgmap-wide.json`, 'utf8'))
const standings = JSON.parse(readFileSync(`${BENCH}/standings-cache.json`, 'utf8'))
const mlb = JSON.parse(readFileSync('mlb-cache.json', 'utf8'))
const milbField = JSON.parse(readFileSync('milb-field-cache.json', 'utf8'))

const GROUP = {
  C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS',
  CF: 'CF', LF: 'COF', RF: 'COF', DH: 'DH',
}
// How hard the job is to hand to somebody else. Used only as a cut, never as a
// control - it is the falsification test, not a covariate.
const SCARCITY = {
  C: 'scarce', SS: 'scarce', CF: 'scarce',
  '2B': 'mid', '3B': 'mid',
  COF: 'open', '1B': 'open', DH: 'open',
}

// ---- indexes -------------------------------------------------------------
const mlbField = new Map()
const mlbHit = new Map()
const mlbHitBySeason = new Map()
const mlbPitchBySeason = new Map()
const mlbFieldByPlayer = new Map()
const mlbHitByPlayerSeason = new Map()
const mlbPitchByPlayerSeason = new Map()

for (const [key, rows] of Object.entries(mlb)) {
  const [seasonStr, group] = key.split(':')
  const season = Number(seasonStr)
  for (const r of rows) {
    if (group === 'fielding') {
      const k = `${r.t}:${season}`
      if (!mlbField.has(k)) mlbField.set(k, [])
      mlbField.get(k).push(r)
      const pk = `${r.p}:${season}`
      if (!mlbFieldByPlayer.has(pk)) mlbFieldByPlayer.set(pk, [])
      mlbFieldByPlayer.get(pk).push(r)
    } else if (group === 'hitting') {
      mlbHit.set(`${r.p}:${r.t}:${season}`, r)
      if (!mlbHitBySeason.has(season)) mlbHitBySeason.set(season, [])
      mlbHitBySeason.get(season).push(r)
      const pk = `${r.p}:${season}`
      if (!mlbHitByPlayerSeason.has(pk)) mlbHitByPlayerSeason.set(pk, [])
      mlbHitByPlayerSeason.get(pk).push(r)
    } else {
      if (!mlbPitchBySeason.has(season)) mlbPitchBySeason.set(season, [])
      mlbPitchBySeason.get(season).push(r)
      const pk = `${r.p}:${season}`
      if (!mlbPitchByPlayerSeason.has(pk)) mlbPitchByPlayerSeason.set(pk, [])
      mlbPitchByPlayerSeason.get(pk).push(r)
    }
  }
}

const milbFieldByPlayer = new Map()
for (const [key, rows] of Object.entries(milbField)) {
  const season = Number(key.split(':')[0])
  for (const r of rows) {
    const k = `${r.p}:${season}`
    if (!milbFieldByPlayer.has(k)) milbFieldByPlayer.set(k, [])
    milbFieldByPlayer.get(k).push(r)
  }
}

// League context per season, so an incumbent's line reads against his own era.
const lgOps = new Map()
const lgEra = new Map()
for (const [season, rows] of mlbHitBySeason) {
  const q = rows.filter((r) => r.pa >= 300 && r.ops > 0)
  lgOps.set(season, q.reduce((s, r) => s + r.ops, 0) / (q.length || 1))
}
for (const [season, rows] of mlbPitchBySeason) {
  const q = rows.filter((r) => r.ip >= 100 && r.era != null)
  lgEra.set(season, q.reduce((s, r) => s + r.era, 0) / (q.length || 1))
}

// ---- helpers -------------------------------------------------------------
function posGroupFromFielding(rows) {
  if (!rows || !rows.length) return null
  const byGroup = new Map()
  for (const r of rows) {
    const g = GROUP[r.pos]
    if (!g) continue
    byGroup.set(g, (byGroup.get(g) || 0) + (r.gs || 0))
  }
  let best = null
  let bestGs = -1
  for (const [g, gs] of byGroup) {
    if (gs > bestGs) { best = g; bestGs = gs }
  }
  return bestGs > 0 ? best : null
}

// The man holding the job: most games started at that position group for the
// parent club that season.
function incumbentAt(orgId, season, group, selfId) {
  const rows = mlbField.get(`${orgId}:${season}`) || []
  const byPlayer = new Map()
  for (const r of rows) {
    if (GROUP[r.pos] !== group) continue
    if (r.p === selfId) continue
    byPlayer.set(r.p, (byPlayer.get(r.p) || 0) + (r.gs || 0))
  }
  const ranked = [...byPlayer.entries()].sort((a, b) => b[1] - a[1])
  if (!ranked.length || ranked[0][1] <= 0) return null
  const [pid, gs] = ranked[0]
  const hit = mlbHit.get(`${pid}:${orgId}:${season}`)
  return {
    id: pid,
    gs,
    ops: hit ? hit.ops : null,
    pa: hit ? hit.pa : null,
    age: hit ? hit.age : null,
    quality: hit && hit.ops && lgOps.get(season) ? hit.ops / lgOps.get(season) : null,
    depth: ranked.filter((e) => e[1] >= 20).length,
    runnerUpGs: ranked[1] ? ranked[1][1] : 0,
  }
}

// A rotation has five doors, not one. The job above a Triple-A starter is the
// weakest man holding one of them.
function rotationJob(orgId, season, selfId) {
  const rows = (mlbPitchBySeason.get(season) || []).filter((r) => r.t === orgId && r.p !== selfId)
  const starters = rows.filter((r) => r.gs >= 5).sort((a, b) => b.gs - a.gs)
  if (!starters.length) return null
  const marginal = starters[Math.min(4, starters.length - 1)]
  return {
    id: marginal.p,
    gs: marginal.gs,
    era: marginal.era,
    ip: marginal.ip,
    age: marginal.age,
    quality: marginal.era && lgEra.get(season) ? lgEra.get(season) / marginal.era : null,
    depth: starters.filter((r) => r.gs >= 15).length,
    runnerUpGs: 0,
  }
}

// And the job above a Triple-A reliever is the worst arm in the bullpen.
function bullpenJob(orgId, season, selfId) {
  const rows = (mlbPitchBySeason.get(season) || []).filter((r) => r.t === orgId && r.p !== selfId)
  const pen = rows.filter((r) => r.gs < 5 && r.g >= 25 && r.era != null)
  if (!pen.length) return null
  const worst = pen.slice().sort((a, b) => b.era - a.era)[0]
  return {
    id: worst.p,
    gs: 0,
    era: worst.era,
    ip: worst.ip,
    age: worst.age,
    quality: worst.era && lgEra.get(season) ? lgEra.get(season) / worst.era : null,
    depth: pen.length,
    runnerUpGs: 0,
  }
}

function orgForMilbTeam(teamId, season) {
  for (let s = season; s >= season - 2; s -= 1) {
    const hit = orgmap[`${teamId}:${s}`]
    if (hit) return hit[0]
  }
  return null
}

// ---- build ---------------------------------------------------------------
const stays = []
const drops = { noPlayer: 0, noAaaRow: 0, noOrg: 0, noGroup: 0, noJob: 0 }

for (const s of dates.allDurations) {
  if (s.level !== 'AAA') continue
  const p = raw[String(s.playerId)]
  if (!p) { drops.noPlayer += 1; continue }

  const aaaRows = p.milb.filter((r) => r.sportId === 11)
  const inSeason = aaaRows.filter((r) => r.season === s.season)
  const pool = inSeason.length ? inSeason : aaaRows
  const teamRow = pool.slice().sort((a, b) => {
    const av = (a.stat && (a.stat.plateAppearances || Number(a.stat.inningsPitched))) || 0
    const bv = (b.stat && (b.stat.plateAppearances || Number(b.stat.inningsPitched))) || 0
    return bv - av
  })[0]
  if (!teamRow) { drops.noAaaRow += 1; continue }

  const orgId = orgForMilbTeam(teamRow.teamId, teamRow.season)
  if (!orgId) { drops.noOrg += 1; continue }

  // The prospect's own line at the level, first time through.
  const upTo = aaaRows.filter((r) => r.season <= s.season)
  const isPitcher = p.group === 'pitching'
  let ownPa = 0
  let ownOps = 0
  let ownIp = 0
  let ownEra = 0
  let ownGs = 0
  let ownG = 0
  if (isPitcher) {
    let er = 0
    for (const r of upTo) {
      ownIp += Number(r.stat && r.stat.inningsPitched) || 0
      ownGs += (r.stat && r.stat.gamesStarted) || 0
      ownG += (r.stat && r.stat.gamesPlayed) || 0
      er += (r.stat && r.stat.earnedRuns) || 0
    }
    ownEra = ownIp > 0 ? (er * 9) / ownIp : 0
  } else {
    let tb = 0
    let h = 0
    let ab = 0
    let bb = 0
    let hbp = 0
    let sf = 0
    for (const r of upTo) {
      const st = r.stat || {}
      ownPa += st.plateAppearances || 0
      tb += st.totalBases || 0
      h += st.hits || 0
      ab += st.atBats || 0
      bb += st.baseOnBalls || 0
      hbp += st.hitByPitch || 0
      sf += st.sacFlies || 0
    }
    const obDen = ab + bb + hbp + sf
    ownOps = (ab > 0 ? tb / ab : 0) + (obDen > 0 ? (h + bb + hbp) / obDen : 0)
  }

  const role = isPitcher ? (ownG > 0 && ownGs / ownG >= 0.5 ? 'SP' : 'RP') : null

  // Position while AT Triple-A, not the position he holds today.
  const aaaPos = posGroupFromFielding(milbFieldByPlayer.get(`${s.playerId}:${s.season}`))
    || posGroupFromFielding(milbFieldByPlayer.get(`${s.playerId}:${s.season - 1}`))
    || GROUP[p.ped && p.ped.posAbbr] || null
  if (!isPitcher && !aaaPos) { drops.noGroup += 1; continue }

  // The job ABOVE him never includes him. Once he is promoted he accrues
  // starts at the same position for the same club, so leaving him in would let
  // an early promotion inflate the depth count it is supposed to explain.
  const jobFor = (season) => {
    if (isPitcher) {
      return role === 'SP'
        ? rotationJob(orgId, season, s.playerId)
        : bullpenJob(orgId, season, s.playerId)
    }
    return incumbentAt(orgId, season, aaaPos, s.playerId)
  }
  const job = jobFor(s.season)
  const jobLag = jobFor(s.season - 1)
  if (!job) { drops.noJob += 1; continue }

  // Outcomes other than waiting: did he leave, and did he move position?
  const debutSeason = Number(s.debutDate.slice(0, 4))
  const debutHit = (mlbHitByPlayerSeason.get(`${s.playerId}:${debutSeason}`) || [])
    .slice().sort((a, b) => b.pa - a.pa)[0]
  const debutPitch = (mlbPitchByPlayerSeason.get(`${s.playerId}:${debutSeason}`) || [])
    .slice().sort((a, b) => b.ip - a.ip)[0]
  const debutOrg = isPitcher ? (debutPitch ? debutPitch.t : null) : (debutHit ? debutHit.t : null)
  const debutPos = posGroupFromFielding(mlbFieldByPlayer.get(`${s.playerId}:${debutSeason}`))

  const st = standings[`${orgId}:${s.season}`]

  stays.push({
    playerId: s.playerId,
    name: p.ped && p.ped.name,
    season: s.season,
    startDate: s.startDate,
    endDate: s.endDate,
    days: s.days,
    debutDate: s.debutDate,
    orgId,
    group: isPitcher ? 'pitching' : 'hitting',
    role,
    aaaPos,
    scarcity: isPitcher
      ? (role === 'SP' ? 'rotation' : 'bullpen')
      : (SCARCITY[aaaPos] || 'open'),
    ownPa,
    ownOps,
    ownIp,
    ownEra,
    ageAtStay: p.ped && p.ped.birthDate
      ? (new Date(s.startDate) - new Date(p.ped.birthDate)) / (365.25 * 24 * 3600 * 1000)
      : null,
    draftRound: p.ped ? p.ped.draftRound : null,
    job,
    jobLag,
    orgWinPct: st ? st.winPct : null,
    debutOrg,
    debutPos,
    changedOrg: debutOrg != null ? Number(debutOrg !== orgId) : null,
    changedPos: !isPitcher && debutPos && aaaPos ? Number(debutPos !== aaaPos) : null,
  })
}

console.log('AAA stays built:', stays.length, 'drops:', JSON.stringify(drops))
const ids = new Set()
for (const s of stays) {
  if (s.job && s.job.id) ids.add(s.job.id)
  if (s.jobLag && s.jobLag.id) ids.add(s.jobLag.id)
}
writeFileSync('stays.json', JSON.stringify(stays))
writeFileSync('incumbent-ids.json', JSON.stringify([...ids]))
console.log('distinct incumbents:', ids.size)
const byScarcity = {}
for (const s of stays) byScarcity[s.scarcity] = (byScarcity[s.scarcity] || 0) + 1
console.log('by job type:', JSON.stringify(byScarcity))
