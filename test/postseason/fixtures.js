// Shared loader for the postseason fixtures in test/fixtures/postseason/.
//
// Each file is a real statsapi answer, captured 2026-09-28 with the SAME
// `fields=` list the fetchers in src/api/postseason/fetch.js send:
//   {year}-skeleton.json  skeletonUrl(year)  — clubs, placeholders, dates; no result field
//   {year}-results.json   resultsUrl(year, …) with endDate {year}-12-31 — every game's
//                          winner, so a test can ask for any cutoff and the derivation
//                          must re-apply that cutoff itself
// 2025 is the whole finished postseason. 2026 is the skeleton on the eve of the
// first game (no results exist). 2022 holds two real postponed games (ALDS
// NYY-CLE Games 2 and 5). 2008 holds the real suspended World Series Game 5
// (suspended 2008-10-27, resumed 2008-10-29).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resultRowsFrom, skeletonRowsFrom } from '../../src/api/postseason/fetch.js'

const DIR = fileURLToPath(new URL('../fixtures/postseason/', import.meta.url))

export function rawFixture(name) {
  return JSON.parse(readFileSync(`${DIR}${name}.json`, 'utf8'))
}

export function skeleton(year) {
  return skeletonRowsFrom(rawFixture(`${year}-skeleton`))
}

export function results(year) {
  return year === 2026 ? [] : resultRowsFrom(rawFixture(`${year}-results`))
}

// The series in one league and round that holds the club with this
// abbreviation. Reads the derived slots only, so a test can never find a
// series through a club the derivation did not place.
export function seriesWith(bracket, league, round, abbr) {
  return bracket.series.find(
    (s) => s.league === league && s.round === round && s.slots.some((slot) => slot.club?.abbreviation === abbr),
  )
}

// "MIL 2, CHC 1" style summary of one series' heading-in wins.
export function winsOf(series) {
  return series.slots.map((slot) => `${slot.club?.abbreviation ?? '—'} ${slot.wins}`).join(', ')
}
