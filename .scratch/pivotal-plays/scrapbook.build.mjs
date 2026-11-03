// Builds the datasets behind Gary's scorebook dashboard (see spec.md, "Gary's scrapbook"):
//   pivotal.json  one row per scored game, in plain scorekeeper sentences:
//                 Took the lead, Game turned, Biggest play, The scare, Tensest moment + scoped ranks
//   tensest.json  the three "tensest moments of 2026" tables (Brewers batting, Brewers pitching, all of baseball)
//
//   node .scratch/pivotal-plays/scrapbook.build.mjs <gamelog.json> <season-li.json> <out dir>
//
// gamelog.json is the dashboard's game list (id = gamePk, game = label, decisive = go-ahead play text).
// season-li.json comes from season-pressure.probe.mjs ({ plays: [[gamePk, index, inning, isTop, leverage]] }).
// Read-only except the two output files. Source: statsapi.mlb.com (winProbability, schedule), checked 2026-11-03.
//
// Voice rules (spec.md, "Voice"): last names, "top of the 5th", "chances of winning",
// the pressure baseline stated in the sentence, every sentence built from the data and nothing guessed.
import { readFileSync, writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const [logPath, liPath, outDir] = process.argv.slice(2)
const log = JSON.parse(readFileSync(logPath, 'utf8'))
const { plays } = JSON.parse(readFileSync(liPath, 'utf8'))
const MIL = 158

// ---------- small helpers ----------
const ord = (n) => { const m = n % 100; const s = m >= 11 && m <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'); return `${n}${s}` }
const lastName = (full) => { const p = String(full).trim().split(' '); return /^(Jr\.|Sr\.|II|III|IV)$/.test(p.at(-1)) ? p.slice(-2).join(' ') : p.at(-1) }
const poss = (name) => (name.endsWith('s') ? `${name}’` : `${name}’s`)
const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateLabel = (d) => `${mon[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`
const when = (e) => `${e.about.isTopInning ? 'top' : 'bottom'} of the ${ord(e.about.inning)}`
const Cap = (s) => s[0].toUpperCase() + s.slice(1)
const fmtInt = (n) => n.toLocaleString('en-US')
const list = (xs) => (xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

// Field words in a play description -> a direction ("to right").
const POS = { 'left fielder': 'left', 'center fielder': 'center', 'right fielder': 'right', shortstop: 'short', 'third baseman': 'third', 'second baseman': 'second', 'first baseman': 'first', pitcher: 'the pitcher', catcher: 'the catcher' }
function direction(desc) {
  const hr = /to (left|right) center field/.exec(desc)
  if (hr) return `${hr[1]}-center`
  const f = /to (left|center|right) field\b/.exec(desc)
  if (f) return f[1]
  for (const [k, v] of Object.entries(POS)) if (new RegExp(`\\b${k}\\b`).test(desc.split('.')[0])) return v
  return ''
}
function scorers(desc) {
  const out = []
  for (const m of desc.matchAll(/(?:^|[.,] )([A-Z][^.,]*?) scores\./g)) out.push(lastName(m[1]))
  return out
}
const unmapped = new Map()

// One at-bat -> { verb, hit (true: "off" the pitcher, false: "against"), scoring ("and scored X" or "") }
function describe(e) {
  const ev = (e.result.event || '').toLowerCase(), d = e.result.description || ''
  const runs = scorers(d), dir = direction(d)
  const to = dir ? ` to ${dir}` : ''
  const scored = runs.length ? `, scoring ${list(runs)}` : ''
  let verb, hit = false, scoring = scored
  if (ev === 'single') { verb = `singled${to}`; hit = true }
  else if (ev === 'double') { verb = `doubled${to}`; hit = true }
  else if (ev === 'triple') { verb = `tripled${to}`; hit = true }
  else if (ev === 'home run') {
    const n = runs.length + 1
    verb = `hit ${n === 1 ? 'a solo homer' : n === 2 ? 'a two-run homer' : n === 3 ? 'a three-run homer' : 'a grand slam'}${to}`
    hit = true; scoring = ''
  }
  else if (ev.includes('strikeout')) { verb = /called out on strikes/.test(d) ? 'struck out looking' : 'struck out swinging'; if (/double play/.test(d)) verb = 'struck out into a double play'; scoring = '' }
  else if (ev.includes('double play') || /double play/.test(d)) { verb = 'grounded into a double play'; scoring = '' }
  else if (ev === 'triple play') { verb = 'hit into a triple play'; scoring = '' }
  else if (ev === 'groundout') verb = `grounded out${to}`
  else if (ev === 'flyout') verb = `flew out${to}`
  else if (ev === 'lineout') verb = `lined out${to}`
  else if (ev === 'pop out' || ev === 'popout') { verb = `popped out${to}`; scoring = '' }
  else if (ev === 'forceout' || ev === 'force out') verb = 'hit into a force out'
  else if (ev.includes('sac fly')) verb = `hit a sacrifice fly${to}`
  else if (ev.includes('sac bunt')) verb = 'bunted'
  else if (ev === 'walk') { verb = runs.length ? 'walked in a run' : 'walked'; scoring = '' }
  else if (ev === 'intent walk') { verb = runs.length ? 'was walked on purpose, forcing in a run' : 'was walked on purpose'; scoring = '' }
  else if (ev === 'hit by pitch') { verb = runs.length ? 'was hit by a pitch, forcing in a run' : 'was hit by a pitch'; scoring = '' }
  else if (ev.includes('error')) verb = 'reached on an error'
  else if (ev.includes('fielders choice') || ev.includes("fielder's choice")) verb = "reached on a fielder’s choice"
  else if (ev.includes('interference')) verb = 'reached on catcher’s interference'
  else { verb = ev || 'batted'; unmapped.set(ev, (unmapped.get(ev) || 0) + 1) }
  return { verb, hit, scoring }
}
// "Pratt singled to center off Rasmussen" / "DeLuca struck out swinging against Megill"
const play = (e) => {
  const x = describe(e), b = lastName(e.matchup.batter.fullName), p = lastName(e.matchup.pitcher.fullName)
  return { text: `${b} ${x.verb} ${x.hit ? 'off' : 'against'} ${p}`, scoring: x.scoring, b, p, verb: x.verb }
}

// ---------- league context (ranks) ----------
const sched = await getJson('/api/v1/schedule?sportId=1&season=2026&gameType=R,F,D,L,W&startDate=2026-03-01&endDate=2026-11-01')
const G = {}, names = {}
for (const d of sched.dates) for (const g of d.games) {
  G[g.gamePk] = { a: g.teams.away.team.id, h: g.teams.home.team.id }
  names[g.gamePk] = { date: g.officialDate, type: g.gameType, away: g.teams.away.team, home: g.teams.home.team, aS: g.teams.away.score, hS: g.teams.home.score }
}
const all = [], ninth = [], bat = [], pit = []
for (const [pk, , inn, top, li] of plays) {
  all.push(li); if (inn === 9) ninth.push(li)
  const g = G[pk]; if (!g) continue
  const batting = top ? g.a : g.h
  if (batting === MIL) bat.push(li); else if (g.a === MIL || g.h === MIL) pit.push(li)
}
for (const a of [all, ninth, bat, pit]) a.sort((x, y) => x - y)
const lowerBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m } return lo }
const upperBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m } return lo }
function rankText(a, li, noun = 'at-bats') {
  const n = a.length, lower = lowerBound(a, li), upper = upperBound(a, li), rank = n - upper + 1
  if (rank <= 100) return `${upper - lower > 1 ? 'Tied for ' : ''}${ord(rank)} of ${fmtInt(n)} ${noun}`
  return `Tenser than ${(100 * lower / n).toFixed(1)}% of ${noun}`
}

