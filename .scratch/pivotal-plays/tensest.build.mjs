// Builds the "tensest moments" tables from the season-wide leverage data: top 25 with the Brewers
// batting, top 25 with the Brewers pitching (every Brewers game, scored or not), top 50 in all of
// baseball, plus the scoped ranks of the five 2026 World Series games' key plays.
//
//   node .scratch/pivotal-plays/tensest.build.mjs <data folder> <gamelog.json>
//
// <data folder> holds season-li.json (from season-pressure.probe.mjs). <gamelog.json> is the scorebook
// dashboard's game list, used only to mark which games Gary scored. Ranks are competition ranks:
// 1 + the number of plays with a strictly higher score. A list never cuts through a tie.
// Result on 2026-11-03: the league top 50 ends exactly at a tie group; Brewers batting needs 26 rows.
import { readFileSync, writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'
const D = process.argv[2] // folder holding season-li.json; tensest.json is written there too
const { plays } = JSON.parse(readFileSync(D + 'season-li.json', 'utf8'))
const sched = await getJson('/api/v1/schedule?sportId=1&season=2026&gameType=R,F,D,L,W&startDate=2026-03-01&endDate=2026-11-01')
const G = {}
for (const d of sched.dates) for (const g of d.games) G[g.gamePk] = { date: g.officialDate, type: g.gameType, away: g.teams.away.team, home: g.teams.home.team, aS: g.teams.away.score, hS: g.teams.home.score }
const MIL = 158
// annotate
const rows = plays.map(([pk, i, inn, top, li]) => {
  const g = G[pk]; const bat = top ? g.away.id : g.home.id
  return { pk, i, inn, top, li, bat, milBat: bat === MIL, milPit: (g.away.id === MIL || g.home.id === MIL) && bat !== MIL }
})
const desc = [...rows].sort((a, b) => b.li - a.li)
const rankIn = (arr, li) => 1 + arr.filter((r) => r.li > li).length
const allLis = desc
const bat = desc.filter((r) => r.milBat), pit = desc.filter((r) => r.milPit)
const ninth = desc.filter((r) => r.inn === 9)
console.log('plays', rows.length, '| Brewers batting', bat.length, '| Brewers pitching', pit.length)
// detail for lists
const want = new Map()
const add = (arr, n) => arr.slice(0, n).forEach((r) => want.set(r.pk + ':' + r.i, r))
const upTo = (arr, n) => { const out = []; let rank = 0, prev = null; for (let k = 0; k < arr.length; k++) { if (arr[k].li !== prev) { rank = k + 1; prev = arr[k].li } if (rank > n) break; out.push(arr[k]) } return out }
add(upTo(desc, 50), 99999); add(upTo(bat, 25), 99999); add(upTo(pit, 25), 99999)
const need = [...new Set([...want.values()].map((r) => r.pk))]
const W = {}
for (const pk of need) W[pk] = await getJson(`/api/v1/game/${pk}/winProbability`)
const ev = (e) => {
  const t = (e.result.event || '').toLowerCase(), rbi = e.result.rbi || 0
  if (t.includes('home run')) return rbi <= 1 ? 'homered' : `hit a ${rbi}-run homer`
  if (t.includes('strikeout')) return 'struck out'
  if (t === 'single') return rbi ? `singled and drove in ${rbi}` : 'singled'
  if (t === 'double') return rbi ? `doubled and drove in ${rbi}` : 'doubled'
  if (t === 'triple') return rbi ? `tripled and drove in ${rbi}` : 'tripled'
  if (t.includes('double play') || t.includes('dp')) return 'hit into a double play'
  if (t.includes('sac fly')) return 'hit a sacrifice fly'
  if (t.includes('walk')) return rbi ? 'walked in a run' : 'walked'
  if (t.includes('groundout') || t.includes('ground out')) return 'grounded out'
  if (t.includes('flyout') || t.includes('fly out')) return 'flew out'
  if (t.includes('lineout') || t.includes('line out')) return 'lined out'
  if (t.includes('pop out') || t.includes('popout')) return 'popped out'
  if (t.includes('error')) return 'reached on an error'
  if (t.includes('fielders choice') || t.includes("fielder's choice")) return "reached on a fielder's choice"
  if (t.includes('hit by pitch')) return 'was hit by a pitch'
  return t || 'batted'
}
const last = (n) => String(n).split(' ').slice(-1)[0].replace(/^(Jr\.|Sr\.)$/, '')
const lastName = (n) => { const p = String(n).split(' '); return /^(Jr\.|Sr\.|II|III)$/.test(p.at(-1)) ? p.slice(-2).join(' ') : p.at(-1) }
const label = (g) => {
  if (g.away.id === MIL || g.home.id === MIL) {
    const home = g.home.id === MIL, ms = home ? g.hS : g.aS, os = home ? g.aS : g.hS
    return `${ms > os ? 'W' : 'L'} ${ms}-${os} ${home ? 'vs' : 'at'} ${(home ? g.away : g.home).name}`
  }
  return `${g.away.name} ${g.aS}, ${g.home.name} ${g.hS}`
}
const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const dl = (d) => `${mon[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`
const SCORED = new Set(JSON.parse(readFileSync(process.argv[3], 'utf8')).map((x) => String(x.id)))
const detail = (r, rank) => {
  const e = W[r.pk][r.i], g = G[r.pk]
  return { rank, li: r.li, date: dl(g.date), game: label(g), when: `${r.top ? 'Top' : 'Bottom'} ${r.inn}`, who: `${lastName(e.matchup.batter.fullName)} vs ${lastName(e.matchup.pitcher.fullName)}`, what: ev(e), post: g.type !== 'R', scored: SCORED.has(String(r.pk)) }
}
const list = (arr, n) => { let rank = 0, prev = null; return arr.slice(0, n).map((r, k) => { if (r.li !== prev) { rank = k + 1; prev = r.li } return detail(r, rank) }) }
const out = { total: rows.length, ninthTotal: ninth.length, milBatTotal: bat.length, milPitTotal: pit.length, top50: list(upTo(desc, 50), 99999), batTop25: list(upTo(bat, 25), 99999), pitTop25: list(upTo(pit, 25), 99999), batTies25: 0, pitTies25: 0 }
// WS games: ranks of their tensest play and biggest play, scare
const ws = [[849805, 'G1', true], [849802, 'G2', true], [849804, 'G3', false], [849803, 'G4', false], [849799, 'G5', false]]
out.ws = []
for (const [pk, label2, brewersHome] of ws) {
  const w = W[pk] || await getJson(`/api/v1/game/${pk}/winProbability`)
  const li = w.map((e) => e.leverageIndex ?? 0)
  const ti = li.indexOf(Math.max(...li)); const e = w[ti]
  const r = rows.find((x) => x.pk === pk && x.i === ti)
  const wpa = w.map((x) => Math.abs(x.homeTeamWinProbabilityAdded ?? 0)); const bi = wpa.indexOf(Math.max(...wpa)); const be = w[bi]
  const side = r.milBat ? 'bat' : 'pit'
  out.ws.push({ label: label2, tenseIdx: ti, li: li[ti], leagueRank: rankIn(desc, li[ti]), sideRank: rankIn(side === 'bat' ? bat : pit, li[ti]), side, ninthRank: r.inn === 9 ? rankIn(ninth, li[ti]) : null, who: `${lastName(e.matchup.batter.fullName)} vs ${lastName(e.matchup.pitcher.fullName)}`, what: ev(e), when: `${r.top ? 'top' : 'bottom'} of the ${r.inn}`,
    bigIdx: bi, bigPts: Math.round(wpa[bi]), bigWho: `${lastName(be.matchup.batter.fullName)} vs ${lastName(be.matchup.pitcher.fullName)}`, bigWhat: ev(be), bigWhen: `${be.about.isTopInning ? 'top' : 'bottom'} of the ${be.about.inning}`, bigRbi: be.result.rbi })
}
writeFileSync(D + 'tensest.json', JSON.stringify(out, null, 1))
console.log('written', out.top50.length, out.batTop25.length, out.pitTop25.length)
