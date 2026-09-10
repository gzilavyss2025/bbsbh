// The player page's SPLITS VS TEAM card data — for each MLB player, his career
// regular-season line against every club he's faced plus the last meeting's stat
// line — read from static same-origin files under public/data/vs-team-splits/
// rather than computed live.
//
// Building it can't be done cheaply on a page load: the API's vs-team split
// types carry no game granularity, so getting BOTH the career totals AND the
// most-recent meeting's line means sweeping a player's whole MLB game log season
// by season (one request per season) — dozens per veteran. Past game logs are
// immutable, so scripts/gen-vs-team-splits.mjs precomputes it on a cron (see
// .github/workflows/update-nightly-data.yml) and this module just reads it.
// Same build-time-fetch pattern as war.js / former-teammates.js (see
// docs/data-enrichment.md §5).
//
// SHARDED BY THE PLAYER'S OWN CLUB. The dataset was one 3.2 MB file, and every
// game page downloaded and parsed all of it — 30 clubs' rosters — to print one
// line about two of them. It is now one small index plus one file per club:
//
//   /data/vs-team-splits/index.json   { generatedAt, season, teams,
//                                       nextOpponent, owner: {personId: teamId} }
//   /data/vs-team-splits/{teamId}.json  { players: {personId: {teamId, group, vs}} }
//
// The shard key is the club the player was on at generation time, because that
// is exactly how the data is asked for: a game needs the two clubs playing
// (~220 KB), and a player page needs one club (`owner` resolves which). The
// merged result keeps the ORIGINAL whole-file shape, so every pure consumer
// below and in callout-notes/vsTeamNote.js is unchanged.
//
// Spoiler note: the player page is a spoiler-FREE surface (it shows open game
// logs and season splits), so career-vs-club totals belong here just like the
// "Season splits" card. The one score-revealing element is the last-game line —
// a specific past game's result — so the card gates it against the page's `asOf`
// cutoff the same way the game log does (see SplitsVsTeam.jsx), never surfacing
// a meeting on or after the day of a game you're actively scoring.
//
// Degrades to null before the files exist or on any failure — the card simply
// doesn't render. Cached in-memory for the session (the files change once a day).

import { staticJson, staticJsonBy } from './staticJson.js'

// The shared header: the club catalog, each club's next opponent, and the
// personId -> club map that says which shard holds a given player.
export const fetchVsTeamSplitsIndex = staticJson('/data/vs-team-splits/index.json')

const fetchShard = staticJsonBy((teamId) => `/data/vs-team-splits/${teamId}.json`)

// Merge the index header with the named clubs' shards, producing the same shape
// the single file used to have: { generatedAt, season, teams, nextOpponent,
// players }. Null when the index itself is missing (nothing can be shown).
async function merge(teamIds) {
  const index = await fetchVsTeamSplitsIndex()
  if (!index) return null
  const shards = await Promise.all([...new Set(teamIds.filter(Boolean).map(String))].map(fetchShard))
  const players = {}
  for (const shard of shards) Object.assign(players, shard?.players ?? {})
  return {
    generatedAt: index.generatedAt ?? null,
    season: index.season ?? null,
    teams: index.teams ?? [],
    nextOpponent: index.nextOpponent ?? {},
    players,
  }
}

// The two clubs in a game (see useGameData.js) — the vs-opponent callout reads
// `players[personId].vs[oppTeamId]` off the result.
export function fetchVsTeamSplitsForTeams(teamIds) {
  return merge(teamIds)
}

// One player (the player page). His shard is whichever club the last generator
// run had him on, which the index's `owner` map records.
export async function fetchVsTeamSplitsForPlayer(personId) {
  const index = await fetchVsTeamSplitsIndex()
  if (!index) return null
  const teamId = index.owner?.[String(personId)] ?? null
  return merge(teamId ? [teamId] : [])
}

// The SPLITS VS TEAM view model for one player, or null when he isn't in the
// file (a non-MLB player, or one who's dropped off every active roster). Shapes:
//   { group, teamId,                                  // the player's own club
//     preselectId,                                    // opponent to open on
//     teams: [{ id, abbr, name, has }] }              // strip, own club dropped
// The per-opponent stat rows stay in `byOpp` for the component to read on select.
// The career line as ONE sentence — "Career vs MIL: 7 G, 34.0 IP, 3.44 ERA,
// 28 K, 17 BB" for an arm, "Career vs CHC: 96 G, 412 PA, .284, 14 HR, .812
// OPS" for a bat. Two surfaces print it and both open the same Box Lines sheet
// behind it (ADR-0069): the lineup page's Starting pitcher card and the player
// page's Splits vs team card, whose stat grid spells the same figures out in
// cells. One function so the two can never word it differently — the sheet
// quotes the door's label verbatim as its headline, so a drift would show up
// as the door and the sheet disagreeing.
//
// "G", not "GS": the generator sums gamesPlayed, and a relief outing counts.
// The rows behind the line show each one, so the label has to say what the
// number is. The batting average carries no key of its own — a leading-dot
// figure in a career line is read as an average everywhere in baseball, and
// the grid above the door on the player page labels it AVG.
export function vsTeamDoorLabel(car, group, oppAbbr) {
  const stat =
    group === 'pitching'
      ? `${car.g} G, ${car.ip} IP, ${car.era} ERA, ${car.k} K, ${car.bb} BB`
      : `${car.g} G, ${car.pa} PA, ${car.avg}, ${car.hr} HR, ${car.ops} OPS`
  return `Career vs ${oppAbbr}: ${stat}`
}

export function vsTeamSplitsFor(data, personId) {
  const player = data?.players?.[personId]
  if (!player || !player.vs) return null
  const teams = data.teams ?? []
  const byOpp = player.vs

  // The selectable strip: every MLB club except the player's own, each flagged
  // with whether he has any career meetings (drives the grayed-out treatment).
  const strip = teams
    .filter((t) => t.id !== player.teamId)
    .map((t) => ({ id: t.id, abbr: t.abbr, name: t.name, has: Boolean(byOpp[String(t.id)]) }))

  // Pre-select his club's next opponent when it's a club he's faced; otherwise
  // fall back to the most-faced club he has data for, so the card never opens
  // empty when there's anything to show.
  const nextId = data.nextOpponent?.[String(player.teamId)] ?? null
  let preselectId = nextId
  if (!preselectId || !byOpp[String(preselectId)]) {
    const faced = strip.filter((t) => t.has)
    preselectId = faced.length
      ? faced.reduce((best, t) =>
          (byOpp[String(t.id)]?.car?.g ?? 0) > (byOpp[String(best.id)]?.car?.g ?? 0) ? t : best,
        ).id
      : strip[0]?.id ?? null
  }

  return { group: player.group, teamId: player.teamId, preselectId, teams: strip, byOpp }
}
