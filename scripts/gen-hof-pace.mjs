// Regenerates public/data/hof-pace.json — every Hall of Fame player's CUMULATIVE
// career line by age, for the player page's "Hall of Fame pace" card
// (.scratch/hof-pace/spec.md, #1857). HAND-RUN, once a year after the induction
// (late July): node scripts/gen-hof-pace.mjs
//
// Pool: GET /awards/MLBHOF/recipients, minus position "X" (managers, executives,
// umpires, pioneers) and minus anyone with no MLB (sportId 1) season line.
// Season lines: people?hydrate=stats(type=[yearByYear]), 50 ids a request.
// Age is `stat.age` (MLB's June 30 rule); Negro League seasons come back as MLB.
// A traded season counts once: the API adds a team-less roll-up row with
// numTeams > 1, and that row is used instead of the stints.
//
// Shape: { generatedAt, players: [{ id, name, pitcher, first, rows }] }.
// `rows[i]` is the cumulative line at age `first + i`, dense (an age with no MLB
// season repeats the one before it). Hitters: [h, hr]. Pitchers: [w, so, outs, sv]
// (outs = innings x 3, so an IP of 200.1 stays exact). Only fields every era has.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from './lib/statsapi.mjs'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'hof-pace.json')
const n = (v) => Number(v) || 0
const outs = (ip) => {
  const [w, f = 0] = String(ip ?? 0).split('.')
  return n(w) * 3 + n(f)
}

const { awards } = await getJson('/api/v1/awards/MLBHOF/recipients')
const pool = new Map()
for (const a of awards) {
  const p = a.player
  if (p?.id && p.primaryPosition?.abbreviation !== 'X') pool.set(p.id, p)
}
const ids = [...pool.keys()]

const players = []
for (let i = 0; i < ids.length; i += 50) {
  const batch = ids.slice(i, i + 50).join(',')
  const { people } = await getJson(
    `/api/v1/people?personIds=${batch}&hydrate=stats(group=[hitting,pitching],type=[yearByYear],sportId=1)`,
  )
  for (const person of people) {
    const pitcher = pool.get(person.id).primaryPosition?.abbreviation === 'P'
    const group = pitcher ? 'pitching' : 'hitting'
    const splits = person.stats?.find((s) => s.group?.displayName === group)?.splits ?? []
    // age -> one row: the multi-team total if present, else the single row
    const byAge = new Map()
    for (const s of splits) {
      if (s.sport?.id !== 1 || s.gameType !== 'R' || s.stat?.age == null) continue
      const cur = byAge.get(s.season)
      if (!cur || n(s.numTeams) > n(cur.numTeams)) byAge.set(s.season, s)
    }
    if (!byAge.size) continue
    const seasons = new Map([...byAge.values()].map((s) => [s.stat.age, s.stat]))
    const ages = [...seasons.keys()]
    const first = Math.min(...ages)
    const rows = []
    let cum = pitcher ? [0, 0, 0, 0] : [0, 0]
    for (let age = first; age <= Math.max(...ages); age++) {
      const st = seasons.get(age)
      if (st) {
        cum = pitcher
          ? [cum[0] + n(st.wins), cum[1] + n(st.strikeOuts), cum[2] + outs(st.inningsPitched), cum[3] + n(st.saves)]
          : [cum[0] + n(st.hits), cum[1] + n(st.homeRuns)]
      }
      rows.push(cum)
    }
    players.push({ id: person.id, name: person.fullName, pitcher, first, rows })
  }
}

writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), players }))
console.log(`${players.length} players (${players.filter((p) => !p.pitcher).length} hitters) → ${out}`)