// ---------- one game ----------
function teamsOf(r) {
  const m = /^([WL]) (\d+)-(\d+) (at|vs) (.+)$/.exec(r.game)
  if (m) { const home = m[4] === 'vs', opp = m[5]; return { brewers: true, brewersHome: home, home: home ? 'Brewers' : opp, away: home ? opp : 'Brewers', winner: m[1] === 'W' ? 'Brewers' : opp } }
  const o = /^(.+) (\d+), (.+) (\d+)$/.exec(r.game)
  if (o) return { brewers: false, away: o[1], home: o[3], winner: Number(o[2]) > Number(o[4]) ? o[1] : o[3] }
  return null
}
const rows = []
for (const r of log) {
  const base = { id: r.id, date: r.date, game: r.game, chapter: r.chapter, available: false }
  const t = teamsOf(r)
  let w = null
  try { w = await getJson(`/api/v1/game/${r.id}/winProbability`) } catch { /* none */ }
  if (!t || !Array.isArray(w) || w.length < 10) { rows.push(base); continue }
  const winnerHome = t.winner === t.home
  const win = w.map((e) => (winnerHome ? e.homeTeamWinProbability : 100 - e.homeTeamWinProbability))
  const wpa = w.map((e) => e.homeTeamWinProbabilityAdded ?? 0)
  const li = w.map((e) => e.leverageIndex ?? 0)
  const helped = (i) => (wpa[i] >= 0 ? t.home : t.away)
  const W = poss(t.winner)

  // Took the lead: the play the scorebook already calls the go-ahead play.
  const body = String(r.decisive || '').replace(/^(top|bottom) \d+:\s*/i, '').replace(/\s*\(\d+-\d+\)\s*$/, '').toLowerCase().replace(/\s+/g, ' ')
  const gi = body ? w.findIndex((e) => { const d = (e.result.description || '').toLowerCase().replace(/\s+/g, ' '); return d && (body.startsWith(d.slice(0, 40)) || d.startsWith(body.slice(0, 40))) }) : -1
  let tookLead = ''
  if (gi >= 0) {
    const e = w[gi], p = play(e), ws = winnerHome ? e.result.homeScore : e.result.awayScore, ls = winnerHome ? e.result.awayScore : e.result.homeScore
    tookLead = `${Cap(when(e))}: ${p.text}${p.scoring}.${ws > ls ? ` That put the ${t.winner} ahead, ${ws}-${ls}.` : ''}`
  }

  // Game turned: first play after which the winner's chances never fell to 50% or lower.
  let last = -1; for (let k = 0; k < win.length; k++) if (win[k] <= 50) last = k
  const ti = last + 1, wire = ti <= 1
  const turned = wire
    ? `Wire to wire: ${W} chances of winning never fell to even after the first play.`
    : `${Cap(when(w[ti]))}: ${play(w[ti]).text}${play(w[ti]).scoring}. After that, ${W} chances of winning never fell back to even.`

  // Biggest play and tensest moment.
  const bi = wpa.reduce((b, v, k) => (Math.abs(v) > Math.abs(wpa[b]) ? k : b), 0)
  const xi = li.indexOf(Math.max(...li))
  const bp = play(w[bi]), xp = play(w[xi])
  const helper = helped(bi)
  const bigTail = `It lifted the ${poss(helper)} chances of winning by ${Math.round(Math.abs(wpa[bi]))} points, the most of any play in the game.${helper !== t.winner ? ` The ${t.winner} still won.` : ''}`
  const big = bi === xi ? `Same play as the tensest moment below. ${bigTail}` : `${Cap(when(w[bi]))}: ${bp.text}${bp.scoring}. ${bigTail}`
  const liv = Math.max(...li)
  const tense = `${Cap(when(w[xi]))}: ${xp.text}${xp.scoring}. On MLB’s pressure scale a normal at-bat is 1.0; this one was ${liv.toFixed(1)}.`

  // The scare: the winner's lowest point after the first play.
  const lo = win.reduce((b, v, k) => (k > 0 && v < win[b] ? k : b), 1)
  const scare = win[lo] >= 40
    ? `No real scare. ${W} chances never fell below ${Math.round(win[lo])}%.`
    : `${W} chances fell to ${Math.round(win[lo])}% in the ${when(w[lo])}, after ${play(w[lo]).text}.`

  // Ranks of the tensest moment, each with its scope.
  const inn = w[xi].about.inning
  const ranks = [['All of baseball, 2026', rankText(all, liv)]]
  if (t.brewers) {
    const brewersBatting = t.brewersHome ? !w[xi].about.isTopInning : w[xi].about.isTopInning
    ranks.push(brewersBatting ? ['Brewers batting, 2026', rankText(bat, liv)] : ['Brewers pitching, 2026', rankText(pit, liv)])
  }
  if (inn === 9) ranks.push(['Ninth innings, 2026', rankText(ninth, liv, 'ninth-inning at-bats')])
  const [a, b, c] = [0, 1, 2].map((i) => ranks[i] || ['', ''])
  rows.push({ ...base, available: true, winner: t.winner, wireToWire: wire, tookLead, turned, big, scare, tense,
    rank1Scope: a[0], rank1: a[1], rank2Scope: b[0], rank2: b[1], rank3Scope: c[0], rank3: c[1] })
}
writeFileSync(`${outDir}/pivotal.json`, JSON.stringify(rows))

