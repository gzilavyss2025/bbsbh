// Pure, spoiler-aware shaping of the /people responses into the view model the
// player & team pages render. No fetching here (that's mlb.js) — every function
// takes raw API pieces and returns display-ready data, degrading to null/'—'
// for the fields MiLB feeds omit, per the app's "degrade, don't assume" rule.
//
// Spoiler note: these builders NEVER touch the live game feed. The player page
// fetches its own stats cut off at the day before the game date ("entering
// today"), so nothing here can leak the game being scored. The two full-season
// figures that can't be date-cut by the API — the current-season row and the
// vs-L/R splits — are labeled as such by the UI, not frozen.

const DASH = '—'

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// ".302" style rate: three decimals, no leading zero (baseball convention).
function rate3(x) {
  if (!Number.isFinite(x)) return DASH
  return x.toFixed(3).replace(/^0(?=\.)/, '')
}

// Innings pitched ("104.1" = 104 ⅓) <-> outs, so multi-stint lines sum right.
function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}
function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

// ---------------------------------------------------------------------------
// Player identity
// ---------------------------------------------------------------------------

export function personSportId(person) {
  return person?.currentTeam?.sport?.id ?? 1
}

export function isPitcher(person) {
  const p = person?.primaryPosition
  return p?.type === 'Pitcher' || p?.code === '1'
}

// Ohtani-type: a distinct primary position ('TWP' / code 'Y' / type
// 'Two-Way Player'). Such a player gets BOTH a batting and a pitching block.
export function isTwoWay(person) {
  const p = person?.primaryPosition
  return p?.abbreviation === 'TWP' || p?.code === 'Y' || p?.type === 'Two-Way Player'
}

// Starter / closer / reliever from a season pitching stat line. Only CL-vs-not
// changes the season tiles (closer leads with SV); the roster chip shows all
// three. Heuristic, since the API has no role field: mostly-starts => SP; else
// a real save count => CL; otherwise RP (incl. swing arms like Chad Patrick,
// who by design fall here and get the W-L-led tile set).
export function pitcherRole(stat) {
  if (!stat) return 'RP'
  const g = num(stat.gamesPitched ?? stat.gamesPlayed)
  const gs = num(stat.gamesStarted)
  if (g > 0 && gs / g >= 0.5) return 'SP'
  if (num(stat.saves) >= 8) return 'CL'
  return 'RP'
}

// The signed draft, matched to the person's draftYear — NOT drafts[0], which
// can be an earlier UNSIGNED draft (Judge was a 31st-round 2010 pick out of
// high school before his 2013 first round). Undrafted / international players
// carry no draft, so this returns null and the fact box shows "—".
export function draftInfo(person) {
  const year = person?.draftYear
  const drafts = person?.drafts ?? []
  const signed =
    drafts.find((d) => String(d.year) === String(year)) ??
    (drafts.length ? drafts[drafts.length - 1] : null)
  if (!signed && !year) return null
  return {
    year: year ?? signed?.year ?? '',
    round: signed?.pickRound ?? '',
    overall: signed?.pickNumber ?? '',
  }
}

