// The home plate umpire of each game on one date, for the series primer's
// "Today's edges" card. One schedule read with hydrate=officials.
//
// SPOILER FOOTING. An assignment, not a result: the list names who is behind the
// plate, never how the game went. The field list asks for ids and names only (no
// state, score, teams or linescore), and test/postseason/plate-umpire.test.js
// pins it. Field paths checked against live statsapi on 2025-10-17 (gamePks
// 813039 and 813031): `officials[].official.{id,fullName}` and `officialType`.
// Assignments post a couple of hours before first pitch, so an early read can
// come back with no plate umpire for a game; that game is left out.
import { getJson } from '../statsapi.js'

const FIELDS = 'dates,games,gamePk,officials,officialType,official,id,fullName'

export const plateUmpireUrl = (dateStr) =>
  `/api/v1/schedule?sportId=1&date=${dateStr}&hydrate=officials&fields=${FIELDS}`

// { [gamePk]: { id, name } }
export function shapePlateUmpires(data) {
  const out = {}
  for (const d of data?.dates ?? []) {
    for (const g of d.games ?? []) {
      const plate = (g.officials ?? []).find((o) => o.officialType === 'Home Plate' && o.official?.id)
      if (plate) out[g.gamePk] = { id: plate.official.id, name: plate.official.fullName ?? '' }
    }
  }
  return out
}

// Degrades to {} on any failure: the card then says the umpire is not posted.
export async function fetchPlateUmpires(dateStr) {
  try {
    return shapePlateUmpires(await getJson(plateUmpireUrl(dateStr)))
  } catch {
    return {}
  }
}
