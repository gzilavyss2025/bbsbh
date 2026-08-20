// Dumps the current 48-hour league-wide feed, fully shaped, so the design
// artboards are laid out over REAL stories rather than invented ones.
// Reads probe-card-fetch.mjs's cached pull and probe-card-shape.mjs's cached
// people table, so it costs no fetches.
//
// Run: node .scratch/home-transactions/dump-48h.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { groupLeagueWide } from '../../src/api/transactions/league.js'
import MLB_COLORS from '../../src/lib/data/mlb-team-colors.json' with { type: 'json' }
import AFFILIATES from '../../public/data/affiliates.json' with { type: 'json' }

const here = dirname(fileURLToPath(import.meta.url))
const { today, wide } = JSON.parse(readFileSync(join(here, 'card-fetch-window.json'), 'utf8'))
const peopleCache = JSON.parse(readFileSync(join(here, 'card-people.json'), 'utf8'))
const people = peopleCache.twoPass
if (!people) {
  console.error('run probe-card-shape.mjs first — it caches the people table')
  process.exit(1)
}

const mlbTeamIds = Object.keys(MLB_COLORS).map(Number)
const affilToOrg = new Map()
for (const [orgId, clubs] of Object.entries(AFFILIATES.byOrgId ?? {})) {
  for (const c of clubs) if (c.id != null) affilToOrg.set(c.id, Number(orgId))
}

const dayShift = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

const days = groupLeagueWide(wide, {
  mlbTeamIds,
  affilToOrg,
  positions: people.positions,
  debutedIds: new Set(people.debuted),
}).filter((d) => d.date >= dayShift(today, -1))

const clubs = {}
for (const [id, c] of Object.entries(MLB_COLORS)) {
  clubs[id] = { name: c.name, primary: c.primary, secondary: c.secondary, accent: c.accent }
}

const out = { today, days, clubs }
writeFileSync(join(here, 'window-48h.json'), JSON.stringify(out, null, 2))
const n = days.reduce((sum, d) => sum + d.stories.length, 0)
console.log(`wrote window-48h.json — ${days.length} days, ${n} stories`)
for (const d of days) console.log(`  ${d.date}  ${d.stories.length}`)
if (existsSync(join(here, 'window-48h.json'))) {
  const sample = days[0].stories[0]
  console.log('\nfirst story shape:')
  console.log(JSON.stringify(sample, null, 2))
}
