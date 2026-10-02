// Postseason SITUATIONAL RECORDS — the regular-season Situational Records
// page's records, over the MLB postseason instead: one split at a time with
// every postseason club ranked (the league view), or one club down its whole
// list of splits (the team view), for one postseason or for all of them since
// 1995.
//
// It computes nothing new. The ledger gen-postseason-records.mjs writes has the
// regular-season row shape, so teamRecords.js's `teamRecordsFor` tallies it and
// situationalRecordRankings.js pivots it, exactly as for a level of 30 clubs.
// This module only does what is particular to the postseason:
//
//   1. Read the per-season files (`/data/postseason-records/{season}.json`, all
//      clubs in one file) and hand back the `{ team, data }` entries the
//      pivot expects — one season, or every season merged per club.
//   2. Mark the entry `postseason: true`, which is the switch teamRecordsFor and
//      buildRankingIndex read: no by-month table, no season counts, and a
//      "vs. own league / other league" row off each game's `il` flag.
//   3. Answer the team view: one club's every split with its rank among the
//      postseason clubs that have played it.
//
// SPOILER-FREE on teamRecords.js's footing, and cutoff-gated for the same
// reason: the files hold Final games only, but `cutoff` defaults to null, so the
// safety is the date the CALLER asks for. An open surface by rule (ADR-0034).

import { staticJson, staticJsonBy } from '../staticJson.js'
import { fetchStaticTeams } from '../teams-static.js'
import { rankMetric } from '../situationalRecordRankings.js'

export const ALL_SEASONS = 'all'

const fetchIndex = staticJson('/data/postseason-records/index.json', { fallback: null })
// staticJsonBy memoizes on String(key); the key is the season.
const fetchSeason = staticJsonBy((season) => `/data/postseason-records/${season}.json`, { fallback: null })

// The seasons on file, oldest first. Empty when the index is unreachable, and
// the page then says there is nothing on file rather than guessing a year.
export async function fetchPostseasonSeasons() {
  const index = await fetchIndex()
  return [...(index?.seasons ?? [])].sort((a, b) => a - b)
}

// Reads a `?season=` value: a year on file, `all`, or nothing (the latest).
// Anything else falls back to the latest, the stance every param here takes.
export function resolveSeason(value, seasons) {
  if (value === ALL_SEASONS) return ALL_SEASONS
  const year = Number(value)
  if (seasons.includes(year)) return year
  return seasons.at(-1) ?? null
}

// The minimum-games chips the all-years board offers. 0 is "any".
export const MIN_GAMES = [0, 3, 5, 10]

// Reads a `?min=` value. Only the all-years board takes one: a single
// postseason is already a handful of games a club, so a floor there would just
// hide clubs. Anything off the menu is "any".
export function resolveMinGames(value, season) {
  const n = Number(value)
  return season === ALL_SEASONS && MIN_GAMES.includes(n) ? n : 0
}

// Every postseason club's ledger for one season, or for all of them merged per
// club (dates ascend across seasons, which is the order teamRecordsFor's
// series counting walks). A club with no postseason game in the span is
// absent: ranking thirty clubs where eighteen never played misreports the field.
export async function fetchPostseasonEntries(season, seasons) {
  const wanted = season === ALL_SEASONS ? seasons : [season]
  const [teams, files] = await Promise.all([
    fetchStaticTeams().then((t) => t.bySportId?.['1'] ?? []),
    Promise.all(wanted.map((s) => fetchSeason(s))),
  ])
  return entriesFrom(teams, files)
}

// The pure half: `teams` is the MLB club list, `files` the season files, oldest
// first. Split out so the merge is testable without a network.
export function entriesFrom(teams, files) {
  const games = new Map()
  for (const file of files) {
    for (const club of Object.values(file?.clubs ?? {})) {
      if (!games.has(club.teamId)) games.set(club.teamId, [])
      games.get(club.teamId).push(...club.games)
    }
  }
  return teams
    .filter((team) => games.get(team.id)?.length)
    .map((team) => ({
      team,
      data: { teamId: team.id, sportId: 1, postseason: true, allStarDate: null, games: games.get(team.id) },
    }))
}

// The postseason records of ONE club, with its rank in each split: the team
// view. `index` is buildRankingIndex's result over the same entries and the same
// cutoff, so a row's figure and its rank come from one tally. A split the club
// has never been in is absent (teamRecordsFor drops it), and a split only it has
// played ranks 1 of 1, which is the true answer.
//
// Returns [{ title, rows: [{ id, k, v, pct, played, rank, tied, of, last }] }]
// in the print order the league view uses, or null when the club has no
// postseason game in the span.
export function teamRankRows(index, teamId, { sortBy = 'pct', minPlayed = 0 } = {}) {
  if (!index.teams.some((t) => t.id === teamId)) return null
  const groups = []
  for (const group of index.groups) {
    const rows = []
    for (const metric of group.metrics) {
      const result = rankMetric(index, metric.id, { sortBy, minPlayed })
      const mine = result?.ranked.find((r) => r.teamId === teamId)
      if (!mine || !mine.played) continue
      rows.push({
        id: metric.id,
        k: metric.k,
        v: mine.v,
        pct: mine.pct,
        played: mine.played,
        rank: mine.rank,
        tied: mine.tied,
        of: result.of,
        last: mine.last,
      })
    }
    if (rows.length) groups.push({ title: group.title, rows })
  }
  return groups
}
