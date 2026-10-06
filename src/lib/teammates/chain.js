// Six degrees of teammates: a shortest chain of teammates between two players.
// Pure. `data` is what loadTeamSeasons() returns (src/api/teamSeasons.js):
// `players` holds MLBAM ids, and each `teamSeasons` row is [key, label, [index into players]].
//
// Breadth-first over the bipartite graph (player -> team-season -> player).
// Returns [player, team-season label, player, ...], or null when no chain of
// `maxLinks` links or fewer exists. The same player twice is [player], zero links.
const byPlayer = new WeakMap()

// player id -> the rows (team-seasons) he played in, built once per data object.
function rowsOf(data) {
  let map = byPlayer.get(data)
  if (!map) {
    map = new Map()
    for (const row of data.teamSeasons) {
      for (const i of row[2]) {
        const id = data.players[i]
        if (!map.has(id)) map.set(id, [])
        map.get(id).push(row)
      }
    }
    byPlayer.set(data, map)
  }
  return map
}

export function findChain(data, fromId, toId, maxLinks = 10) {
  const rows = rowsOf(data)
  if (!rows.has(fromId) || !rows.has(toId)) return null
  if (fromId === toId) return [fromId]
  // how each player was first reached: [previous player, team-season label]
  const via = new Map([[fromId, null]])
  const seenRows = new Set()
  let frontier = [fromId]
  for (let links = 1; links <= maxLinks && frontier.length; links++) {
    const next = []
    for (const id of frontier) {
      for (const row of rows.get(id)) {
        if (seenRows.has(row)) continue
        seenRows.add(row)
        for (const i of row[2]) {
          const mate = data.players[i]
          if (via.has(mate)) continue
          via.set(mate, [id, row[1]])
          if (mate === toId) {
            const chain = [toId]
            for (let at = via.get(toId); at; at = via.get(at[0])) chain.unshift(at[0], at[1])
            return chain
          }
          next.push(mate)
        }
      }
    }
    frontier = next
  }
  return null
}