// ---------- the three tables ----------
const pick = (flag) => plays.map(([pk, i, inn, top, li]) => ({ pk, i, inn, top, li })).filter((r) => {
  const g = G[r.pk]; if (!g) return false
  const batting = r.top ? g.a : g.h
  return flag === 'bat' ? batting === MIL : flag === 'pit' ? batting !== MIL && (g.a === MIL || g.h === MIL) : true
}).sort((x, y) => y.li - x.li)
const cut = (items, n) => { const out = []; let rank = 0, prev = null; for (let k = 0; k < items.length; k++) { if (items[k].li !== prev) { rank = k + 1; prev = items[k].li } if (rank > n) break; out.push({ ...items[k], rank }) } return out }
const lists = { bat: cut(pick('bat'), 25), pit: cut(pick('pit'), 25), league: cut(pick('all'), 50) }
const WP = {}
for (const pk of new Set(Object.values(lists).flat().map((r) => r.pk))) WP[pk] = await getJson(`/api/v1/game/${pk}/winProbability`)
const scoredIds = new Set(log.map((x) => String(x.id)))
const label = (g) => {
  if (g.away.id === MIL || g.home.id === MIL) { const home = g.home.id === MIL, ms = home ? g.hS : g.aS, os = home ? g.aS : g.hS; return `${ms > os ? 'W' : 'L'} ${ms}-${os} ${home ? 'vs' : 'at'} ${(home ? g.away : g.home).name}` }
  return `${g.away.name} ${g.aS}, ${g.home.name} ${g.hS}`
}
const out = []
for (const [table, items] of Object.entries(lists)) {
  const tied = (x) => items.filter((y) => y.rank === x).length > 1
  items.forEach((r, k) => {
    const e = WP[r.pk][r.i], g = names[r.pk], p = play(e)
    out.push({ key: `${table}-${k + 1}`, table, rank: `${tied(r.rank) ? 'T' : ''}${r.rank}`, pressure: r.li.toFixed(2), date: dateLabel(g.date),
      game: label(g) + (g.type !== 'R' ? ' · postseason' : ''), when: `${r.top ? 'Top' : 'Bottom'} ${r.inn}`,
      who: `${e.matchup.batter.fullName} vs ${e.matchup.pitcher.fullName}`, what: `${p.verb}${p.scoring}`, scored: scoredIds.has(String(r.pk)) ? 'Scored' : '' })
  })
}
writeFileSync(`${outDir}/tensest.json`, JSON.stringify(out))

const ok = rows.filter((r) => r.available)
console.log(`pivotal rows: ${rows.length}; with data: ${ok.length}; wire to wire: ${ok.filter((r) => r.wireToWire).length}; no scare: ${ok.filter((r) => r.scare.startsWith('No real')).length}; missing tookLead: ${ok.filter((r) => !r.tookLead).length}`)
console.log(`tensest rows: ${out.length} (bat ${lists.bat.length}, pit ${lists.pit.length}, league ${lists.league.length})`)
console.log('unmapped events:', JSON.stringify([...unmapped]))
