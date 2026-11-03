// Probe for the "nuggets" store in .scratch/anchor-callouts/spec.md.
// Question: can game logs give the exact day each player first met a threshold, so that
// "how many had crossed by date D" is just a count of nuggets up to D? (A nugget records the
// day a player crossed a threshold.)
//
//   node .scratch/anchor-callouts/nuggets.probe.mjs 2026
//
// Prints, per threshold, the crossers in date order and whether the final count matches the
// season-totals count (cohorts.probe.mjs). Source: statsapi.mlb.com, checked 2026-11-03.
import { getJson } from '../../scripts/lib/statsapi.mjs'

const season = process.argv[2] || String(new Date().getFullYear())

// A threshold is data: every condition must hold. `stat` is a gameLog counting field.
const thresholds = [
  { id: 'rbi100', group: 'hitting', label: '100 RBI', all: [{ stat: 'rbi', min: 100 }] },
  { id: 'rbi100-r100', group: 'hitting', label: '100 runs and 100 RBI', all: [{ stat: 'rbi', min: 100 }, { stat: 'runs', min: 100 }] },
  { id: 'hr20-sb20', group: 'hitting', label: '20 HR and 20 SB', all: [{ stat: 'homeRuns', min: 20 }, { stat: 'stolenBases', min: 20 }] },
  { id: 'sv30', group: 'pitching', label: '30 saves', all: [{ stat: 'saves', min: 30 }] },
  { id: 'sho1', group: 'pitching', label: 'a shutout', all: [{ stat: 'shutouts', min: 1 }] },
  { id: 'k200', group: 'pitching', label: '200 strikeouts', all: [{ stat: 'strikeOuts', min: 200 }] },
]

const num = (x) => (Number.isFinite(parseFloat(x)) ? parseFloat(x) : 0)

// Step 1: who has met each threshold in the season totals (the cheap first filter).
const base = `/api/v1/stats?stats=season&season=${season}&sportIds=1&playerPool=all&limit=2000`
const totals = {}
for (const group of ['hitting', 'pitching']) {
  const body = await getJson(`${base}&group=${group}`)
  const by = new Map()
  for (const s of body.stats[0].splits) {
    const p = by.get(s.player.id) || { id: s.player.id, name: s.player.fullName, sum: {} }
    for (const [k, v] of Object.entries(s.stat)) p.sum[k] = (p.sum[k] || 0) + num(v)
    by.set(s.player.id, p)
  }
  totals[group] = [...by.values()]
}

// Step 2: for each member, walk the game log and find the first date every condition holds.
async function crossingDate(player, t) {
  const log = await getJson(`/api/v1/people/${player.id}/stats?stats=gameLog&group=${t.group}&season=${season}&gameType=R`)
  const games = (log.stats[0]?.splits || []).slice().sort((a, b) => a.date.localeCompare(b.date))
  const run = Object.fromEntries(t.all.map((c) => [c.stat, 0]))
  for (const g of games) {
    for (const c of t.all) run[c.stat] += num(g.stat[c.stat])
    if (t.all.every((c) => run[c.stat] >= c.min)) return g.date
  }
  return null
}

for (const t of thresholds) {
  const members = totals[t.group].filter((p) => t.all.every((c) => (p.sum[c.stat] || 0) >= c.min))
  const found = []
  for (const p of members) found.push({ name: p.name, date: await crossingDate(p, t) })
  found.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const missing = found.filter((f) => !f.date).length
  console.log(`\n${t.id} (${t.label}): ${members.length} by season totals, ${found.length - missing} dated, ${missing} undated`)
  found.forEach((f, i) => console.log(`  ${String(i + 1).padStart(2)}. ${f.date}  ${f.name}`))
}