export function personBio(person) {
  if (!person) return null
  const born = [person.birthCity, person.birthStateProvince ?? person.birthCountry]
    .filter(Boolean)
    .join(', ')
  return {
    id: person.id,
    fullName: person.fullName ?? '',
    number: person.primaryNumber ?? '',
    posAbbr: person.primaryPosition?.abbreviation ?? '',
    posName: person.primaryPosition?.name ?? '',
    bats: person.batSide?.code ?? '',
    throws: person.pitchHand?.code ?? '',
    isPitcher: isPitcher(person),
    twoWay: isTwoWay(person),
    heightWeight:
      person.height && person.weight
        ? `${person.height} · ${person.weight}`
        : person.height || DASH,
    age: person.currentAge ?? DASH,
    born: born || DASH,
    debut: person.mlbDebutDate ?? '',
    draft: draftInfo(person),
    team: person.currentTeam
      ? { id: person.currentTeam.id, name: person.currentTeam.name }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Stat aggregation
// ---------------------------------------------------------------------------

// byDateRange emits duplicate rows (verified: two identical splits for a
// single-team player); a genuinely traded player would return distinct stints.
// So: dedupe identical rows, then if more than one remains, SUM counting stats
// and RECOMPUTE rates from the sums (never average rates). One row → passthrough
// (exact API values). Returns a single stat-like object, or null.
function statSig(s) {
  return [s.atBats, s.hits, s.inningsPitched, s.strikeOuts, s.gamesPlayed].join('|')
}
export function aggregateSplits(splits, group) {
  const stats = (splits ?? []).map((s) => s.stat).filter(Boolean)
  if (stats.length === 0) return null
  const seen = new Set()
  const uniq = stats.filter((s) => {
    const sig = statSig(s)
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
  if (uniq.length === 1) return uniq[0]
  const sum = (k) => uniq.reduce((t, s) => t + num(s[k]), 0)
  if (group === 'pitching') {
    const outs = uniq.reduce((t, s) => t + ipToOuts(s.inningsPitched), 0)
    const ip = outs / 3
    const er = sum('earnedRuns')
    const h = sum('hits')
    const bb = sum('baseOnBalls')
    return {
      wins: sum('wins'),
      losses: sum('losses'),
      saves: sum('saves'),
      inningsPitched: outsToIp(outs),
      strikeOuts: sum('strikeOuts'),
      baseOnBalls: bb,
      earnedRuns: er,
      gamesPlayed: sum('gamesPlayed'),
      gamesStarted: sum('gamesStarted'),
      era: ip ? rate3((er * 9) / ip).replace(/^\./, '0.') : DASH,
      whip: ip ? rate3((bb + h) / ip).replace(/^\./, '0.') : DASH,
    }
  }
  const ab = sum('atBats')
  const h = sum('hits')
  const bb = sum('baseOnBalls')
  const hbp = sum('hitByPitch')
  const sf = sum('sacFlies')
  const tb = sum('totalBases')
  const obpDen = ab + bb + hbp + sf
  const obp = obpDen ? (h + bb + hbp) / obpDen : 0
  const slg = ab ? tb / ab : 0
  return {
    atBats: ab,
    hits: h,
    homeRuns: sum('homeRuns'),
    rbi: sum('rbi'),
    runs: sum('runs'),
    strikeOuts: sum('strikeOuts'),
    stolenBases: sum('stolenBases'),
    baseOnBalls: bb,
    gamesPlayed: sum('gamesPlayed'),
    avg: ab ? rate3(h / ab) : DASH,
    obp: rate3(obp),
    slg: rate3(slg),
    ops: rate3(obp + slg),
  }
}

// ---------------------------------------------------------------------------
// Season tiles — the finalized card set
// ---------------------------------------------------------------------------

function tile(k, v, tone) {
  return { k, v: v === undefined || v === null || v === '' ? DASH : String(v), tone }
}

// Batter: AVG · HR · RBI · SO · SB.
export function hitterTiles(stat) {
  if (!stat) return []
  return [
    tile('AVG', stat.avg),
    tile('HR', stat.homeRuns, 'run'),
    tile('RBI', stat.rbi),
    tile('SO', stat.strikeOuts),
    tile('SB', stat.stolenBases),
  ]
}

// Pitcher: closer => SV·IP·ERA·K·BB; everyone else (SP + swing/RP) =>
// W-L·IP·ERA·K·BB. The trailing four are shared; only the lead tile differs.
export function pitcherTiles(stat, role) {
  if (!stat) return []
  const lead =
    role === 'CL'
      ? tile('SV', stat.saves)
      : tile('W–L', `${num(stat.wins)}–${num(stat.losses)}`)
  return [
    lead,
    tile('IP', stat.inningsPitched),
    tile('ERA', stat.era),
    tile('K', stat.strikeOuts, 'run'),
    tile('BB', stat.baseOnBalls),
  ]
}

// ---------------------------------------------------------------------------
// Career line — one compact mono row
// ---------------------------------------------------------------------------

export function careerLine(stat, group) {
  if (!stat) return ''
  if (group === 'pitching') {
    return [
      `${stat.era ?? DASH} ERA`,
      `${num(stat.wins)}–${num(stat.losses)}`,
      `${stat.inningsPitched ?? DASH} IP`,
      `${num(stat.strikeOuts)} K`,
      `${stat.whip ?? DASH} WHIP`,
    ].join('  ·  ')
  }
  return [
    `${stat.avg ?? DASH}/${stat.obp ?? DASH}/${stat.slg ?? DASH}`,
    `${num(stat.homeRuns)} HR`,
    `${num(stat.rbi)} RBI`,
    `${num(stat.hits)} H`,
    `${num(stat.gamesPlayed)} G`,
  ].join('  ·  ')
}

// ---------------------------------------------------------------------------
// vs-L/R splits (full season — the UI labels them so, not "entering today")
// ---------------------------------------------------------------------------

export function splitsView(lrSplits) {
  const byCode = {}
  for (const s of lrSplits ?? []) {
    const code = s.split?.code
    if (code) byCode[code] = s.stat
  }
  const l = byCode.vl
  const r = byCode.vr
  if (!l && !r) return null
  const side = (stat) =>
    stat ? { avg: stat.avg ?? DASH, ops: stat.ops ?? DASH } : { avg: DASH, ops: DASH }
  return { left: side(l), right: side(r) }
}

// ---------------------------------------------------------------------------
// Game log — the back-of-the-card ledger, spoiler-safe by date cutoff
// ---------------------------------------------------------------------------

// Short, correct opponent label from the full name (abbreviation is blank in
// gameLog rows): the team nickname is the last word — "Tampa Bay Rays" → "Rays".
function oppLabel(opponent) {
  const name = opponent?.teamName || opponent?.name || ''
  if (!name) return DASH
  return opponent?.teamName || name.split(/\s+/).slice(-1)[0]
}

// Rows are filtered to games BEFORE `cutoff` (YYYY-MM-DD) — the day the game
// being scored starts — then shown newest first. That cutoff is the whole
// spoiler defense: the log can never surface tonight's line or anything after
// it. `cutoff` null (context-free cold link) shows the most recent games.
export function gameLogView(splits, group, cutoff, limit = 8) {
  const rows = (splits ?? [])
    .filter((s) => s.date && (!cutoff || s.date < cutoff))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((s) => {
      const st = s.stat ?? {}
      const md = (s.date || '').slice(5).replace('-', '/').replace(/^0/, '')
      const base = { date: md, home: s.isHome, opp: oppLabel(s.opponent), gamePk: s.game?.gamePk ?? null }
      if (group === 'pitching') {
        return {
          ...base,
          cells: [st.inningsPitched ?? DASH, num(st.hits), num(st.earnedRuns), num(st.strikeOuts), num(st.baseOnBalls)],
        }
      }
      return {
        ...base,
        cells: [num(st.atBats), num(st.hits), num(st.homeRuns), num(st.rbi), num(st.baseOnBalls)],
      }
    })
  if (!rows.length) return null
  const columns =
    group === 'pitching'
      ? ['IP', 'H', 'ER', 'K', 'BB']
      : ['AB', 'H', 'HR', 'RBI', 'BB']
  return { columns, rows }
}

// ---------------------------------------------------------------------------
// Pitch arsenal — the unique pitch types a pitcher throws and their average
// velocity, from stats=pitchArsenal, ordered by usage. Statcast-derived, so
// absent at parks without pitch tracking (most AA/High-A, some Single-A) —
// degrades to null and the UI hides the section, per "degrade, don't assume".
// ---------------------------------------------------------------------------

export function arsenalView(splits) {
  const rows = (splits ?? [])
    .map((s) => s.stat)
    .filter((st) => st?.type?.code)
    .map((st) => {
      const velo = Number(st.averageSpeed)
      const usage = Number(st.percentage)
      return {
        code: st.type.code,
        name: st.type.description || st.type.code,
        velo: Number.isFinite(velo) && velo > 0 ? velo : null,
        usage: Number.isFinite(usage) ? usage : null,
      }
    })
    .sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
  return rows.length ? rows : null
}

// ---------------------------------------------------------------------------
// Year-by-year — prior seasons as-is; current season uses the "entering today"
// aggregate (not yearByYear's live one), marked with * by the UI. Newest season
// first, capped by a career total row (careerStat) rendered in the same columns.
// ---------------------------------------------------------------------------

// One season / career row's cells, in the group's year-by-year columns.
function yearByYearCells(st, group) {
  return group === 'pitching'
    ? [`${num(st.wins)}–${num(st.losses)}`, st.era ?? DASH, st.inningsPitched ?? DASH, num(st.strikeOuts), st.whip ?? DASH]
    : [num(st.gamesPlayed), num(st.homeRuns), num(st.rbi), st.avg ?? DASH, st.ops ?? DASH]
}

export function yearByYearView(splits, group, currentStat, currentSeason, careerStat) {
  // Combine multi-team seasons into one row per year (sum), keeping it a clean
  // one-line-per-season ledger.
  const byYear = new Map()
  for (const s of splits ?? []) {
    const yr = String(s.season ?? '')
    if (!yr) continue
    if (!byYear.has(yr)) byYear.set(yr, [])
    byYear.get(yr).push({ stat: s.stat, team: s.team })
  }
  const cur = String(currentSeason ?? '')
  const rows = [...byYear.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // most recent season first
    .map(([yr, entries]) => {
      const isCurrent = yr === cur
      // For the current season, prefer the date-cut aggregate so the row can't
      // move mid-game; older seasons are settled, so aggregate their stints.
      const stat = isCurrent && currentStat ? currentStat : aggregateSplits(entries, group)
      return { year: yr, isCurrent, cells: yearByYearCells(stat ?? {}, group) }
    })
  if (!rows.length) return null
  const columns =
    group === 'pitching'
      ? ['W–L', 'ERA', 'IP', 'K', 'WHIP']
      : ['G', 'HR', 'RBI', 'AVG', 'OPS']
  const total = careerStat ? yearByYearCells(careerStat, group) : null
  return { columns, rows, total }
}

// ---------------------------------------------------------------------------
// One stat block (a group's tiles + career + splits + logs). A normal player
// has one block; a two-way player has two (batting then pitching).
// ---------------------------------------------------------------------------

export function buildBlock({ group, role, seasonSplits, careerSplits, lrSplits, gameLogSplits, yearByYearSplits, arsenalSplits, cutoff, currentSeason }) {
  const season = aggregateSplits(seasonSplits, group)
  const career = aggregateSplits(careerSplits, group)
  return {
    group,
    role,
    title: group === 'pitching' ? 'Pitching' : 'Batting',
    tiles: group === 'pitching' ? pitcherTiles(season, role) : hitterTiles(season),
    arsenal: group === 'pitching' ? arsenalView(arsenalSplits) : null,
    splits: splitsView(lrSplits),
    splitsLabel: group === 'pitching' ? 'opp. batter' : '',
    gameLog: gameLogView(gameLogSplits, group, cutoff, group === 'pitching' ? 6 : 8),
    // The career total folds into the year-by-year ledger's footer row.
    yearByYear: yearByYearView(yearByYearSplits, group, season, currentSeason, career),
  }
}

// ---------------------------------------------------------------------------
// Team page helpers
// ---------------------------------------------------------------------------

export function ordinal(n) {
  const v = num(n)
  if (!v) return DASH
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return `${v}${s[(m - 20) % 10] ?? s[m] ?? s[0]}`
}

// This team's rank (1 = best) among all clubs for one stat. Lower-is-better for
// ERA/WHIP, higher-is-better otherwise. Returns null if the team isn't found.
export function rankTeam(leagueStats, teamId, key, lowerBetter = false) {
  const rows = (leagueStats ?? []).filter((r) => r.stat?.[key] != null)
  if (!rows.length) return null
  rows.sort((a, b) => {
    const av = num(a.stat[key])
    const bv = num(b.stat[key])
    return lowerBetter ? av - bv : bv - av
  })
  const idx = rows.findIndex((r) => r.teamId === teamId)
  return idx < 0 ? null : { rank: idx + 1, of: rows.length }
}

// The pitcher role chip label for a roster row, from hydrated season pitching.
export function rosterPitcherRole(rosterEntry) {
  const stat = rosterEntry?.person?.stats?.[0]?.splits?.[0]?.stat
  return pitcherRole(stat)
}

// "First Last" (natural title case) — the team page shows names this way, unlike
// the scorebook's surname-first lineup rows.
export function firstLast(person) {
  return person?.fullName ?? person?.useName ?? ''
}
