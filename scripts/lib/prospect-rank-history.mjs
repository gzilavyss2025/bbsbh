// The pure half of scripts/gen-prospect-rank-history.mjs (issue #1111): turns
// the research pull in .scratch/top-prospects-history/ into the one static file
// the player page reads. It lives here, not in the generator, because a
// generator RUNS on import and so a helper inside one can never be tested
// (scripts/CLAUDE.md).
//
// THE SHAPE, public/data/prospect-rank-history.json:
//
//   {
//     sources: { [sourceId]: { label, seasons: [first, last], credit: [line, …] } },
//     depths:  { [season]: how many players that season's list ranked },
//     players: { [mlbId]: [[season, rank, sourceId], …] },   // season order
//   }
//
// THREE RULES THE SHAPE ENFORCES.
//
//   Every row keeps its source. Baseball America (2005-2008) and MLB Pipeline
//   (2009-2024) are different publications by different scouts. seasons.json
//   keeps them apart on purpose, so this file does too, and a row is never a
//   bare [season, rank].
//
//   No clock. The file has no generatedAt or fetchedAt: frozen history that
//   changes once a year must not dirty a diff on a timestamp alone (the
//   contracts shards did, all 100 files). Same input, same bytes. The output
//   is sorted, so the order of the input does not matter either.
//
//   Removing a source is one argument. `includeSources` decides which sources
//   ship. Leave `baseball-america` out and its rows, its seasons, its depths
//   and its credit lines (the Chadwick join credit included) all go, and
//   nothing else changes. No page code names either source: the page reads
//   labels and credits from this file.

// The credit each source needs, written once. `credit` is a function of the
// seasons that actually ship, so the years it prints are always the years the
// file holds. A source with no entry here cannot ship: an uncredited row is a
// bug, not a default.
const CHADWICK_JOIN =
  'Player ids matched through the Chadwick Bureau register (Open Data Commons Attribution License 1.0).'

const SOURCE_TABLE = {
  'baseball-america': {
    label: 'Baseball America',
    credit: (first, last) => [`Baseball America preseason top 100, ${span(first, last)}.`, CHADWICK_JOIN],
  },
  'mlb-pipeline': {
    label: 'MLB Pipeline',
    credit: (first, last) => [`MLB Pipeline top prospects, ${span(first, last)}.`],
  },
}

function span(first, last) {
  return first === last ? String(first) : `${first}–${last}`
}

// rows:            the research pull's rows.json, [{ season, rank, mlbId, source }].
// seasons:         its seasons.json. Only `season`, `status` and `depth` are read.
// includeSources:  the sources that ship. The generator owns this list.
export function buildProspectRankHistory({ rows, seasons, includeSources }) {
  const wanted = new Set(includeSources)
  for (const source of wanted) {
    if (!SOURCE_TABLE[source]) throw new Error(`no credit is written for source "${source}"; add one before it can ship`)
  }

  const depthOf = new Map()
  for (const s of seasons) if (s.status === 'ok') depthOf.set(s.season, s.depth)

  const kept = rows.filter((row) => wanted.has(row.source))
  const players = new Map()
  const seasonsOfSource = new Map()
  for (const row of kept) {
    const depth = depthOf.get(row.season)
    if (depth == null) throw new Error(`row for ${row.mlbId} is in season ${row.season}, which the pull metadata does not list as ok`)
    if (!Number.isInteger(row.rank) || row.rank < 1 || row.rank > depth) {
      throw new Error(`rank ${row.rank} for ${row.mlbId} in ${row.season} is outside that season's depth of ${depth}`)
    }
    if (!SOURCE_TABLE[row.source]) throw new Error(`row for ${row.mlbId} has a source with no credit: ${row.source}`)
    const list = players.get(row.mlbId) ?? []
    if (list.some(([season]) => season === row.season)) {
      throw new Error(`duplicate row: player ${row.mlbId} appears twice in ${row.season}`)
    }
    list.push([row.season, row.rank, row.source])
    players.set(row.mlbId, list)
    const seen = seasonsOfSource.get(row.source) ?? new Set()
    seen.add(row.season)
    seasonsOfSource.set(row.source, seen)
  }

  // Sources, oldest first, from the seasons their kept rows actually cover.
  const sources = {}
  const ordered = [...seasonsOfSource].map(([id, set]) => [id, Math.min(...set), Math.max(...set)])
  ordered.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
  for (const [id, first, last] of ordered) {
    sources[id] = { label: SOURCE_TABLE[id].label, seasons: [first, last], credit: SOURCE_TABLE[id].credit(first, last) }
  }

  // Depths for the seasons that ship. Integer keys, so JS orders them itself.
  const shipped = new Set(kept.map((row) => row.season))
  const depths = {}
  for (const season of [...shipped].sort((a, b) => a - b)) depths[season] = depthOf.get(season)

  const out = {}
  for (const id of [...players.keys()].sort((a, b) => a - b)) {
    out[id] = players.get(id).sort((a, b) => a[0] - b[0])
  }
  return { sources, depths, players: out }
}
