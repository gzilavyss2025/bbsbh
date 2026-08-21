// The Roster tab's own loader — the roster projection, the 40-man Current
// Roster, and the Injured List, plus everything those need (WAR, All-Star
// ids, prospect/rookie badges, the recent-form window, the per-pitcher
// game-log fixup). Fetch nothing another tab owns: no standings,
// schedule-for-display, photos, uniforms, transactions, comebacks, odds,
// affiliates or prospects table.
import {
  fetchTeam,
  fetchTeamRoster,
  fetchTeamIL,
} from '../../../api/team.js'
import { fetchAllStarRosterIds, fetchPersonStats } from '../../../api/person-fetch.js'
import { fetchTeamSchedule } from '../../../api/schedule.js'
import { fetchWarData } from '../../../api/war.js'
import { fetchRecentFormGames, buildRecentForm, recentFormEligibleRoster } from '../../../api/recentForm.js'
import { splitPitchingStaff } from '../../../api/pitcherSplit.js'
import { rosterPitcherRole, firstLast, POS_ORDER, isTwoWay } from '../../../api/person.js'
import { lastName } from '../../../api/select.js'
import { fetchTopProspects, prospectBadge } from '../../../api/prospects.js'
import { fetchRookiesData, showRookiePill } from '../../../api/rookies.js'
import { SPORT_IDS } from '../../../lib/teams.js'
import {
  seasonOf,
  cutoffFor,
  injuredListFrom,
  ipToOuts,
  preferredLineupFrom,
  rosterHittingStat,
  rosterPitchingStat,
} from './shared.js'

const DASH = '—'
const ROLE_ORDER = { SP: 0, CL: 1, RP: 2 }

function comparePitchers(a, b) {
  return (
    (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3) ||
    (b.war ?? -Infinity) - (a.war ?? -Infinity) ||
    Number(a.jersey) - Number(b.jersey)
  )
}
function roleFromCounts(gamesStarted, gamesPitched, saves) {
  const g = Number(gamesPitched) || 0
  if (g === 0) return null
  const gs = Number(gamesStarted) || 0
  if (gs / g >= 0.5) return 'SP'
  if ((Number(saves) || 0) >= 8) return 'CL'
  return 'RP'
}

