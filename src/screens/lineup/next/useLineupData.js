import { useMemo } from 'react'
import {
  selectBirthdayIds,
  selectBullpen,
  selectGameInfo,
  selectGameSeason,
  selectHasStarted,
  selectLineup,
  selectOpposingDefense,
  selectOpposingPitcher,
  selectTeamMeta,
  lastFirst,
} from '../../../api/select.js'
import { selectRecordIsClosed } from '../../../api/gamerecord/played.js'
import { fetchTeam, fetchTeamRoster } from '../../../api/team.js'
import { POS_ORDER, splitDisplayName } from '../../../api/person.js'
import { arsenalSidesView, arsenalTtoView, fetchPitchArsenalFor, pitchArsenalFor } from '../../../api/pitchArsenal.js'
import { fetchHitterEntryLines } from '../../../api/player/hitterEntryLines.js'
import { splitMatchupRows, starterMatchupsFor } from '../../../api/careerMatchups.js'
import { formerTeammatePairs, orgTiesFor } from '../../../api/formerTeammates.js'
import { projectFromLiveLogs } from '../../../api/rotation/liveStarters.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { teamAbbr } from '../../../lib/teams.js'

// The team's active roster pared to batters, for the pregame fallback when no lineup has
// posted. Roster entries come from the plain /roster endpoint, so names fall back to fullName.
export function rosterFallbackGroups(roster) {
  return (roster ?? [])
    .filter((r) => r.position?.type !== 'Pitcher')
    .map((r) => ({
      id: r.person?.id,
      name: lastFirst(r.person),
      jersey: r.jerseyNumber ?? '',
      pos: r.position?.abbreviation ?? '',
    }))
    .sort((a, b) => (POS_ORDER[a.pos] ?? 5) - (POS_ORDER[b.pos] ?? 5) || a.name.localeCompare(b.name))
}

// The ids of everyone in tonight's two starting lineups plus both probable starters: a
// former-teammate pair who are about to face each other is pinned by it. Spoiler-free.
export function startingIdsFor(feed) {
  const ids = new Set()
  for (const side of ['away', 'home']) {
    for (const p of selectLineup(feed, side)) ids.add(p.id)
    const pitcher = selectTeamMeta(feed, side, { includeDerivedStarter: true }).probablePitcher
    if (pitcher?.id) ids.add(pitcher.id)
  }
  return ids
}

