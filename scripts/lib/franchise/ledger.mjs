// Pure half of gen-franchise-ledger.mjs (#2595): one row per club per season, built from the
// standings feed, the postseason schedule feed, the manager-history shards and the franchise
// spans. A generator file runs on import (scripts/CLAUDE.md), so the testable part lives here.
// No clock: same input, same bytes.

// Seasons that need a word beside the numbers (defaults, #2595; not decided by Gary).
export const SEASON_NOTES = { 1981: 'split season', 1994: 'strike', 2020: '60-game season' }

const rank = (v) => (v == null || v === '' ? null : Number(v))
const games = (v) => (v == null || v === '-' || v === '' ? 0 : Number(v))

// standings?...&standingsTypes=regularSeason `records` -> Map(teamId -> row). Before divisions
// (1901-1968) `divisionRank` is null; `gb` is the feed's gamesBack ("-" is 0).
export function standingsFor(records) {
  const out = new Map()
  for (const rec of records ?? []) {
    for (const t of rec.teamRecords ?? []) {
      if (out.has(t.team.id)) continue
      out.set(t.team.id, {
        w: t.wins,
        l: t.losses,
        gb: games(t.gamesBack),
        divisionRank: rank(t.divisionRank),
        leagueRank: rank(t.leagueRank),
        rs: t.runsScored ?? null,
        ra: t.runsAllowed ?? null,
      })
    }
  }
  return out
}

const ROUND = { F: 1, D: 2, L: 3, W: 4 }

// schedule/postseason `dates[].games[]` for one season -> Map(teamId -> { round, won }): the
// highest round a club reached (wild card, division series, LCS, World Series) and whether it
// won that series. A series is the games between one pair of clubs in one round; its winner is
// the club with more wins. Only finished games count. A club that never played is absent.
export function postseasonFor(dates) {
  const series = new Map() // key -> { round, description, wins: Map(teamId -> n) }
  for (const { games: day } of dates ?? []) {
    for (const g of day ?? []) {
      if (g.status?.codedGameState !== 'F' || !ROUND[g.gameType]) continue
      const a = g.teams.away.team.id
      const h = g.teams.home.team.id
      const key = `${g.gameType}|${g.seriesDescription}|${Math.min(a, h)}-${Math.max(a, h)}`
      const s = series.get(key) ?? { round: ROUND[g.gameType], description: g.seriesDescription, wins: new Map([[a, 0], [h, 0]]) }
      for (const side of [g.teams.away, g.teams.home]) if (side.isWinner) s.wins.set(side.team.id, s.wins.get(side.team.id) + 1)
      series.set(key, s)
    }
  }
  const best = new Map()
  for (const s of series.values()) {
    const [x, y] = [...s.wins.keys()]
    const winner = s.wins.get(x) === s.wins.get(y) ? null : s.wins.get(x) > s.wins.get(y) ? x : y
    for (const id of [x, y]) {
      const prev = best.get(id)
      if (!prev || s.round > prev.round) best.set(id, { round: s.round, result: { round: s.description, won: winner === id } })
    }
  }
  return new Map([...best].map(([id, b]) => [id, b.result]))
}

const MANAGER_JOBS = new Set(['MNGR', 'NTRM'])

// manager-history shards (`byPersonId: { id: [stint] }`) -> Map("teamId-season" -> [{ id, w?, l? }]).
// Only manager and interim manager stints. The feed lists one stint per jersey number, so a
// person counts once per club-season. A shared season has no record (the shards leave it out), so
// those managers carry no w/l. Most games first, then lower id.
export function managersFor(shards) {
  const out = new Map()
  for (const shard of shards) {
    for (const [pid, stints] of Object.entries(shard.byPersonId ?? {})) {
      for (const s of stints) {
        if (!MANAGER_JOBS.has(s.jobId)) continue
        const key = `${s.teamId}-${s.season}`
        const list = out.get(key) ?? []
        const found = list.find((m) => m.id === Number(pid))
        if (found) {
          if (s.record && !found.w && !found.l) Object.assign(found, { w: s.record.w, l: s.record.l })
        } else {
          list.push(s.record ? { id: Number(pid), w: s.record.w, l: s.record.l } : { id: Number(pid) })
        }
        out.set(key, list)
      }
    }
  }
  for (const list of out.values()) list.sort((a, b) => (b.w ?? 0) + (b.l ?? 0) - ((a.w ?? 0) + (a.l ?? 0)) || a.id - b.id)
  return out
}

// One club's rows, oldest first: a row for every season of every span up to `through`. The name
// and league are the span's, so a row agrees with franchise-history/{teamId}.json. `standings` is
// Map(season -> standingsFor map), `postseason` Map(season -> postseasonFor map), `managers`
// managersFor's map, `names` Map(personId -> "First Last"). A season of a span with no standings
// row throws: a hole must not ship.
export function buildLedger({ teamId, spans, through, standings, postseason, managers, names, notes = SEASON_NOTES }) {
  const rows = []
  for (const span of [...spans].sort((a, b) => a.from - b.from)) {
    for (let season = span.from; season <= Math.min(span.to, through); season++) {
      const s = standings.get(season)?.get(teamId)
      if (!s) throw new Error(`no standings row for club ${teamId} in ${season}`)
      rows.push({
        season,
        name: span.name,
        league: span.league,
        ...s,
        managers: (managers.get(`${teamId}-${season}`) ?? []).map((m) => ({ ...m, name: names.get(m.id) ?? '' })),
        postseason: postseason.get(season)?.get(teamId) ?? null,
        note: notes[season] ?? null,
      })
    }
  }
  return rows
}
