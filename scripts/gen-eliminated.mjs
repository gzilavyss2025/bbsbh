// Regenerates public/data/eliminated.json — for every MLB club and regular season,
// the date it was mathematically eliminated from the postseason and each game it
// played from then on (the /eliminated page). The rule lives in
// scripts/lib/elimination/rule.mjs and is tested in test/elimination-rule.test.js.
//
// HOW. One schedule call per season gives every Final regular-season game. For each
// game date from August 1 on (2020: August 25), the standings through the PRIOR day
// say which clubs began that day already out; one call per league serves all 15
// clubs. A club's elimination date is the first such date. The run stops if any club
// is already out on the first date read, so a too-late start cannot pass silently.
//
// WHAT IT STORES: per club-season the games played, the elimination date, and each
// game from that date on: date, opponent, home/away and the record entering it.
// Records and dates only, no scores (ADR-0034).
//
// HAND-RUN. A finished season never changes, so re-run only to add a season:
//   node scripts/gen-eliminated.mjs                  # 1995 through the last season
//   node scripts/gen-eliminated.mjs --to=2026
import { join } from 'node:path'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { parseArgs, strOpt } from './lib/args.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { eliminatedIds, isPlayed, FIRST_SEASON } from './lib/elimination/rule.mjs'

const args = parseArgs(process.argv.slice(2))
const FIRST = Number(strOpt(args, 'from') ?? FIRST_SEASON)
const LAST = Number(strOpt(args, 'to') ?? new Date().getFullYear() - (new Date().getMonth() < 10 ? 1 : 0))
const OUT = join(import.meta.dirname, '..', 'public', 'data', 'eliminated.json')

const prevDay = (d) => new Date(Date.parse(d + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10)

async function season(y) {
  const sched = await getJson(`/api/v1/schedule?sportId=1&season=${y}&gameType=R`)
  const byPk = new Map()
  for (const d of sched.dates) {
    for (const g of d.games) if (isPlayed(g)) byPk.set(g.gamePk, { date: g.officialDate ?? d.date, g })
  }
  const games = new Map() // teamId -> [{date, oppId, home}]
  for (const { date, g } of byPk.values()) {
    for (const [side, other] of [['home', 'away'], ['away', 'home']]) {
      const id = g.teams[side].team.id
      if (!games.has(id)) games.set(id, [])
      games.get(id).push({ date, oppId: g.teams[other].team.id, home: side === 'home' })
    }
  }
  const start = y === 2020 ? '2020-08-25' : `${y}-08-01`
  const dates = [...new Set([...byPk.values()].map((x) => x.date))].filter((d) => d >= start).sort()
  const days = await mapConcurrent(dates, 8, async (date) => {
    const out = new Set()
    const record = new Map()
    for (const lg of [103, 104]) {
      const s = await getJson(`/api/v1/standings?leagueId=${lg}&season=${y}&date=${prevDay(date)}&standingsTypes=regularSeason`)
      const recs = s.records.flatMap((r) => r.teamRecords)
      for (const id of eliminatedIds(recs, y)) out.add(id)
      for (const t of recs) record.set(t.team.id, `${t.wins}-${t.losses}`)
    }
    return { date, out, record }
  }, { strict: true })
  // A club already out on the first date read was out before it: the sweep started too late.
  if (days[0]?.out.size) throw new Error(`${y}: clubs already out on ${days[0].date}; start the sweep earlier`)
  const clubs = {}
  for (const [id, list] of games) {
    const outDay = days.find((d) => d.out.has(id))
    const after = outDay ? list.filter((g) => g.date >= outDay.date).sort((a, b) => (a.date < b.date ? -1 : 1)) : []
    clubs[id] = {
      games: list.length,
      out: outDay?.date ?? null,
      rows: after.map((g) => ({ ...g, entering: days.find((d) => d.date === g.date)?.record.get(id) ?? null })),
    }
  }
  console.log(`${y}: ${byPk.size} games, ${dates.length} dates checked`)
  return clubs
}

const seasons = {}
for (let y = FIRST; y <= LAST; y++) seasons[y] = await season(y)
await writeJsonAtomic(OUT, { generatedAt: new Date().toISOString(), first: FIRST, last: LAST, seasons })
console.log(`wrote ${OUT}`)