// Everything the new lineup page's cards read for one side of one game. A port of the live
// page's TeamSections derivations (screens/TeamInfo.jsx) that deletes it in the swap. The
// spoiler footing is the live page's: hitter lines end the day before the game (ADR-0088),
// the starter's lines come in `oppPitcherLine` already cut off, and nothing here reads a
// score.
export function useLineupData({ feed, side, vsTeam, careerMatchupsData, workloadData, formerTeammatesData, oppPitcherLine }) {
  const oppSide = side === 'away' ? 'home' : 'away'
  const meta = useMemo(() => selectTeamMeta(feed, side), [feed, side])
  const oppMeta = useMemo(() => selectTeamMeta(feed, oppSide), [feed, oppSide])
  const info = useMemo(() => selectGameInfo(feed), [feed])
  const season = selectGameSeason(feed)
  const isMlb = (meta.sportId ?? 1) === 1
  const closed = selectRecordIsClosed(feed)
  const lineup = useMemo(() => selectLineup(feed, side), [feed, side])
  const birthdayIds = useMemo(() => selectBirthdayIds(feed), [feed])
  const oppPitcher = useMemo(() => selectOpposingPitcher(feed, side, { includeDerivedStarter: true }), [feed, side])
  const oppDefense = useMemo(() => selectOpposingDefense(feed, side), [feed, side])
  const oppBullpenArms = useMemo(() => selectBullpen(feed, oppSide), [feed, oppSide])

  // The parent org of each club, so a prospect badge is checked against the roster the
  // player is on today (prospectBadge, api/prospects.js).
  const { data: teamIdentity } = useAsync(() => fetchTeam(meta.id), [meta.id])
  const { data: oppTeamIdentity } = useAsync(() => fetchTeam(oppMeta.id), [oppMeta.id])
  const orgTeamId = teamIdentity?.parentOrgId ?? meta.id
  const oppOrgTeamId = oppTeamIdentity?.parentOrgId ?? oppMeta.id

  // His whole career line against this club: MLB only, a lookup in the shard already loaded.
  const careerVsOpp = useMemo(
    () => (isMlb ? vsTeam?.players?.[oppPitcher?.id]?.vs?.[String(meta.id)]?.car ?? null : null),
    [isMlb, vsTeam, oppPitcher?.id, meta.id],
  )
  const vsOpponentAbbr = teamAbbr({ id: meta.id, teamName: meta.teamName, name: meta.name })

  // His season pitch mix, and the same mix by times through the order and by batter side.
  const { data: arsenalShard } = useAsync(
    () => fetchPitchArsenalFor(oppPitcher?.id, { seasonYear: season }),
    [oppPitcher?.id, season],
  )
  const arsenal = useMemo(() => pitchArsenalFor(arsenalShard, oppPitcher?.id, isMlb), [arsenalShard, oppPitcher?.id, isMlb])
  const arsenalTto = useMemo(() => arsenalTtoView(arsenalShard, oppPitcher?.id, isMlb), [arsenalShard, oppPitcher?.id, isMlb])
  const arsenalSides = useMemo(() => arsenalSidesView(arsenalShard, oppPitcher?.id, isMlb), [arsenalShard, oppPitcher?.id, isMlb])

  // The bullpen board describes "now": it shows only within three days of the file's date.
  const boardGameDate = useMemo(() => {
    const d = info.officialDate || null
    const asOf = workloadData?.asOf ?? null
    if (!d || !asOf) return null
    const diff = Math.abs(new Date(`${d}T00:00:00Z`) - new Date(`${asOf}T00:00:00Z`))
    return diff <= 3 * 86400000 ? d : null
  }, [info.officialDate, workloadData])
  // No probable announced and the game not started: likely starters from rest days.
  const wantsProjection = !oppPitcher && !selectHasStarted(feed) && Boolean(workloadData && boardGameDate)
  const { data: projectedStarters } = useAsync(
    () => (wantsProjection ? projectFromLiveLogs(workloadData, oppMeta.id, boardGameDate) : Promise.resolve([])),
    [wantsProjection, workloadData, oppMeta.id, boardGameDate],
  )

  const teammatePairs = useMemo(() => formerTeammatePairs(formerTeammatesData, meta.id, oppMeta.id), [formerTeammatesData, meta.id, oppMeta.id])
  const orgTies = useMemo(() => orgTiesFor(formerTeammatesData, meta.id, oppMeta.id), [formerTeammatesData, meta.id, oppMeta.id])
  const startingIds = useMemo(() => startingIdsFor(feed), [feed])

  // This club's batters against the arm they face; keyed by gamePk for doubleheaders.
  const starterMatchups = useMemo(() => starterMatchupsFor(careerMatchupsData, feed?.gamePk, meta.id), [careerMatchupsData, feed?.gamePk, meta.id])
  const matchups = useMemo(() => splitMatchupRows(starterMatchups, new Set(lineup.map((p) => p.id))), [starterMatchups, lineup])
  const starterLast = useMemo(() => (starterMatchups ? splitDisplayName(starterMatchups.pitcher.name).last : ''), [starterMatchups])

  // The pregame roster, fetched only while no lineup is posted on a game still to come.
  const needsRoster = lineup.length === 0 && !closed
  const { data: rawRoster } = useAsync(
    () => (needsRoster && meta.id && season ? fetchTeamRoster(meta.id, season, { sportId: meta.sportId ?? 1 }) : Promise.resolve([])),
    [needsRoster, meta.id, meta.sportId, season],
  )
  const roster = useMemo(() => rosterFallbackGroups(rawRoster), [rawRoster])

  // The season lines of the nine (or the roster), ending the day before the game.
  const hitterIds = useMemo(() => (lineup.length ? lineup.map((p) => p.id) : roster.map((p) => p.id)).join(','), [lineup, roster])
  const { data: hitterLines } = useAsync(
    () => (hitterIds ? fetchHitterEntryLines(hitterIds.split(','), season, info.officialDate, meta.sportId ?? 1) : Promise.resolve({})),
    [hitterIds, season, info.officialDate, meta.sportId],
  )

  // Which side a hitter bats from (L, R or S), from the game's player table.
  const batsOf = (id) => feed?.gameData?.players?.[`ID${id}`]?.batSide?.code ?? ''

  return {
    batsOf, meta, oppMeta, info, season, isMlb, closed, lineup, birthdayIds, oppPitcher, oppDefense, oppBullpenArms,
    orgTeamId, oppOrgTeamId, careerVsOpp, vsOpponentAbbr, oppPitcherLine,
    arsenal, arsenalTto, arsenalSides, boardGameDate, projectedStarters,
    teammatePairs, orgTies, startingIds, matchups, starterLast, roster, hitterLines: hitterLines ?? {},
  }
}
