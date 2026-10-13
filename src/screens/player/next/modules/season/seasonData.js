// The Season statistics module's loaders (#1885). They call the narrow fetchers the Stats tab's
// loader (api/player/stats.js) uses for ONE stat group, never the whole loader, and hand the raw
// reads to careerRegisterView, the register the live page prints. Every dated read takes `asOf`.
//
// The first load is what the MLB scope needs. The two reads only another scope needs wait for its
// tap: the minor-league career line (the MiLB footer) and the postseason.
import { fetchMilbCareer, fetchPersonStats, fetchPlayerAwards, fetchTeamAbbrevs } from '../../../../../api/person-fetch.js'
import { resolveCareerOrgs } from '../../../../../api/careerTimeline.js'
import { fetchWarData, fetchWarHistory, warByTeamFor, warByYearFor } from '../../../../../api/war.js'
import { aggregateSplits, careerRegisterView, milbCareerStat, pitcherRole } from '../../../../../api/person.js'
import { currentSeasonFor, playerContext, yearByYearFor } from '../../../../../api/player/context.js'
import { fetchPostseasonSeason, loadPostseasonRegister } from '../../../../../api/player/postseasonRegister.js'
import { linesOf, starYears, withStars, withTeams } from './seasonView.js'

// Null when the player has no season row anywhere (the module then hides its card).
export async function loadSeason({ bio, role: group, asOf }) {
  const ctx = await playerContext(bio.id, asOf)
  if (!ctx) return null
  const { id, season, startDate, endDate, debutYear, rosterStatus, careerSportId } = ctx
  const hasDebuted = Boolean(bio.debut)
  const retiredYear = rosterStatus?.state === 'retired' ? Number(rosterStatus.through?.slice(0, 4)) || null : null

  const [warCurrent, warHistory, yby, current, careerSplits, awards, otherYby] = await Promise.all([
    fetchWarData(),
    fetchWarHistory(id),
    yearByYearFor(ctx, group),
    currentSeasonFor(ctx, group),
    // The MLB footer's career line, as the live register has it.
    fetchPersonStats(id, { type: 'career', group, sportId: careerSportId }),
    // One read names every All-Star year (the roster lookup is one read per year).
    fetchPlayerAwards(id),
    // A two-way player's pitching gap in a year he batted is no missed season.
    Promise.all(ctx.groups.filter((g) => g !== group).map((g) => yearByYearFor(ctx, g))),
  ])
  const { stat: tileStat, sportId: tileSportId, levelOnlyStat, levelOnlySplits } = current
  const armRole = group === 'pitching' ? pitcherRole(tileStat) : null
  const otherGroupYears = otherYby.length
    ? new Set(otherYby.flatMap((y) => [...y.mlbYbySplits, ...y.milbYbySplits]).map((s) => Number(s.season)))
    : null

  const warByYear = warByYearFor(id, group, warCurrent, warHistory)
  const orgOf = await resolveCareerOrgs([...yby.mlbYbySplits, ...yby.milbYbySplits])
  const shape = (milbCareer) => careerRegisterView({
    mlbSplits: yby.mlbYbySplits,
    milbSplits: yby.milbYbySplits,
    group,
    role: armRole,
    debutYear,
    currentStat: levelOnlyStat ?? tileStat,
    currentSplits: levelOnlySplits,
    currentSeason: season,
    currentSportId: tileSportId,
    retiredYear,
    careerStat: aggregateSplits(careerSplits, group),
    milbCareer,
    warByYear,
    warByTeam: warByTeamFor(id, group, warCurrent) ?? {},
    transactions: ctx.txns,
    orgOf,
    otherGroupYears,
  })
  const first = shape(null)
  if (!first) return null

  const abbrevs = await fetchTeamAbbrevs(first.rows.flatMap((r) => r.teamIds))
  const stars = starYears(awards, endDate)
  const milbThisSeason = aggregateSplits(yby.milbYbySplits.filter((s) => Number(s.season) === season), group)
  return {
    // The register, with the minor-league career splits once they are read.
    build: (milbCareerSplits) =>
      withStars(withTeams(shape(milbCareerStat(milbCareerSplits, group)), abbrevs), stars),
    hasMilb: yby.milbYbySplits.length > 0,
    hasDebuted,
    lines: linesOf({ tileSportId, levelOnlyStat, tileStat, milbThisSeason }),
    retired: rosterStatus?.state === 'retired',
    war: warByYear[season] ?? null,
    armRole,
    // Read on the tap of the scope that needs them.
    loadMilbCareer: () => fetchMilbCareer(id, group),
    loadPostseason: async () => {
      const [post, splits] = await Promise.all([
        loadPostseasonRegister(id, group, { hasDebuted, asOf, showSaves: armRole === 'CL' }),
        fetchPostseasonSeason(id, group, { season, startDate, endDate, hasDebuted }),
      ])
      return { post, line: aggregateSplits(splits, group) }
    },
  }
}
