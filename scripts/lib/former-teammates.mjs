// The testable half of scripts/gen-former-teammates.mjs (issue #1171). A
// generator RUNS on import, so the unit suite cannot reach its body; these are
// the decisions in it that a run's console output would not show to be wrong:
//
//   - which scheduled games get a shard at all (winter ball in, the sportId 17
//     leagues that do not ship out),
//   - which career stints can make two players "teammates" (a winter club
//     never can — it is a few weeks of play, not a season),
//   - whether the org-ties fallback applies (never to a winter club, whose
//     "parent org" is the Commissioner's Office),
//   - how many rows one shard may carry (the 40 KB hot-path ceiling).
//
// test/former-teammates.test.js pins all four. Pure: no fetching.
import { meetsStintCap } from '../../src/api/rehab-policy.js'
import { WINTER_LEAGUE_IDS, WINTER_SPORT_ID, isWinterSport } from '../../src/lib/winter/leagues.js'

// MiLB levels, high to low (AAA/AA/A+/A). Rookie/complex ball (16) is left out:
// its huge, churny short-season rosters would match half a level as
// "teammates". A copy of src/lib/teams.js's list, minus rookie ball.
export const MILB_SPORT_IDS = [11, 12, 13, 14]

// The levels a career stint can come from and still count as a shared
// (team, season). MLB plus the four full-season MiLB levels — and NOT winter
// ball: two players on the same Arizona Fall League club for six weeks were
// not "teammates" the way two players on a 140-game Double-A roster were.
export const CAREER_SPORT_IDS = [1, ...MILB_SPORT_IDS]

// The sport ids swept for matchups: every career level plus winter ball, so a
// winter game gets a card built from its players' MLB and MiLB careers.
export const MATCHUP_SPORT_IDS = [...CAREER_SPORT_IDS, WINTER_SPORT_ID]

export const SPORT_LABEL = { 1: 'MLB', 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A', 16: 'ROK' }

// Does a game from `schedule?sportId={sportId}&hydrate=team` get a shard?
// Every MLB/MiLB game does. A sportId 17 schedule also returns Liga Roberto
// Clemente (133) and the Australian league (595), which the app does not ship
// (src/lib/winter/leagues.js has the reasons), so a winter game counts only
// when its home club's league is one of the four that ship.
export function isShippedGame(sportId, game) {
  if (!isWinterSport(sportId)) return true
  const leagueId = game?.teams?.home?.team?.league?.id
  return WINTER_LEAGUE_IDS.includes(Number(leagueId))
}

// The year-by-year requests one player's career needs: hitting and pitching at
// each career level. One request per level, because the API silently returns
// nothing for a comma-list of sportIds (see src/api/person-fetch.js).
export function careerRequests() {
  const requests = []
  for (const group of ['hitting', 'pitching']) {
    for (const sportId of CAREER_SPORT_IDS) requests.push({ group, sportId })
  }
  return requests
}

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

// A player's career reduced to a Set of "teamId|season" strings, plus a
// club-label lookup (teamId -> { name, level, sportId }) for the shared-team
// caption and a games-played lookup ("teamId|season" -> gamesPlayed) for the
// overlap-confidence term in stintScore. `results` is one entry per
// careerRequests() request, in order: { request, splits } or null when that
// request failed.
//
// The synthetic team-less aggregate split a mid-season trade produces has no
// team.id and is skipped, so BOTH real clubs of a trade are kept. A split from
// any level outside CAREER_SPORT_IDS is dropped, whatever request brought it
// back, so a winter stint can never enter the set. Post-debut minor-league
// seasons below REHAB_CAP are dropped (rehab/shuttle noise, see
// src/api/rehab-policy.js).
export function reduceCareer(results, debutYear) {
  const pairs = new Set()
  const clubs = new Map()
  const games = new Map()
  for (const result of results) {
    if (!result) continue
    const { group, sportId: requested } = result.request
    for (const s of result.splits ?? []) {
      const sportId = s.sport?.id ?? requested
      if (!CAREER_SPORT_IDS.includes(sportId)) continue
      const teamId = s.team?.id
      const season = Number(s.season)
      if (!teamId || !season) continue
      if (sportId !== 1 && debutYear && season > debutYear && !meetsStintCap(s.stat, group)) {
        continue
      }
      const key = `${teamId}|${season}`
      pairs.add(key)
      const gp = num(s.stat?.gamesPlayed)
      if (!games.has(key) || gp > games.get(key)) games.set(key, gp)
      if (!clubs.has(teamId)) {
        clubs.set(teamId, { name: s.team?.name ?? '', level: SPORT_LABEL[sportId] ?? '', sportId })
      }
    }
  }
  return { pairs, clubs, games }
}

// Org ties ("he came up through the Brewers, and Nashville is a Brewers
// affiliate") need each club's MLB parent org. A winter club has none: the team
// endpoint reports parentOrgId 11, "Office of the Commissioner", for every one
// of them. Two winter clubs would then share org 11 and computeOrgTies would
// return [] by accident, and a winter club against anything else would say a
// player "has a history in the Office of the Commissioner". So the fallback is
// off, on purpose, whenever either club is a winter club.
export function orgTiesApply(awaySportId, homeSportId) {
  return !isWinterSport(awaySportId) && !isWinterSport(homeSportId)
}

// The most rows one matchup's shard may carry. test/hot-path-shards.test.js
// holds every shard under 40 KB; at about 220 bytes a row, 100 rows is about
// 22 KB. The card shows five before "show all", so the cap only trims the tail
// of a very large matchup — a Dominican winter game between two 60-man rosters
// can have 170 pairs, most of them low-score minor-league cameos. It applies to
// every level, not only to winter ball.
export const MAX_ROWS_PER_MATCHUP = 100

// The top `max` rows by score. Sorts a copy, so it does not depend on the
// caller having sorted already.
export function capRows(rows, max = MAX_ROWS_PER_MATCHUP) {
  return [...rows].sort((x, y) => y.score - x.score).slice(0, max)
}
