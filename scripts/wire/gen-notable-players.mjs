#!/usr/bin/env node
// gen-notable-players: which players make a roster move a full card on the
// winter wire, rather than a one-line entry (src/lib/transactions/major.js).
//
// Two lists, both plain player ids:
//   star     4+ WAR in any of the last three seasons, or an All-Star or award
//            winner in the last five. A star's move is a card whatever it is.
//   notable  300+ career MLB games, 150+ career pitching appearances, or a
//            top-100 prospect. A notable player's move is a card only when the
//            move itself is news (a trade, an MLB signing, a claim, a release,
//            a DFA, a retirement).
//
// Precomputed nightly rather than asked per page so the phone never re-batches
// career stats on every "10 more", and so a lookup that fails is logged here
// instead of quietly demoting a star to a line. A player missing from both
// lists reads as a line (Gary, 2026-11-02).
//
// WAR, honors and prospects come from this repo's own files; only career games
// are fetched: every player who appeared in MLB in the last three seasons, in
// batches of 100.
//
// Measured on four 2026 weeks before it was built: 16-20% of moves become
// cards.
//
// Usage: node scripts/wire/gen-notable-players.mjs
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { getJson, getPeople } from '../lib/statsapi.mjs'
import { fetchSeasonInPlay } from '../lib/time/season-in-play.mjs'

const DATA = new URL('../../public/data/', import.meta.url)
const OUT = new URL('notable-players.json', DATA)
const read = async (name) => JSON.parse(await readFile(new URL(name, DATA), 'utf8'))

const STAR_WAR = 4
const WAR_SEASONS = 3
const HONOR_SEASONS = 5
const CAREER_GAMES = 300
const CAREER_PITCHED = 150
const PROSPECT_RANK = 100
const BATCH = 100

// Every playerId anywhere under a value, for the nested roster/award shapes.
function idsIn(value, out) {
  JSON.stringify(value, (key, v) => {
    if (key === 'playerId' && v) out.add(v)
    return v
  })
}

async function main() {
  const season = await fetchSeasonInPlay()
  const current = await read('war.json')
  const firstWar = season - WAR_SEASONS + 1
  const firstHonor = season - HONOR_SEASONS + 1

  // WAR per player per season: batting + pitching, history shards + this season.
  const war = new Map()
  const add = (id, yr, v) => {
    if (yr < firstWar || typeof v !== 'number') return
    const row = war.get(+id) ?? {}
    row[yr] = (row[yr] ?? 0) + v
    war.set(+id, row)
  }
  for (const file of await readdir(new URL('war-history/', DATA))) {
    const shard = await read(`war-history/${file}`)
    for (const group of ['bat', 'pit']) {
      for (const [id, bySeason] of Object.entries(shard[group] ?? {})) {
        for (const [yr, v] of Object.entries(bySeason)) add(id, +yr, v)
      }
    }
  }
  for (const group of ['bat', 'pit']) {
    for (const [id, v] of Object.entries(current[group] ?? {})) add(id, current.season, v)
  }

  const star = new Set()
  for (const [id, row] of war) if (Object.values(row).some((v) => v >= STAR_WAR)) star.add(id)
  const allStars = await read('all-star-rosters.json')
  for (const [yr, roster] of Object.entries(allStars.rosters ?? {})) if (+yr >= firstHonor) idsIn(roster, star)
  const awards = await read('awards-history.json')
  for (const family of awards.families ?? []) {
    for (const [yr, rows] of Object.entries(family.years ?? {})) if (+yr >= firstHonor) idsIn(rows, star)
  }

  const notable = new Set()
  const prospects = await read('top-prospects.json')
  for (const p of prospects.players ?? []) if (p.rank <= PROSPECT_RANK && p.playerId) notable.add(p.playerId)

  // Career games for everyone who played in MLB in the last three seasons.
  const pool = new Set()
  for (let yr = season - 2; yr <= season; yr++) {
    const { people = [] } = await getJson(`/api/v1/sports/1/players?season=${yr}`)
    for (const p of people) pool.add(p.id)
  }
  const ids = [...pool]
  let answered = 0
  const hydrate = 'stats(group=[hitting,pitching],type=[career],sportId=1)'
  for (const p of await getPeople(ids, { hydrate, size: BATCH })) {
    answered += 1
    let games = 0
    let pitched = 0
    for (const s of p.stats ?? []) {
      const stat = s.splits?.[0]?.stat ?? {}
      if (s.group?.displayName === 'hitting') games = stat.gamesPlayed ?? 0
      if (s.group?.displayName === 'pitching') pitched = stat.gamesPitched ?? stat.gamesPlayed ?? 0
    }
    if (games >= CAREER_GAMES || pitched >= CAREER_PITCHED) notable.add(p.id)
  }
  if (answered < ids.length) console.warn(`gen-notable-players: ${ids.length - answered} of ${ids.length} players came back without a record`)
  if (star.size === 0 || notable.size === 0) throw new Error('gen-notable-players: an empty list; refusing to write')

  const sorted = (set) => [...set].sort((a, b) => a - b)
  const out = { generatedAt: new Date().toISOString(), season, star: sorted(star), notable: sorted(notable) }
  await writeFile(OUT, `${JSON.stringify(out)}\n`)
  console.log(`gen-notable-players: ${star.size} stars, ${notable.size} notable, from ${ids.length} players (${season})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
