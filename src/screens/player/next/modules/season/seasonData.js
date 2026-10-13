// The Season statistics module's loader (#1885). It calls the narrow fetchers the Stats tab's
// loader (api/player/stats.js) uses for ONE stat group, never the whole loader, and hands the
// raw reads to careerRegisterView, the register the live page prints. Every dated read takes
// `asOf` (through the player context and the postseason reads).
import { fetchMilbCareer, fetchPersonStats, fetchTeamAbbrevs } from '../../../../../api/person-fetch.js'
import { resolveCareerOrgs } from '../../../../../api/careerTimeline.js'
import { fetchWarData, fetchWarHistory, warByTeamFor, warByYearFor } from '../../../../../api/war.js'
import { aggregateSplits, careerRegisterView, milbCareerStat, pitcherRole } from '../../../../../api/person.js'
import { currentSeasonFor, playerContext, yearByYearFor } from '../../../../../api/player/context.js'
import { fetchPostseasonSeason, loadPostseasonRegister } from '../../../../../api/player/postseasonRegister.js'
import { withTeams } from './seasonView.js'

// Null when the player has no season row anywhere (the module then hides its card).
export async function loadSeason({ bio, role: group, asOf }) {
  const ctx = await playerContext(bio.id, asOf)
  if (!ctx) return null
  const { id, season, startDate, endDate, debutYear, careerSportId, rosterStatus } = ctx
  const hasDebuted = Boolean(bio.debut)
  const retiredYear = rosterStatus?.state === 'retired' ? Number(rosterStatus.through?.slice(0, 4)) || null : null

  const [warCurrent, warHistory, yby, current, careerSplits, otherYby] = await Promise.all([
    fetchWarData(),
    fetchWarHistory(id),
    yearByYearFor(ctx, group),
    currentSeasonFor(ctx, group),
    fetchPersonStats(id, { type: 'career', group, sportId: careerSportId }),
    // A two-way player's pitching gap in a year he batted is no missed season.
    Promise.all(ctx.groups.filter((g) => g !== group).map((g) => yearByYearFor(ctx, g))),
  ])
  const { stat: tileStat, sportId: tileSportId, levelOnlyStat, levelOnlySplits } = current
  const role = group === 'pitching' ? pitcherRole(tileStat) : null
  const otherGroupYears = otherYby.length
    ? new Set(otherYby.flatMap((y) => [...y.mlbYbySplits, ...y.milbYbySplits]).map((s) => Number(s.season)))
    : null

  const [milbCareerSplits, orgOf, post, postSplits] = await Promise.all([
    yby.milbYbySplits.length ? fetchMilbCareer(id, group) : [],
    resolveCareerOrgs([...yby.mlbYbySplits, ...yby.milbYbySplits]),
    loadPostseasonRegister(id, group, { hasDebuted, asOf, showSaves: role === 'CL' }),
    fetchPostseasonSeason(id, group, { season, startDate, endDate, hasDebuted }),
  ])

  const warByYear = warByYearFor(id, group, warCurrent, warHistory)
  const register = careerRegisterView({
    mlbSplits: yby.mlbYbySplits,
    milbSplits: yby.milbYbySplits,
    group,
    role,
    debutYear,
    currentStat: levelOnlyStat ?? tileStat,
    currentSplits: levelOnlySplits,
    currentSeason: season,
    currentSportId: tileSportId,
    retiredYear,
    careerStat: aggregateSplits(careerSplits, group),
    milbCareer: milbCareerStat(milbCareerSplits, group),
    warByYear,
    warByTeam: warByTeamFor(id, group, warCurrent) ?? {},
    transactions: ctx.txns,
    orgOf,
    otherGroupYears,
  })
  if (!register) return null

  const abbrevs = await fetchTeamAbbrevs(register.rows.flatMap((r) => r.teamIds))
  // The tiles' lines follow the live loader's level rule: MLB when the tile level is MLB (an
  // up-and-down big leaguer on a rehab stint included), else the minor-league window.
  const milbThisSeason = aggregateSplits(yby.milbYbySplits.filter((s) => Number(s.season) === season), group)
  return {
    register: withTeams(register, abbrevs),
    post,
    lines: {
      mlb: tileSportId === 1 ? levelOnlyStat ?? tileStat : null,
      milb: tileSportId === 1 ? milbThisSeason : tileStat,
      post: aggregateSplits(postSplits, group),
    },
    war: warByYear[season] ?? null,
    armRole: role,
  }
}
