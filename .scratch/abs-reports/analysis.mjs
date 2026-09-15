// Reproduces every figure in research.md section 3, from the row store plus the
// two derived caches. Nothing here writes: it is the audit trail for the numbers
// quoted in #1072 and its children.
//
//   node .scratch/abs-reports/fetch-innings.mjs     # writes final-innings.json
//   node .scratch/abs-reports/fetch-exposure.mjs    # writes exposure.json
//   node .scratch/abs-reports/analysis.mjs          # prints the lot
//   node .scratch/abs-reports/analysis.mjs q2 q7    # or just the ones named
//
// The derivations here are the SPEC for the export cuts in #1058 to #1062. When
// one of those lands in scripts/lib/abs/, its unit tests should reproduce these
// numbers, and any disagreement is worth chasing before the surface is drawn.
import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'

const want = new Set(process.argv.slice(2))
const run = (k) => want.size === 0 || want.has(k)

const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json', 'utf8'))
const exposure = JSON.parse(await readFile('.scratch/abs-reports/exposure.json', 'utf8'))
const db = await openDb()
const ROWS = db.prepare('SELECT * FROM abs_challenges').all()
const GAMES = db.prepare('SELECT * FROM abs_ingested_games').all()
db.close()

const LEVELS = ['MLB', 'AAA']
const H = (h) => (h === 'top' ? 0 : 1)
const idx = (r) => 2 * (r.inning - 1) + H(r.half)
const pct = (n, d) => (d > 0 ? ((100 * n) / d).toFixed(2) : '-')

// A game that was never played has no final inning. Excluded from every
// denominator here — see #1073.
const played = (g) => {
  const f = fin[g.game_pk]
  return f && f.fin ? f : null
}
const lastHalf = (gamePk) => {
  const f = fin[gamePk]
  return f && f.fin ? 2 * (f.fin - 1) + (f.bot ? 1 : 0) : null
}

