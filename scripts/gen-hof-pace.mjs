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
// season repeats the one before it). Hitters: [h, hr, war]. Pitchers: [w, so, outs, sv, war]
// (war: cumulative, tenths; null for a career that began before 1901)
// (outs = innings x 3, so an IP of 200.1 stays exact). Only fields every era has.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { paceLine } from './lib/hof/pace.mjs'
import { getJson, getPeople } from './lib/statsapi.mjs'
import { shardKey100 } from '../src/lib/shardKey.js'

const data = join(import.meta.dirname, '..', 'public', 'data')
const out = join(data, 'hof-pace.json')
// Season WAR from the committed war-history/ shards (1901 on, #2765): no WAR request here.
const shards = new Map()
const warFor = (id, pitcher) => {
  const key = shardKey100(id)
  if (!shards.has(key)) shards.set(key, JSON.parse(readFileSync(join(data, 'war-history', `${key}.json`), 'utf8')))
  return shards.get(key)[pitcher ? 'pit' : 'bat']?.[id] ?? {}
}
const { awards } = await getJson('/api/v1/awards/MLBHOF/recipients')
const pool = new Map()
for (const a of awards) {
  const p = a.player
  if (p?.id && p.primaryPosition?.abbreviation !== 'X') pool.set(p.id, p)
}
const ids = [...pool.keys()]

const players = []
const hydrate = 'stats(group=[hitting,pitching],type=[yearByYear],sportId=1)'
for (const person of await getPeople(ids, { hydrate, size: 50 })) {
  const pitcher = pool.get(person.id).primaryPosition?.abbreviation === 'P'
  const group = pitcher ? 'pitching' : 'hitting'
  const splits = person.stats?.find((s) => s.group?.displayName === group)?.splits ?? []
  const line = paceLine(splits, pitcher, warFor(person.id, pitcher))
  if (line) players.push({ id: person.id, name: person.fullName, pitcher, ...line })
}

// A short run (a failed batch, a changed shape) must not replace the committed file.
if (players.length < 250) throw new Error(`only ${players.length} players, expected about 283: not writing`)
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), players }))
console.log(`${players.length} players (${players.filter((p) => !p.pitcher).length} hitters) → ${out}`)
