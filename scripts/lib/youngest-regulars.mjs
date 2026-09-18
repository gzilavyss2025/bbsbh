// The pure half of scripts/gen-youngest-regulars.mjs — combining a league's
// season lines into one row per player, and the age arithmetic.
//
// A generator file RUNS on import, so anything worth a unit test has to live
// here to be testable at all (the scripts/lib convention; test/youngest-regulars.test.js).

// A player who moved between two clubs IN THE SAME LEAGUE has two splits, and
// neither one alone says whether he was a regular. So the league's lines are
// summed per person before any floor is applied — the same "never rank a
// half-line" rule src/api/statsLevels.js applies across levels, one scope down.
//
// The club kept is the one he took the most plate appearances for, because the
// row names a club and a player who moved has to be shown under one of them.
export function combineByPlayer(splits) {
  const byId = new Map()
  for (const split of splits ?? []) {
    const id = split?.player?.id
    if (!id) continue
    const pa = Number(split?.stat?.plateAppearances) || 0
    const entry = byId.get(id) ?? {
      id,
      name: split.player.fullName ?? '',
      pa: 0,
      teamId: null,
      teamName: '',
      clubPa: -1,
    }
    entry.pa += pa
    if (pa > entry.clubPa) {
      entry.clubPa = pa
      entry.teamId = split?.team?.id ?? null
      entry.teamName = split?.team?.name ?? ''
    }
    byId.set(id, entry)
  }
  return [...byId.values()].map(({ clubPa, ...rest }) => rest)
}

// AGE ON JUNE 30 of the season, in years to one decimal.
//
// June 30 is baseball's own convention for a season age, and it is the one
// statsapi itself uses: its season stat line carries an integer `age` that
// matched this reading for every player checked, including two born in August
// whose age today is already a year higher. The decimal is computed here
// rather than taken from that integer because the note compares a player to
// his league's average, and an average of integers would round away most of
// the gap it is trying to show.
export function ageOnJune30(birthDate, season) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  if (!Number.isFinite(season)) return null
  const born = Date.parse(`${birthDate}T12:00:00Z`)
  const mark = Date.UTC(season, 5, 30, 12)
  if (Number.isNaN(born)) return null
  const years = (mark - born) / (365.2425 * 86400000)
  if (years <= 0 || years > 70) return null
  return Math.round(years * 10) / 10
}

// The league's average age over its regulars — a plain mean, because an age is
// not a rate. (research.md §7's "never average rates across clubs" is about
// combining numerators and denominators; there is no denominator here.)
export function averageAge(players) {
  const ages = (players ?? []).map((p) => p.age).filter((a) => Number.isFinite(a))
  if (ages.length === 0) return null
  const mean = ages.reduce((sum, a) => sum + a, 0) / ages.length
  return Math.round(mean * 10) / 10
}

// Youngest first. Ties are kept and broken by plate appearances, so the player
// who did more of it at that age leads — never trimmed to a round number
// (research.md §7's "include tied values").
export function sortByAge(players) {
  return (players ?? []).slice().sort((a, b) => {
    if (a.age !== b.age) return a.age - b.age
    if (a.pa !== b.pa) return b.pa - a.pa
    return a.name < b.name ? -1 : 1
  })
}
