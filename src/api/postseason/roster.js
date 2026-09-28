// A club's declared postseason roster, for the live series page (#1224).
//
// statsapi has NO postseason roster type. /api/v1/rosterTypes (checked live
// 2026-09-28) lists 40Man, fullSeason, fullRoster, nonRosterInvitees,
// active, allTime, depthChart, gameday and coach — nothing more. The declared
// roster is the ACTIVE roster on a date the series plays. Checked live the
// same day against the 2025 postseason:
//   - A club names 26 players by the morning of Game 1 (MIL on 2025-10-04:
//     26; the day before its first game CHC had 39).
//   - The roster can change between rounds (MIL's NLCS roster on 2025-10-13
//     swapped Nick Mears for Tobias Myers) and, for an injury, inside a series.
//     The transaction wire shows these only as "roster status changed".
//   - A beaten club goes back to its 40-man roster the day after it is out
//     (CHC on 2025-10-20: 40).
// So the date is the LAST date the series played on or before the cutoff,
// never later, and a list of more than 26 is "not named yet", never shown.
// A roster move is not a result, so this module is spoiler-free.

import { getJson } from '../statsapi.js'

export const POSTSEASON_ROSTER_SIZE = 26

const ROSTER_FIELDS = 'roster,person,id,fullName,jerseyNumber,position,abbreviation'

export function rosterUrl(teamId, date) {
  return `/api/v1/teams/${teamId}/roster?rosterType=active&date=${date}&fields=${ROSTER_FIELDS}`
}

// The date to read a series' rosters on: the latest game the series played
// before the cutoff, or the cutoff itself when the series plays that day.
// Null before Game 1 day: no club has named its roster yet.
export function seriesRosterDate(series, cutoff) {
  if (!series) return null
  const dates = (series.games ?? []).map((g) => g.date).filter(Boolean)
  if (series.playsOnCutoff && cutoff) dates.push(cutoff)
  if (!dates.length) return null
  return dates.sort().at(-1)
}

// Scorebook defensive order (2 through 9), DH at the end since it carries no
// defensive number; anything else (TWP, IF, OF, PH, …) falls back to last,
// alphabetical among itself.
const POSITION_ORDER = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']
function positionRank(position) {
  const idx = POSITION_ORDER.indexOf(position)
  return idx === -1 ? POSITION_ORDER.length : idx
}

// One club's players ({ id, name, teamId, position, jersey }) split into the
// two groups RosterCard draws. The box-score roster in ../postseasonSeries.js
// uses this same split and order.
export function rosterGroups(players) {
  const all = [...players]
  return {
    positionPlayers: all
      .filter((p) => p.position !== 'P')
      .sort((a, b) => positionRank(a.position) - positionRank(b.position) || a.name.localeCompare(b.name)),
    pitchers: all.filter((p) => p.position === 'P').sort((a, b) => a.name.localeCompare(b.name)),
  }
}

// A /roster answer to RosterCard's shape, or null when it is not a
// postseason roster: empty, or more than 26 (not named yet, or the club is
// out and back on its 40-man roster). The answer does not carry the club
// (the fields list leaves it out), so the caller names it.
export function shapeRoster(json, teamId) {
  const rows = json?.roster ?? []
  if (!rows.length || rows.length > POSTSEASON_ROSTER_SIZE) return null
  return rosterGroups(
    rows.map((r) => ({
      id: r.person?.id ?? null,
      name: r.person?.fullName ?? '',
      teamId,
      position: r.position?.abbreviation ?? '',
      jersey: r.jerseyNumber ?? '',
    })),
  )
}

export async function fetchSeriesRoster(teamId, date, { signal } = {}) {
  return shapeRoster(await getJson(rosterUrl(teamId, date), { signal }), teamId)
}
