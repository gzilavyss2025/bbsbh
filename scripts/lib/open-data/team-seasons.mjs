// The pure half of scripts/gen-team-seasons.mjs (ADR-0100): one roster per MLB
// team-season, from Retrosheet's allplayers.csv, as MLBAM ids. It lives here because
// a generator file runs on import (scripts/CLAUDE.md).
//
// THE RULE: two players are teammates when both have g >= 1 for the same Retrosheet
// team code and season. A player traded in midseason has a row for each club, so he
// sits on both rosters.
//
// THE SCOPE (measured 2026-10-06). allplayers.csv also holds the All-Star sides (ALS,
// NLS, ASE ...) and the Negro Leagues clubs. An All-Star side is not a team. A Negro
// Leagues club is a major league since MLB said so in 2020, but only 80% of its players
// carry an MLBAM id, so a chain through one would break. The 60 codes below are the
// AL, NL and Federal League clubs: 99.97% of their players bridge.
//
// THE LABEL uses the nickname teams0.csv holds for the code, which is the newest one:
// Brooklyn 1897 reads "Dodgers 1897". A code that teams0.csv lacks falls back to the code.
//
// Ids are strings in, numbers out. No clock: same input, same bytes.
const MLB_CODES = new Set(
  ('ANA ARI ATH ATL BAL BLA BLF BLN BOS BRF BRO BSN BUF CAL CHA CHF CHN CIN CL4 CLE COL DET FLO HOU IND ' +
    'KC1 KCA KCF LAA LAN LS3 MIA MIL MIN MLA MLN MON NEW NY1 NYA NYN OAK PHA PHI PIT PTF SDN SE1 SEA SFN ' +
    'SLA SLF SLN TBA TEX TOR WAS WS1 WS2 WSN').split(' '),
)

const byNumber = (a, b) => a - b

// players: allplayers.csv rows ({ id, team, g, season }). teams: teams0.csv rows.
// retroToMlbam: from retro-bridge.mjs.
// -> { teamSeasons: [{ key, label, playerIds }], report }
export function buildTeamSeasons({ players, teams, retroToMlbam }) {
  const nickname = new Map(teams.map((t) => [t.team, t.nickname]))
  const rosters = new Map() // key -> { label, season, ids: Set of retro ids }
  const seen = new Set()
  for (const { id, team, g, season } of players) {
    if (!MLB_CODES.has(team) || !(Number(g) >= 1)) continue
    seen.add(id)
    const key = `${team}-${season}`
    if (!rosters.has(key)) rosters.set(key, { label: `${nickname.get(team) || team} ${season}`, season: Number(season), ids: new Set() })
    rosters.get(key).ids.add(id)
  }

  const teamSeasons = [...rosters]
    .sort(([ka, a], [kb, b]) => a.season - b.season || (ka < kb ? -1 : ka > kb ? 1 : 0))
    .map(([key, r]) => ({
      key,
      label: r.label,
      playerIds: [...new Set([...r.ids].filter((id) => retroToMlbam.has(id)).map((id) => Number(retroToMlbam.get(id))))].sort(byNumber),
    }))

  const bridged = [...seen].filter((id) => retroToMlbam.has(id)).length
  const report = {
    mlbPlayers: seen.size,
    bridged,
    unbridged: seen.size - bridged,
    share: seen.size ? bridged / seen.size : 1,
  }
  return { teamSeasons, report }
}

// The file a browser holds: every player once, each roster as indexes into that list.
export function compactTeamSeasons({ teamSeasons }) {
  const players = [...new Set(teamSeasons.flatMap((t) => t.playerIds))].sort(byNumber)
  const at = new Map(players.map((id, i) => [id, i]))
  return {
    players,
    teamSeasons: teamSeasons.map((t) => [t.key, t.label, t.playerIds.map((id) => at.get(id))]),
  }
}
