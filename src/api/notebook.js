// THE NOTEBOOK — the offseason page's one note, read from a static same-origin
// file (issue #1078, step 4 of #1038).
//
// Two notes live here rather than in two modules, because they are one idea
// with two subjects. A notebook note asks one question about a finished season,
// answers it with a number and its denominator, and links to the people or the
// game the answer came out of. MLB gets the twelve-pitch at-bats; the four
// minor levels get the youngest regulars, because the rate boards that would be
// the obvious note there cannot be written honestly at a single level (the
// promotion bias, recorded in scripts/gen-youngest-regulars.mjs).
//
// SPOILER-FREE, AND THE FILES ARE WHY.
//
// The age note is a season aggregate and a date of birth. Those have opened
// live since ADR-0034, and there is no game in the file at all.
//
// The at-bat note names GAMES, which is the one that had to be thought about.
// It carries a batter, a pitcher, a date and a pitch count — and NOT the
// at-bat's result, not an inning, not a score. A twelve-pitch at-bat is a
// LENGTH, true of the at-bat whoever won, and a reader who opens that game
// finds it sealed exactly as the slate would have handed it to them. The
// generator does not store the outcome and test/long-at-bats.test.js asserts
// that of the committed file by vocabulary rather than by trust — the same
// stance, for the same reason, as the picked-game pool (ADR-0080).
import { staticJsonBy } from './staticJson.js'
import { gamePath } from '../lib/route.js'

// One MLB season's twelve-pitch at-bats. Keyed on the season rather than
// written to one rolling path: the offseason page names one season from
// November to February, and a generator that rolled over on January 1 would
// take the note off the page until April (#1122).
export const fetchLongAtBats = staticJsonBy((season) => `/data/long-at-bats/${season}.json`, {
  shape: (d) => ({
    season: Number(d?.season) || null,
    threshold: Number(d?.threshold) || 0,
    coverage: {
      games: Number(d?.coverage?.games) || 0,
      playedGames: Number(d?.coverage?.playedGames) || 0,
      plateAppearances: Number(d?.coverage?.plateAppearances) || 0,
      complete: Boolean(d?.coverage?.complete),
    },
    rows: Array.isArray(d?.rows) ? d.rows : [],
  }),
  fallback: null,
})

// One level's three leagues, each with its own regulars and its own average.
export const fetchYoungestRegulars = staticJsonBy(
  (sportId) => `/data/youngest-regulars/${sportId}.json`,
  {
    shape: (d) => ({
      season: Number(d?.season) || null,
      regularPa: Number(d?.regularPa) || 0,
      leagues: Array.isArray(d?.leagues) ? d.leagues : [],
    }),
    fallback: null,
  },
)

// WHICH LEAGUE'S NOTE OPENS FIRST. The reader's own club, if one of its farm
// clubs plays in one of the three; otherwise the league with the most regulars,
// which is the one whose average age is standing on the most players.
//
// Never the first in the array: statsapi returns the three in an order that is
// neither alphabetical nor by size, so "the first one" would look arbitrary and
// change under the page without explanation.
export function defaultLeagueId(leagues, favoriteOrgId) {
  const list = Array.isArray(leagues) ? leagues.filter((l) => l?.leagueId) : []
  if (list.length === 0) return null
  if (favoriteOrgId) {
    // `orgIds` is every organisation with a club in the league, not just the
    // ones that produced a name on the list — a reader whose affiliate fielded
    // nobody young still lands in the league they watched.
    const mine = list.find((l) => (l.orgIds ?? []).includes(favoriteOrgId))
    if (mine) return mine.leagueId
  }
  return list.reduce((best, l) => ((l.regulars ?? 0) > (best.regulars ?? 0) ? l : best), list[0])
    .leagueId
}

// How far below his league a player was, as a signed number of years. The note
// prints it beside the age because an age on its own means nothing across
// levels: 21.1 is the youngest man in Triple-A and an old High-A regular.
export function ageGap(age, averageAge) {
  if (!Number.isFinite(age) || !Number.isFinite(averageAge)) return null
  return Math.round((age - averageAge) * 10) / 10
}

// One decimal, always — 24 is an age, "24.0" is a measurement, and the column
// it sits in is a measurement.
export function years(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '—'
}

// A count with thousands separators. The denominator on this page runs to six
// figures and is unreadable without them.
export function count(value) {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '—'
}

// Which club a man in the at-bat was with, off the row's own two clubs rather
// than a lookup: the batter batted for one of them and the pitcher for the
// other, so the file already knows, and a club that has since changed its mark
// still reads as it did that season.
export function clubAbbr(row, teamId) {
  if (!row || !teamId) return ''
  if (row.away?.id === teamId) return row.away.abbr ?? ''
  if (row.home?.id === teamId) return row.home.abbr ?? ''
  return ''
}

// The at-bat's own game, opened at its first lineup page — the same address the
// slate's cards build, so it arrives sealed under the same `revealedThrough`
// mark as any other game.
export function atBatGamePath(row) {
  if (!row?.date || !row?.away?.abbr || !row?.home?.abbr) return null
  return gamePath(row.date, row.away.abbr, row.home.abbr, 'lineup1', row.g ?? 1)
}
