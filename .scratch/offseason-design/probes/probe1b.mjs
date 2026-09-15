// Probe 1b: what fraction of a MiLB season is actually SCOREABLE in Tally's
// GameSelect -> GameView -> TeamInfo -> InningViewer flow?
// Not the scheduled count. A completed game with a feed complete enough to score.
const API = 'https://statsapi.mlb.com'

async function getJson(path, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + path)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return await r.json()
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((s) => setTimeout(s, 1500 * (i + 1)))
    }
  }
}

// Deterministic sample so a re-run reports the same games.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample(arr, n, seed) {
  const rnd = mulberry32(seed)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

function checkFeed(feed) {
  const g = feed?.gameData ?? {}
  const l = feed?.liveData ?? {}
  const plays = l?.plays?.allPlays ?? []
  const box = l?.boxscore?.teams ?? {}
  const awayBO = (box?.away?.battingOrder ?? []).length
  const homeBO = (box?.home?.battingOrder ?? []).length
  const innings = (l?.linescore?.innings ?? []).length

  let placed = 0, withPitches = 0, pitchTotal = 0, tracked = 0, velo = 0
  for (const p of plays) {
    if (p?.about?.inning && p?.about?.halfInning) placed++
    const ev = p?.playEvents ?? []
    const pit = ev.filter((e) => e.isPitch)
    if (pit.length) withPitches++
    pitchTotal += pit.length
    for (const e of pit) {
      if (e?.pitchData?.coordinates?.pX != null) tracked++
      if (e?.pitchData?.startSpeed != null) velo++
    }
  }
  // A play with no pitch is legitimate (a pickoff, a baserunning-only play),
  // so measure the SHARE of plays carrying pitches rather than demanding all.
  const pitchShare = plays.length ? withPitches / plays.length : 0

  return {
    status: g?.status?.detailedState ?? '?',
    abstract: g?.status?.abstractGameState ?? '?',
    plays: plays.length,
    placed,
    innings,
    awayBO,
    homeBO,
    officials: (l?.boxscore?.officials ?? []).length,
    pitchTotal,
    pitchShare: +pitchShare.toFixed(3),
    trackedPitches: tracked,
    veloPitches: velo,
    // The three things the scoring flow cannot do without.
    hasPlays: plays.length > 0 && placed === plays.length,
    hasLineups: awayBO >= 9 && homeBO >= 9,
    hasPitches: pitchTotal > 0 && pitchShare >= 0.8,
    hasLinescore: innings > 0,
  }
}

const LEVELS = [
  { sportId: 11, label: 'AAA', n: Number(process.env.N_OTHER || 25) },
  { sportId: 12, label: 'AA', n: Number(process.env.N_OTHER || 25) },
  { sportId: 13, label: 'A+', n: Number(process.env.N_MAIN || 60) },
  { sportId: 14, label: 'A', n: Number(process.env.N_OTHER || 25) },
]
const SEASON = process.env.SEASON || '2025'

const out = { season: SEASON, levels: {} }

for (const lv of LEVELS) {
  const sched = await getJson(
    `/api/v1/schedule?sportId=${lv.sportId}&season=${SEASON}&gameType=R`,
  )
  const seen = new Map()
  for (const d of sched.dates ?? []) {
    for (const g of d.games ?? []) {
      // Dedupe: the schedule repeats games across `dates` entries.
      if (!seen.has(g.gamePk)) seen.set(g.gamePk, { ...g, date: d.date })
    }
  }
  const all = [...seen.values()]
  // A POSTPONED game reports abstractGameState 'Final' with no score, so gate
  // on the score being present rather than on the status string.
  const played = all.filter(
    (g) => g?.teams?.away?.score != null && g?.teams?.home?.score != null,
  )
  const picks = sample(played.map((g) => g.gamePk), lv.n, lv.sportId * 1000 + 7)

  const rows = []
  for (const pk of picks) {
    try {
      const feed = await getJson(`/api/v1.1/game/${pk}/feed/live`)
      rows.push({ gamePk: pk, ...checkFeed(feed) })
    } catch (e) {
      rows.push({ gamePk: pk, error: String(e.message || e) })
    }
    await new Promise((s) => setTimeout(s, 120))
  }

  const ok = rows.filter((r) => r.hasPlays && r.hasLineups && r.hasPitches && r.hasLinescore)
  out.levels[lv.label] = {
    sportId: lv.sportId,
    scheduledRows: all.length,
    playedRows: played.length,
    sampled: rows.length,
    scoreable: ok.length,
    rate: +(ok.length / rows.length).toFixed(3),
    failing: {
      plays: rows.filter((r) => !r.error && !r.hasPlays).length,
      lineups: rows.filter((r) => !r.error && !r.hasLineups).length,
      pitches: rows.filter((r) => !r.error && !r.hasPitches).length,
      linescore: rows.filter((r) => !r.error && !r.hasLinescore).length,
      errors: rows.filter((r) => r.error).length,
    },
    trackedGames: rows.filter((r) => r.trackedPitches > 0).length,
    veloGames: rows.filter((r) => r.veloPitches > 0).length,
    umpiredGames: rows.filter((r) => r.officials > 0).length,
    rows,
  }
  console.error(
    `${lv.label}: ${all.length} sched rows, ${played.length} played, sampled ${rows.length}, scoreable ${ok.length}`,
  )
}

console.log(JSON.stringify(out, null, 1))
