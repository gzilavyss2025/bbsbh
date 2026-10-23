// Pure half of scripts/franchise/gen-franchise-hof.mjs (#2597): for each club, the Hall of Famers
// "inducted as" that club (the club on the plaque) and the ones who "also played here" (and the
// seasons they did). A generator file runs on import (scripts/CLAUDE.md), so the testable part
// lives here. No clock: same input, same bytes.

// awards/MLBHOF/recipients `awards` -> [{ id, name, year, teamId|null }], oldest induction first.
// A recipient with no `team` keeps `teamId: null` and never stops the run. A recipient with no
// player id or name is dropped. Executives and managers are recipients too; they have no
// playing years, so their "also played here" stays empty.
export function inducteesFrom(awards) {
  return (awards ?? [])
    .filter((a) => a.player?.id && a.player?.nameFirstLast)
    .map((a) => ({ id: a.player.id, name: a.player.nameFirstLast, year: Number(a.season), teamId: a.team?.id ?? null }))
    .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name) || a.id - b.id)
}

// A `people/{id}?hydrate=stats(group=[hitting,pitching],type=[yearByYear])` person ->
// Map(teamId -> sorted unique seasons), major-league splits only. A split with no team (a
// multi-team season's total row) is skipped; each team's own row carries the season.
export function seasonsByTeam(person) {
  const out = new Map()
  for (const stat of person?.stats ?? []) {
    for (const s of stat.splits ?? []) {
      const id = s.team?.id
      if (!id || (s.sport?.id ?? 1) !== 1) continue
      const seasons = out.get(id) ?? []
      const season = Number(s.season)
      if (!seasons.includes(season)) seasons.push(season)
      out.set(id, seasons)
    }
  }
  for (const seasons of out.values()) seasons.sort((a, b) => a - b)
  return out
}

// recipients: inducteesFrom's list. careers: Map(personId -> people response person). clubIds: the
// clubs to write. -> Map(clubId -> { teamId, inductedAs: [{ id, name, year }],
// alsoPlayed: [{ id, name, year, seasons }] }). `year` is the induction year. A player inducted as a
// club is not repeated in that club's alsoPlayed (once, under "inducted as"). A recipient inducted
// under a club outside `clubIds` (no club on the plaque, a Negro League or 1800s club) appears only
// under the current clubs he played for.
export function buildHof({ recipients, careers, clubIds }) {
  const out = new Map(clubIds.map((teamId) => [teamId, { teamId, inductedAs: [], alsoPlayed: [] }]))
  for (const r of recipients) {
    const as = out.get(r.teamId)
    if (as) as.inductedAs.push({ id: r.id, name: r.name, year: r.year })
    for (const [teamId, seasons] of seasonsByTeam(careers.get(r.id))) {
      const club = out.get(teamId)
      if (!club || teamId === r.teamId) continue
      club.alsoPlayed.push({ id: r.id, name: r.name, year: r.year, seasons })
    }
  }
  for (const club of out.values()) {
    club.alsoPlayed.sort((a, b) => a.seasons[0] - b.seasons[0] || a.name.localeCompare(b.name) || a.id - b.id)
  }
  return out
}
