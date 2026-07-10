// Regenerates public/data/umpires.json — for every umpire who has worked an
// MLB game this season, the list of games he's worked and which base he had
// (src/api/umpires.js just reads this file; the umpire detail page renders it).
// Keyed by MLB Stats API personId (umpires get real personIds, same id space
// as players).
//
// This runs on a cron via .github/workflows/update-umpires.yml, NOT at request
// time. Building a season-wide, umpire-indexed view isn't something a page load
// can do cheaply: there's no "games by umpire" endpoint, so the only way to get
// it is a full-season schedule scan (one call — `/api/v1/schedule` accepts a
// season + gameType filter and returns EVERY game with its officials in one
// shot via `hydrate=officials,team`) followed by re-indexing thousands of
// (game, official) rows by umpire id client-side. That reshaping is cheap once
// fetched, but the source payload (the whole season's schedule) is too big to
// pull down on every umpire-page visit, so a nightly job does it once and
// writes a small static file. Mirrors scripts/gen-war.mjs's build-time-fetch
// pattern (see docs/data-enrichment.md §5).
//
// MLB-only for now (sportId 1) — like war.js, MiLB rows would need the same
// scan repeated per level and MiLB officials data is thinner/less reliable.
// Game dates/assignments carry no score, so the file is spoiler-free.
// Run by hand: node scripts/gen-umpires.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { teamAbbr } from '../src/lib/teams.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'umpires.json')
const BASE = 'https://statsapi.mlb.com'

const UMP_LABELS = {
  'Home Plate': 'HP',
  'First Base': '1B',
  'Second Base': '2B',
  'Third Base': '3B',
}

const currentSeason = () => new Date().getUTCFullYear()

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

const season = currentSeason()
const data = await getJson(
  `/api/v1/schedule?sportId=1&season=${season}&gameType=R&hydrate=officials,team`,
)

const umpires = new Map()
let gamesSeen = 0
for (const d of data.dates ?? []) {
  for (const g of d.games ?? []) {
    const state = g.status?.abstractGameState
    if (state !== 'Final') continue // only games that actually happened
    const officials = g.officials ?? []
    if (!officials.length) continue
    gamesSeen++
    const away = g.teams?.away?.team
    const home = g.teams?.home?.team
    const game = {
      gamePk: g.gamePk,
      date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
      gameNumber: g.gameNumber ?? 1,
      awayId: away?.id ?? null,
      awayAbbr: teamAbbr(away),
      homeId: home?.id ?? null,
      homeAbbr: teamAbbr(home),
      venueId: g.venue?.id ?? null,
      venueName: g.venue?.name ?? '',
    }
    for (const o of officials) {
      const id = o.official?.id
      const name = o.official?.fullName
      const role = UMP_LABELS[o.officialType] ?? o.officialType
      if (!id || !role) continue
      if (!umpires.has(id)) umpires.set(id, { id, name, games: [] })
      umpires.get(id).games.push({ ...game, role })
    }
  }
}

const result = {}
for (const [id, u] of umpires) {
  u.games.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  result[id] = u
}

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ generatedAt: new Date().toISOString(), season, umpires: result }),
)
console.log(`wrote ${out} (${umpires.size} umpires across ${gamesSeen} games)`)
