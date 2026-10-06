// The pure half of scripts/gen-family-ties.mjs (ADR-0100): Retrosheet's
// relatives.csv, joined to MLBAM ids, as one shard per `shardKey100(mlbamId)`. It
// lives here because a generator file runs on import (scripts/CLAUDE.md).
//
// THE DIRECTION, CHECKED (2026-10-06). A row `id1,relation,id2` reads "id1 is the
// <relation> of id2": Bobby Bonds, Father, Barry Bonds. Across the whole file the
// older man is id1 on every dated Father (324 of 324), Grandfather (35 of 35),
// Great Uncle (9 of 9) and Father-in-Law (18 of 18) row, and on 147 of 148 Uncle rows.
// ONE LABEL IS BACKWARDS: all four "Great Grandson" rows also have the older man as
// id1 (Ralph Houk, Samuel Gaviglio), so that label names id2. ALIAS reads it as
// "Great Grandfather".
//
// A shard entry says what the OTHER man is to the shard's player, so row
// (id1 R id2) files `{relation: R, personId: id1}` under id2 and
// `{relation: INVERSE[R], personId: id2}` under id1.
//
// A relative with no MLBAM match keeps his name and a null id. A player with no
// MLBAM match has no shard to live in, so his own entries are not written.
// No clock: same input, same bytes. A label this table lacks fails the run.
import { shardKey100 } from '../../../src/lib/shardKey.js'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from './credits.mjs'

const SAME = ['Brother', 'Cousin', 'Brother-in-Law', 'Half Brother', 'Related To', 'Step Brother']
const INVERSE = {
  ...Object.fromEntries(SAME.map((label) => [label, label])),
  Father: 'Son',
  Grandfather: 'Grandson',
  'Great Grandfather': 'Great Grandson',
  Uncle: 'Nephew',
  'Great Uncle': 'Great Nephew',
  'Father-in-Law': 'Son-in-Law',
  'Step Father': 'Step Son',
  'Uncle and Stepfather': 'Nephew and Stepson',
}
const ALIAS = { 'Great Grandson': 'Great Grandfather' }

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// bio:           biofile0.csv rows. Only `id`, `usename` and `lastname` are read.
// relatives:     relatives.csv rows, { id1, relation, id2 }.
// retroToMlbam:  Map from retro-bridge.mjs.
// -> { shards: [[key, { credit, players }]], report }
export function buildFamilyTies({ bio, relatives, retroToMlbam }) {
  const nameOf = new Map(bio.map((b) => [b.id, `${b.usename} ${b.lastname}`.trim()]))
  const players = new Map() // mlbam -> entries
  const report = { relativesRead: 0, bothBridged: 0, oneBridged: 0, neitherBridged: 0, entries: 0, players: 0 }

  const file = (owner, relation, other) => {
    const mlbam = retroToMlbam.get(owner)
    if (!mlbam) return
    const otherId = retroToMlbam.get(other)
    const list = players.get(mlbam) ?? players.set(mlbam, []).get(mlbam)
    list.push({ relation, personId: otherId ? Number(otherId) : null, name: nameOf.get(other) })
  }

  for (const { id1, relation: label, id2 } of relatives) {
    const relation = ALIAS[label] ?? label
    if (!INVERSE[relation]) throw new Error(`unknown relation "${label}" (${id1} ${id2})`)
    for (const id of [id1, id2]) {
      if (!nameOf.has(id)) throw new Error(`relatives.csv names ${id}, which biofile0.csv lacks`)
    }
    report.relativesRead += 1
    const bridged = Number(retroToMlbam.has(id1)) + Number(retroToMlbam.has(id2))
    report[['neitherBridged', 'oneBridged', 'bothBridged'][bridged]] += 1
    file(id2, relation, id1)
    file(id1, INVERSE[relation], id2)
  }
  report.players = players.size

  const byShard = new Map()
  for (let [mlbam, list] of players) {
    list.sort((a, b) => byText(a.relation, b.relation) || byText(a.name, b.name) || (a.personId ?? 0) - (b.personId ?? 0))
    // A row the file lists twice must not print twice.
    list = list.filter((e, i) => i === 0 || JSON.stringify(e) !== JSON.stringify(list[i - 1]))
    const key = shardKey100(mlbam)
    const body = byShard.get(key) ?? byShard.set(key, { credit: [RETROSHEET_CREDIT, CHADWICK_JOIN], players: {} }).get(key)
    body.players[mlbam] = list
    report.entries += list.length
  }
  return { shards: [...byShard].sort(([a], [b]) => byText(a, b)), report }
}