// Per (game, club), that club's failed challenges in order. The SECOND empties it.
function failsByGameTeam(rows) {
  const m = new Map()
  for (const r of rows) {
    if (r.outcome !== 'fail') continue
    const k = `${r.game_pk}:${r.team_id}`
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  for (const l of m.values()) l.sort((a, b) => idx(a) - idx(b) || a.seq - b.seq)
  return m
}

// ---- Q1: umpires ------------------------------------------------------------
if (run('q1')) {
  console.log('\n=== Q1  plate umpires ===')
  for (const level of LEVELS) {
    const gs = GAMES.filter((g) => g.level === level && played(g))
    const rs = ROWS.filter((r) => r.level === level)
    const games = new Map()
    const counts = new Map()
    for (const g of gs) if (g.umpire_id != null) games.set(g.umpire_id, (games.get(g.umpire_id) ?? 0) + 1)
    for (const r of rs) {
      if (r.umpire_id == null) continue
      const c = counts.get(r.umpire_id) ?? { n: 0, s: 0, name: r.umpire_name }
      c.n += 1
      if (r.outcome === 'success') c.s += 1
      counts.set(r.umpire_id, c)
    }
    const league = rs.length / gs.length
    const board = [...games]
      .filter(([, gp]) => gp >= 15)
      .map(([id, gp]) => {
        const c = counts.get(id) ?? { n: 0, s: 0, name: '' }
        return { name: c.name, gp, n: c.n, perGame: c.n / gp, rate: c.n ? c.s / c.n : null }
      })
      .sort((a, b) => b.perGame - a.perGame)
    console.log(`${level}: league ${league.toFixed(2)}/game, ${board.length} of ${games.size} clear 15 games`)
    console.log(`  most  ${board[0].name} ${board[0].perGame.toFixed(2)} (${board[0].n} in ${board[0].gp})`)
    const last = board[board.length - 1]
    console.log(`  least ${last.name} ${last.perGame.toFixed(2)} (${last.n} in ${last.gp})`)
    console.log(`  spread ${(board[0].perGame - last.perGame).toFixed(2)} a game`)
    const byRate = board.slice().sort((a, b) => b.rate - a.rate)
    console.log(`  overturned most ${byRate[0].name} ${(100 * byRate[0].rate).toFixed(1)}%` +
      `, least ${byRate[byRate.length - 1].name} ${(100 * byRate[byRate.length - 1].rate).toFixed(1)}%`)
  }
}

// ---- Q2: innings, and the chances denominator -------------------------------
// A CHANCE is one half-inning a club played while it still held a challenge.
// Both clubs are exposed in every half-inning: the batting club through its
// batter, the fielding club through its catcher or pitcher.
function chancesByInning(level, MAXI = 13) {
  const gs = GAMES.filter((g) => g.level === level)
  const fails = failsByGameTeam(ROWS.filter((r) => r.level === level))
  const club = Array(MAXI + 2).fill(0)
  const halves = Array(MAXI + 2).fill(0)
  let skipped = 0
  for (const g of gs) {
    const f = played(g)
    if (!f) { skipped += 1; continue }
    for (let i = 1; i <= Math.min(f.fin, MAXI); i++) {
      for (const half of ['top', 'bottom']) {
        const isPlayed = half === 'top' ? i <= f.fin : i < f.fin || (i === f.fin && f.bot)
        if (!isPlayed) continue
        halves[i] += 1
        for (const teamId of [g.away_team_id, g.home_team_id]) {
          const list = fails.get(`${g.game_pk}:${teamId}`) ?? []
          const before = list.filter((r) => r.inning < i || (r.inning === i && H(r.half) < H(half))).length
          if (before < 2) club[i] += 1
        }
      }
    }
  }
  return { club, halves, skipped }
}

if (run('q2')) {
  console.log('\n=== Q2  innings, per 100 chances ===')
  for (const level of LEVELS) {
    const { club, halves, skipped } = chancesByInning(level)
    const rs = ROWS.filter((r) => r.level === level)
    console.log(`${level} (${skipped} game(s) skipped for want of a final inning)`)
    console.log('  inn  halves  chances     n   per100   bat   cat   pit    won%')
    for (let i = 1; i <= 9; i++) {
      const inRows = rs.filter((r) => r.inning === i)
      const n = inRows.length
      const by = (role) => inRows.filter((r) => r.role === role).length
      const won = inRows.filter((r) => r.outcome === 'success').length
      console.log(
        `  ${String(i).padStart(3)} ${String(halves[i]).padStart(7)} ${String(club[i]).padStart(8)}` +
        ` ${String(n).padStart(5)} ${pct(n, club[i]).padStart(8)}` +
        ` ${pct(by('batter'), club[i]).padStart(5)} ${pct(by('catcher'), club[i]).padStart(5)}` +
        ` ${pct(by('pitcher'), club[i]).padStart(5)} ${pct(won, n).padStart(7)}`,
      )
    }
    // The sum check that the role rates share the club denominator.
    const i = 9
    const inRows = rs.filter((r) => r.inning === i)
    const parts = ['batter', 'catcher', 'pitcher', 'other']
      .reduce((a, role) => a + inRows.filter((r) => r.role === role).length, 0)
    console.log(`  role sum check, inning 9: ${pct(parts, club[i])} against club ${pct(inRows.length, club[i])}`)
  }
}

// ---- Q3: who ran out earliest ----------------------------------------------
if (run('q3')) {
  console.log('\n=== Q3  out of challenges ===')
  for (const level of LEVELS) {
    const fails = failsByGameTeam(ROWS.filter((r) => r.level === level))
    const emptied = []
    for (const [k, list] of fails) {
      if (list.length < 2) continue
      emptied.push({ key: k, at: list[1] })
    }
    const dist = new Map()
    for (const e of emptied) dist.set(e.at.inning, (dist.get(e.at.inning) ?? 0) + 1)
    const clubGames = GAMES.filter((g) => g.level === level && played(g)).length * 2
    console.log(`${level}: ${emptied.length} of ${clubGames} club-games ran dry (1 in ${(clubGames / emptied.length).toFixed(1)})`)
    console.log('  by inning: ' + [...dist].sort((a, b) => a[0] - b[0]).map(([i, n]) => `${i}:${n}`).join(' '))
    const band = emptied
      .filter((e) => e.at.inning === Math.min(...dist.keys()))
      .sort((a, b) => H(a.at.half) - H(b.at.half) || a.at.seq - b.at.seq)
    console.log(`  earliest band (inning ${band[0].at.inning}): ${band.length} clubs`)
  }
}

// ---- Q4: streaks ------------------------------------------------------------
if (run('q4')) {
  console.log('\n=== Q4  longest runs ===')
  for (const level of LEVELS) {
    const per = new Map()
    for (const r of ROWS) {
      if (r.level !== level || r.player_id == null) continue
      if (!per.has(r.player_id)) per.set(r.player_id, [])
      per.get(r.player_id).push(r)
    }
    let bestWin = null
    let bestLoss = null
    let bestGameWin = 0
    let maxGameLoss = 0
    for (const list of per.values()) {
      list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.game_pk - b.game_pk || a.seq - b.seq)
      let cur = null
      let len = 0
      const best = { success: 0, fail: 0 }
      for (const r of list) {
        if (r.outcome === cur) len += 1
        else { cur = r.outcome; len = 1 }
        if (len > best[cur]) best[cur] = len
      }
      const s = list.filter((r) => r.outcome === 'success').length
      const rec = { name: list[0].player_name, n: list.length, s }
      if (!bestWin || best.success > bestWin.len) bestWin = { ...rec, len: best.success }
      if (!bestLoss || best.fail > bestLoss.len) bestLoss = { ...rec, len: best.fail }
      const byGame = new Map()
      for (const r of list) {
        if (!byGame.has(r.game_pk)) byGame.set(r.game_pk, [])
        byGame.get(r.game_pk).push(r)
      }
      for (const g of byGame.values()) {
        let c2 = null
        let l2 = 0
        for (const r of g) {
          if (r.outcome === c2) l2 += 1
          else { c2 = r.outcome; l2 = 1 }
          if (c2 === 'success' && l2 > bestGameWin) bestGameWin = l2
          if (c2 === 'fail' && l2 > maxGameLoss) maxGameLoss = l2
        }
      }
    }
    console.log(`${level}: season wins ${bestWin.len} (${bestWin.name}, ${bestWin.s} of ${bestWin.n})`)
    console.log(`  season losses ${bestLoss.len} (${bestLoss.name}, ${bestLoss.s} of ${bestLoss.n})`)
    console.log(`  in one game: wins ${bestGameWin}, losses ${maxGameLoss} (2 is the rulebook cap)`)
  }
}

