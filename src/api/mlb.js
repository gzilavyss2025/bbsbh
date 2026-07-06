// Thin wrapper around the public MLB Stats API. All requests run in the user's
// browser; there is no backend. Field paths here were verified against the
// live July 5 2026 Brewers @ D-backs game (gamePk 825061).

import { SEARCHABLE_SPORT_IDS, SPORT_LABEL } from '../lib/teams.js'

const BASE = 'https://statsapi.mlb.com'

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`MLB API ${res.status} for ${path}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Schedule / slate
// ---------------------------------------------------------------------------

// Normalize a raw schedule game into the shape our cards need.
function normalizeGame(game, sportId) {
  const away = game.teams?.away
  const home = game.teams?.home
  return {
    gamePk: game.gamePk,
    sportId,
    sportLabel: SPORT_LABEL[sportId] ?? '',
    gameDate: game.gameDate,
    // Status codes: 'S'/'P' pre-game, 'I' in-progress, 'F'/'O' final.
    statusCode: game.status?.statusCode,
    detailedState: game.status?.detailedState,
    abstractState: game.status?.abstractGameState,
    away: {
      id: away?.team?.id,
      name: away?.team?.name,
      teamName: away?.team?.teamName ?? away?.team?.name,
    },
    home: {
      id: home?.team?.id,
      name: home?.team?.name,
      teamName: home?.team?.teamName ?? home?.team?.name,
    },
  }
}

// Today's MLB slate (or any single sportId for a given date).
export async function fetchSchedule(dateStr, sportId = 1) {
  const data = await getJson(
    `/api/v1/schedule?sportId=${sportId}&date=${dateStr}`,
  )
  const dates = data.dates ?? []
  const games = dates.flatMap((d) => d.games ?? [])
  return games.map((g) => normalizeGame(g, sportId))
}

// Search a date's games across MLB + MiLB levels by team name. Used by the
// game-selection search box. Runs the level queries in parallel and tolerates
// individual level failures (MiLB endpoints are flakier).
export async function searchGamesByTeam(dateStr, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results = await Promise.allSettled(
    SEARCHABLE_SPORT_IDS.map((sportId) => fetchSchedule(dateStr, sportId)),
  )

  const all = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : [],
  )

  return all.filter((g) => {
    const names = [
      g.away.name,
      g.away.teamName,
      g.home.name,
      g.home.teamName,
    ]
    return names.some((n) => n?.toLowerCase().includes(q))
  })
}

// ---------------------------------------------------------------------------
// Full game feed
// ---------------------------------------------------------------------------

export async function fetchGameFeed(gamePk) {
  return getJson(`/api/v1.1/game/${gamePk}/feed/live`)
}

// ---------------------------------------------------------------------------
// Managers — NOT in the live feed (its coaches array comes back empty), so we
// hit the dedicated coaches endpoint and find the row where job == 'Manager'.
// ---------------------------------------------------------------------------

export async function fetchManager(teamId) {
  if (!teamId) return null
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/coaches`)
    const roster = data.roster ?? []
    const mgr = roster.find((r) => r.job === 'Manager')
    return mgr?.person?.fullName ?? null
  } catch {
    // MiLB affiliates may not expose coaches; degrade gracefully.
    return null
  }
}
