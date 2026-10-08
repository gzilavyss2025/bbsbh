// THE POSTSEASON, ONE ENTRY A GAME — public/data/abs/{season}/abs-challenges-post-games.json
// (#1769). The postseason series page's ABS card cuts it to one series.
//
// WHY A FILE OF ITS OWN. abs-challenges-post.json folds the whole postseason
// into per-player totals, so no series can be cut from it. The ledger already
// holds one row a challenge and one row a game, so the facts exist; this ships
// them in a shape a series can use. ADR-0076 applies: /abs-challenges does not
// read this file, so it does not ride in that page's.
//
// FACTS ONLY. Which games make a series, which clubs, which cutoff, and the
// order of the card are the reader's (src/api/around-the-game/absSeries.js),
// the split export.mjs keeps for every other cut.
//
// ROLES ARE ADDED HERE. A catcher who bats has a `batter` row and a `catcher`
// row in the ledger; the card shows one record a player, so the entry sums
// them. A game's role split would be a column nothing reads.
//
// A game nobody challenged in has no entry, and a challenge row with no
// player id (the feed named no one) cannot be keyed to a person and is left
// out. Pure: rows in, summary out.

import { inScope } from './rows.mjs'

export function buildPostGamesExport(allRows, allGames, { season, generatedAt } = {}) {
  const seasonGames = allGames.filter((g) => season == null || g.season === season)
  const { rows, games } = inScope(allRows, seasonGames, 'P')
  const rowsByGame = Map.groupBy(
    rows.filter((r) => r.player_id != null),
    (r) => r.game_pk,
  )
  const out = []
  for (const g of games) {
    const byPlayer = new Map()
    for (const r of rowsByGame.get(g.game_pk) ?? []) {
      const key = `${r.player_id}:${r.team_id}`
      const p = byPlayer.get(key) ?? { playerId: r.player_id, name: r.player_name, teamId: r.team_id, n: 0, success: 0 }
      p.n += 1
      if (r.outcome === 'success') p.success += 1
      byPlayer.set(key, p)
    }
    if (byPlayer.size === 0) continue
    out.push({
      gamePk: g.game_pk,
      date: g.date,
      away: g.away_team_id,
      home: g.home_team_id,
      players: [...byPlayer.values()].sort((a, b) => a.playerId - b.playerId),
    })
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
  return {
    version: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    season: season ?? null,
    games: out,
  }
}