// ---- Q5 / Q6: exposure ------------------------------------------------------
if (run('q6') || run('q5')) {
  console.log('\n=== Q5/Q6  how often is normal ===')
  const byRole = new Map()
  for (const r of ROWS) {
    if (r.player_id == null) continue
    const k = `${r.level}:${r.team_id}:${r.player_id}:${r.role}`
    byRole.set(k, (byRole.get(k) ?? 0) + 1)
  }
  for (const level of LEVELS) {
    const E = exposure.filter((e) => e.level === level)
    const got = (e, role) => byRole.get(`${level}:${e.teamId}:${e.playerId}:${role}`) ?? 0
    const bats = E.filter((e) => e.pitches > 0)
    const bn = bats.reduce((a, e) => a + got(e, 'batter'), 0)
    const bp = bats.reduce((a, e) => a + e.pitches, 0)
    const bpa = bats.reduce((a, e) => a + e.pa, 0)
    console.log(`${level} batters: ${(1000 * bn / bp).toFixed(2)} per 1,000 pitches, one every ${Math.round(bpa / bn)} PA`)
    const cs = E.filter((e) => e.cInnings > 0)
    const cn = cs.reduce((a, e) => a + got(e, 'catcher'), 0)
    const ci = cs.reduce((a, e) => a + e.cInnings, 0)
    console.log(`${level} catchers: ${(9 * cn / ci).toFixed(2)} per 9 innings, one every ${(ci / cn).toFixed(1)} innings`)
    const q = bats.filter((e) => e.pa >= 200).map((e) => (1000 * got(e, 'batter')) / e.pitches).sort((a, b) => a - b)
    const at = (p) => q[Math.floor(q.length * p)].toFixed(2)
    console.log(`  spread over ${q.length} qualified hitters: p10 ${at(0.1)} median ${at(0.5)} p90 ${at(0.9)}` +
      `, ${q.filter((v) => v === 0).length} at zero`)
    const totalBat = ROWS.filter((r) => r.level === level && r.role === 'batter').length
    console.log(`  coverage: ${bn} of ${totalBat} batter rows matched (${pct(bn, totalBat)}%)`)
  }
}

// ---- Q7: after a win, after a loss ------------------------------------------
if (run('q7')) {
  console.log('\n=== Q7  after a win, after a loss ===')
  for (const level of LEVELS) {
    const byGT = new Map()
    for (const r of ROWS) {
      if (r.level !== level) continue
      const k = `${r.game_pk}:${r.team_id}`
      if (!byGT.has(k)) byGT.set(k, [])
      byGT.get(k).push(r)
    }
    for (const l of byGT.values()) l.sort((a, b) => idx(a) - idx(b) || a.seq - b.seq)
    const naive = {}
    const strict = {}
    const cell = (o, k) => (o[k] ??= { ev: 0, again: 0, halves: 0 })
    for (const [k, list] of byGT) {
      const end = lastHalf(k.split(':')[0])
      if (end == null) continue
      let fails = 0
      for (let i = 0; i < list.length; i++) {
        const r = list[i]
        if (r.outcome === 'fail') fails += 1
        const rem = 2 - fails
        const left = Math.max(0, end - idx(r))
        if (rem <= 0 || left <= 0) continue
        const next = list[i + 1]
        const n = cell(naive, r.outcome)
        n.ev += 1; n.halves += left; if (next) n.again += 1
        // The strict control: the club's SECOND challenge, exactly one in hand,
        // so both groups have called two and hold one. The only difference left
        // is how the most recent one went.
        if (i === 1 && rem === 1) {
          const s = cell(strict, r.outcome === 'fail' ? 'lost it' : 'won it')
          s.ev += 1; s.halves += left; if (next) s.again += 1
        }
      }
    }
    console.log(`${level} naive:  after a win ${pct(naive.success.again, naive.success.halves)}` +
      `, after a loss ${pct(naive.fail.again, naive.fail.halves)}`)
    console.log(`${level} strict: ${Object.entries(strict).map(([k, v]) =>
      `${k} ${pct(v.again, v.halves)} (n=${v.ev})`).join(', ')}`)
  }
}