export async function loadRoster(id, asOf) {
  const team = await fetchTeam(id)
  if (!team) return null
  const sportId = team.sport?.id ?? 1
  const isMilb = sportId !== 1
  // The org a prospect badge should match against: this club's own id when
  // it's already the MLB parent, else its live parentOrgId — never the
  // affiliate's own id, since orgProspects rows are always keyed by parent
  // (see prospectBadge, api/prospects.js).
  const currentOrgId = team.parentOrgId ?? id
  const season = seasonOf(asOf)
  const standingsDate = cutoffFor(asOf)

  const [roster, fullRoster, seasonRoster, ilRoster, allStarIds, warData, prospectsSnapshot, rookiesData, schedule] =
    await Promise.all([
      fetchTeamRoster(id, season, { sportId }),
      // 40Man superset of the active roster above — the projection deliberately
      // includes the IL and rehab assignments: a season's ace doesn't stop
      // being the club's preferred answer at his spot just because he's hurt
      // right now (the Injured List shelf flags that separately).
      fetchTeamRoster(id, season, { sportId, rosterType: '40Man' }),
      // Every player who appeared for this exact club this season, feeding
      // preferredLineupFrom ONLY — a player since promoted or optioned to
      // another level of the org (a AAA regular called up to the majors) is
      // still this season's real answer at his spot, and this is the one
      // roster type wide enough to still carry him (see preferredLineupFrom,
      // shared.js). Top Substitutes and the pitching staff below stay scoped
      // to fullRoster — those answer "who's actually on this roster."
      fetchTeamRoster(id, season, { sportId, rosterType: 'fullSeason' }),
      fetchTeamIL(id, season),
      sportId === 1 ? fetchAllStarRosterIds(season) : Promise.resolve(new Set()),
      sportId === 1 ? fetchWarData() : Promise.resolve({ season: null, bat: {}, pit: {} }),
      fetchTopProspects(),
      fetchRookiesData(),
      fetchTeamSchedule(id, season, sportId, standingsDate),
    ])

  const warBat = warData.season === season ? warData.bat : {}
  const warPit = warData.season === season ? warData.pit : {}

  const position = roster
    .filter((r) => r.position?.type !== 'Pitcher')
    .map((r) => ({
      id: r.person?.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warBat[r.person?.id] ?? null : undefined,
      prospect: prospectBadge(prospectsSnapshot, r.person?.id, currentOrgId),
      rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
    }))
    .sort((a, b) => (POS_ORDER[a.pos] ?? 5) - (POS_ORDER[b.pos] ?? 5) || a.name.localeCompare(b.name))

  // A two-way player carries a single roster spot typed 'Two-Way Player', not
  // 'Pitcher' — include him here too (isTwoWay) so his pitching side isn't
  // dropped; he still also shows above among position players.
  const pitchers = roster
    .filter((r) => r.position?.type === 'Pitcher' || isTwoWay(r.person))
    .map((r) => ({
      id: r.person?.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      role: rosterPitcherRole(r),
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warPit[r.person?.id] ?? null : undefined,
      prospect: prospectBadge(prospectsSnapshot, r.person?.id, currentOrgId),
      rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
    }))
    .sort(comparePitchers)

  // Starting Pitchers / Bullpen draw from the 40Man fullRoster rather than the
  // active-only `pitchers` list above, so a team's ace still shows up while
  // he's on the IL or a minors rehab stint.
  const fullPitchers = fullRoster
    .filter((r) => r.position?.type === 'Pitcher' || isTwoWay(r.person))
    .map((r) => {
      const stat = rosterPitchingStat(r, id)
      return {
        id: r.person?.id,
        name: firstLast(r.person),
        jersey: r.jerseyNumber ?? '',
        allStar: allStarIds.has(r.person?.id),
        war: sportId === 1 ? warPit[r.person?.id] ?? null : undefined,
        prospect: prospectBadge(prospectsSnapshot, r.person?.id, currentOrgId),
        rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
        gs: Number(stat?.gamesStarted) || 0,
        saves: Number(stat?.saves) || 0,
        appearances: Number(stat?.gamesPitched ?? stat?.gamesPlayed) || 0,
        ipOuts: ipToOuts(stat?.inningsPitched),
        ip: stat?.inningsPitched ?? DASH,
        era: stat?.era ?? DASH,
      }
    })
  // Which of these pitchers is CURRENTLY starting, from each one's own most
  // recent outing — see TeamPage.jsx's copy of this fixup for the full
  // incident writeup on why a season GS total alone misreads a pitcher who's
  // moved into the rotation mid-season.
  const recentStarterIds = new Set(
    (
      await Promise.allSettled(
        fullPitchers
          .filter((p) => p.id)
          .map(async (p) => {
            const splits = await fetchPersonStats(p.id, {
              type: 'gameLog',
              group: 'pitching',
              season,
              sportId,
            })
            const last = [...splits]
              .filter((s) => s.date)
              .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
            return last?.stat?.gamesStarted === 1 ? p.id : null
          }),
      )
    )
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter(Boolean),
  )
  for (const p of pitchers) {
    if (recentStarterIds.has(p.id)) p.role = 'SP'
  }
  pitchers.sort(comparePitchers)
  // Starting Pitchers / Bullpen — pure season projection, health status
  // irrelevant. Neither section is capped — see splitPitchingStaff for why.
  const { starters: startingPitchers, bullpen } = splitPitchingStaff(
    fullPitchers.map((p) => ({ ...p, starts: p.gs })),
    {
      compareStarters: (a, b) => b.starts - a.starts || b.ipOuts - a.ipOuts || Number(a.jersey) - Number(b.jersey),
      compareRelievers: (a, b) => b.appearances - a.appearances || b.ipOuts - a.ipOuts,
    },
  )

  // Preferred Lineup — one player per field position, off the season-wide
  // seasonRoster (not fullRoster — see the fetch above). Shared with the
  // Overview's lineup preview so both show the same nine; see
  // preferredLineupFrom for how a spot is decided.
  const preferredLineup = preferredLineupFrom(seasonRoster, id)

  // Top Substitutes — position players who didn't win a diamond spot, ranked
  // by games played, capped at 6.
  const lineupIds = new Set(preferredLineup.map((p) => p.id))
  const substitutes = fullRoster
    .filter(
      (r) =>
        r.person?.id &&
        (r.position?.type !== 'Pitcher' || isTwoWay(r.person)) &&
        !lineupIds.has(r.person.id),
    )
    .map((r) => ({
      id: r.person.id,
      name: firstLast(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
      allStar: allStarIds.has(r.person?.id),
      war: sportId === 1 ? warBat[r.person?.id] ?? null : undefined,
      prospect: prospectBadge(prospectsSnapshot, r.person?.id, currentOrgId),
      rookie: showRookiePill(rookiesData, r.person?.id, sportId === 1),
      games: Number(rosterHittingStat(r, id)?.gamesPlayed) || 0,
    }))
    .filter((p) => p.games > 0)
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, 6)

  // Injured List — every injured player on the club's 40-man view, tagged
  // with which IL. Spoiler-free — roster membership reveals nothing about
  // the score.
  const injured = injuredListFrom(ilRoster, firstLast)
  const currentInjuredIds = new Set(injured.map((p) => p.id))

  // "Current" roster view — same four subsections as the Preferred Lineup
  // card, but built from actual starts/appearances in the club's last 10
  // COMPLETED games, restricted to the active roster minus the IL (see
  // recentFormEligibleRoster) — this view answers "who's available right
  // now."
  const rosterMetaById = new Map(
    [...fullRoster, ...roster]
      .filter((r) => r.person?.id)
      .map((r) => {
        const isPitcher = r.position?.type === 'Pitcher' || isTwoWay(r.person)
        return [
          r.person.id,
          {
            id: r.person.id,
            name: firstLast(r.person),
            last: lastName(r.person),
            jersey: r.jerseyNumber ?? '',
            allStar: allStarIds.has(r.person.id),
            war: sportId === 1 ? (isPitcher ? warPit[r.person.id] : warBat[r.person.id]) ?? null : undefined,
            prospect: prospectBadge(prospectsSnapshot, r.person.id, currentOrgId),
            rookie: showRookiePill(rookiesData, r.person.id, sportId === 1),
          },
        ]
      }),
  )
  const eligibleRoster = recentFormEligibleRoster(roster, fullRoster, currentInjuredIds)
  const recentFormGames = await fetchRecentFormGames(schedule)
  const recentForm = buildRecentForm(recentFormGames, eligibleRoster)
  const recentPreferredLineup = recentForm.preferredLineupIds
    .map(({ position, id }) => {
      const meta = rosterMetaById.get(id)
      return meta ? { position, id, last: meta.last, name: meta.name } : null
    })
    .filter(Boolean)
  const recentSubstitutes = recentForm.substituteIds.map((id) => rosterMetaById.get(id)).filter(Boolean)

  // Pitchers who threw not one pitch in the window — infer a role from
  // whatever's on file (this season's MLB line first, else a live AAA
  // lookup) rather than dropping them from the projection.
  const pitcherStatById = new Map(fullPitchers.map((p) => [p.id, p]))
  const appearedPitcherIds = new Set(recentForm.pitcherAppearanceIds)
  const silentPitchers = eligibleRoster.filter(
    (r) =>
      r.person?.id &&
      (r.position?.type === 'Pitcher' || isTwoWay(r.person)) &&
      !appearedPitcherIds.has(r.person.id),
  )
  const inferredRoles = await Promise.all(
    silentPitchers.map(async (r) => {
      const pid = r.person.id
      const mlbStat = pitcherStatById.get(pid)
      if (mlbStat?.appearances > 0) {
        return { id: pid, role: roleFromCounts(mlbStat.gs, mlbStat.appearances, mlbStat.saves) }
      }
      const splits = await fetchPersonStats(pid, {
        type: 'season', group: 'pitching', season, sportId: SPORT_IDS.AAA,
      })
      const stat = splits[0]?.stat
      if (!stat) return { id: pid, role: null }
      return {
        id: pid,
        role: roleFromCounts(stat.gamesStarted, stat.gamesPitched ?? stat.gamesPlayed, stat.saves),
      }
    }),
  )
  const recentStartingPitchers = recentForm.startingPitcherIds.map((id) => rosterMetaById.get(id)).filter(Boolean)
  const recentBullpen = recentForm.bullpenIds.map((id) => rosterMetaById.get(id)).filter(Boolean)
  for (const { id: pid, role } of inferredRoles) {
    const meta = rosterMetaById.get(pid)
    if (!meta) continue
    if (role === 'SP' && recentStartingPitchers.length < 5) recentStartingPitchers.push(meta)
    else if ((role === 'RP' || role === 'CL') && recentBullpen.length < 8) recentBullpen.push(meta)
  }

  return {
    team,
    season,
    sportId,
    isMilb,
    position,
    pitchers,
    injured,
    preferredLineup,
    substitutes,
    startingPitchers,
    bullpen,
    recentPreferredLineup,
    recentSubstitutes,
    recentStartingPitchers,
    recentBullpen,
  }
}
