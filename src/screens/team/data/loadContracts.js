import { isFrozenSeason, seasonOf } from './shared.js'
import { fetchTeam } from '../../../api/team.js'
import { fetchTeamContracts, fetchLeagueSalaries, clubStanding } from '../../../api/salaries.js'

// The Contracts tab's own data, and almost nothing: one static club ledger, plus
// the league file for the single fact the ledger cannot know about itself —
// where this payroll sits among the thirty. No roster, no schedule, no stats.
//
// Both reads fail soft. A MiLB club has no ledger at all (Cot's covers the major
// leagues), and a club whose file has not been generated yet is the same case,
// so the tab renders an honest "not published" card rather than an error.
//
// `asOf` picks the book: a past season reads its frozen copy (#2776), the page hides the band
// for a past season with none, and every other date reads the live files.
export async function loadContracts(id, asOf = null) {
  const team = await fetchTeam(id)
  if (!team) return null
  const isMilb = (team.sport?.id ?? 1) !== 1
  if (isMilb) return { ledger: null, standing: null, isMilb: true }

  const season = seasonOf(asOf)
  const frozen = season < seasonOf(null) && isFrozenSeason(season) ? season : null
  const [ledger, league] = await Promise.all([fetchTeamContracts(id, frozen), fetchLeagueSalaries(frozen)])
  return {
    ledger,
    standing: ledger ? clubStanding(league, Number(id)) : null,
    clubCount: league?.clubs?.length ?? null,
    isMilb: false,
  }
}
