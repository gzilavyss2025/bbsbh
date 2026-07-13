// Schedule/slate fetchers, plus resolving a deep-link (date + away/home
// abbreviation slug) back to a game. See api/statsapi.js for the shared
// fetch wrapper and its field-path verification note.

import { SEARCHABLE_SPORT_IDS, SPORT_LABEL, teamAbbr } from '../lib/teams.js'
import { matchupSlug } from '../lib/route.js'
import { getJson } from './statsapi.js'
import { fetchStaticTeams } from './teams-static.js'

// Normalize a raw schedule game into the shape our cards need.
function normalizeGame(game, sportId) {
  const away = game.teams?.away
  const home = game.teams?.home
  return {
    gamePk: game.gamePk,
    sportId,
    sportLabel: SPORT_LABEL[sportId] ?? '',
    gameDate: game.gameDate,
    // 1 except for the second game of a doubleheader (2) — disambiguates the
    // matchup slug, since both games share a date and team pair.
    gameNumber: game.gameNumber ?? 1,
    // 'N' = single game; 'Y'/'S' = part of a doubleheader (regular or split).
    // Lets a card label itself "Game 1 / Game 2" (gameNumber alone can't tell a
    // lone game from game 1 of a twin bill — both carry gameNumber 1).
    doubleHeader: game.doubleHeader ?? 'N',
    // Status codes: 'S'/'P' pre-game, 'I' in-progress, 'F'/'O' final.
    statusCode: game.status?.statusCode,
    detailedState: game.status?.detailedState,
    abstractState: game.status?.abstractGameState,
    // Free-text delay/postponement cause ("Rain", "Field conditions"), when
    // MLB supplies one. Feeds selectGameStatus's delayed/suspended banner.
    reason: game.status?.reason,
    // When a postponed game has already been rescheduled, MLB carries the new
    // date on the ORIGINAL date's row (rescheduleGameDate 'YYYY-MM-DD' + the
    // full rescheduleDate ISO). Spoiler-free — a make-up date, never a score —
    // so the postponed card can tell you when the game moved to. Both absent
    // until the league sets a make-up (a fresh postponement shows no date yet).
    rescheduleDate: game.rescheduleDate,
    rescheduleGameDate: game.rescheduleGameDate,
    away: {
      id: away?.team?.id,
      name: away?.team?.name,
      teamName: away?.team?.teamName ?? away?.team?.name,
      abbreviation: teamAbbr(away?.team),
    },
    home: {
      id: home?.team?.id,
      name: home?.team?.name,
      teamName: home?.team?.teamName ?? home?.team?.name,
      abbreviation: teamAbbr(home?.team),
    },
    // Venue timezone (from hydrate=venue(timezone)) so the card can print the
    // start time in the PARK's local clock, not the viewer's — a Dodgers home
    // game reads "7:10 PDT" for everyone. `tz` is the abbreviation to append;
    // `tzId` is the IANA zone Intl formats in. Both degrade to '' on lean feeds
    // (the card then falls back to the viewer's local time, unlabeled).
    venue: {
      id: game.venue?.id,
      tz: game.venue?.timeZone?.tz ?? '',
      tzId: game.venue?.timeZone?.id ?? '',
    },
    // Scorebook-readiness flags (spoiler-free — none of these reveal a score),
    // hydrated onto the slate so a card can show at a glance whether the basics
    // you'd pencil in pre-game are posted yet. All degrade to `false` when the
    // hydration is absent (common for MiLB / far-out games).
    readiness: {
      awayLineup: (game.lineups?.awayPlayers?.length ?? 0) >= 9,
      homeLineup: (game.lineups?.homePlayers?.length ?? 0) >= 9,
      umpires: (game.officials?.length ?? 0) > 0,
      pitchers: Boolean(away?.probablePitcher?.id && home?.probablePitcher?.id),
    },
  }
}

// Today's MLB slate (or any single sportId for a given date). `hydrate=team`
// pulls the full team object into each side so we get abbreviation + teamName
// (the bare schedule row only carries id/name) — needed for the level cards and
// the deep-link matchup slug. `lineups,officials,probablePitcher` add the
// scorebook-readiness signals the cards surface (see normalizeGame) in the same
// request — all spoiler-free. Callers that only need to RESOLVE a game (see
// resolveGame) pass a lighter hydrate to skip the readiness payload.
export async function fetchSchedule(
  dateStr,
  sportId = 1,
  hydrate = 'team,venue(timezone),lineups,officials,probablePitcher',
) {
  const data = await getJson(
    `/api/v1/schedule?sportId=${sportId}&date=${dateStr}&hydrate=${hydrate}`,
  )
  const dates = data.dates ?? []
  const games = dates.flatMap((d) => d.games ?? [])
  return games.map((g) => normalizeGame(g, sportId))
}

// The season's All-Star break bounds, for the slate's empty-day treatment
// (GameSelect): `allStarDate` is the All-Star Game's own date (which DOES show
// up as a normal-looking schedule row, teams "AL/NL All-Stars" — real logos,
// real abbreviations, so it needs no special handling); the Home Run Derby
// falls the evening before it, and the break runs through the day before
// `firstDate2ndHalf` resumes. Deliberately not a hardcoded date list — this
// endpoint gives the exact bounds every season. There's no statsapi endpoint
// for the Derby itself (verified live — it's not a schedulable game or
// event), so this only supports a static "Derby's tonight" pointer, never a
// live score. MLB-only; degrades to null on failure or a lean/missing season row.
export async function fetchAllStarInfo(season) {
  if (!season) return null
  try {
    const data = await getJson(`/api/v1/seasons/${season}?sportId=1`)
    const s = data.seasons?.[0]
    if (!s?.allStarDate || !s?.firstDate2ndHalf) return null
    return { allStarDate: s.allStarDate, firstDate2ndHalf: s.firstDate2ndHalf }
  } catch {
    return null
  }
}

// Every active club at a level, independent of any date's schedule — used by
// the logo sheet's level browser so it can show a league's full set of marks
// rather than just the teams playing today, and by the footer's team
// directory (see search.js's fetchTeamDirectory) for cross-level name search.
// Team identity barely ever changes mid-season, so this reads the static
// weekly snapshot (see teams-static.js) first and only falls back to the live
// endpoint if that file is missing, unparseable, or lacks this sportId.
export async function fetchTeams(sportId) {
  const staticTeams = await fetchStaticTeams()
  const bucket = staticTeams?.bySportId?.[sportId]
  if (bucket) {
    return bucket
      .map((t) => ({ id: t.id, name: t.name, sportId, abbreviation: teamAbbr(t) }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }
  const data = await getJson(`/api/v1/teams?sportId=${sportId}&activeStatus=Y`)
  const teams = data.teams ?? []
  return teams
    .filter((t) => t.active)
    .map((t) => ({ id: t.id, name: t.name, sportId, abbreviation: teamAbbr(t) }))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
}

// Resolve a deep-link (date + away/home abbreviation slug) back to a game by
// scanning that date's slate across every level. Used on cold loads / shared
// links, where we don't already hold the game object from the slate. Only
// hydrate=team here — resolution needs abbreviations alone, and the readiness
// payload (lineups/officials/pitchers for every game at five levels) would be
// downloaded just to be thrown away. The caller immediately fetches the full
// feed anyway. If EVERY level failed, surface a network error (distinct from
// "no such game") so the UI can offer a retry instead of gaslighting the user
// about the schedule; partial failures keep degrading gracefully per MiLB
// convention.
export async function resolveGame(apiDate, matchup) {
  const results = await Promise.allSettled(
    SEARCHABLE_SPORT_IDS.map((sportId) =>
      fetchSchedule(apiDate, sportId, 'team'),
    ),
  )
  if (results.every((r) => r.status === 'rejected')) {
    throw new Error('Schedule unreachable')
  }
  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  const want = matchup.toLowerCase()
  return (
    all.find(
      (g) =>
        matchupSlug(g.away.abbreviation, g.home.abbreviation, g.gameNumber) ===
        want,
    ) ?? null
  )
}

// Resolve a set of gamePks to the bits a boxscore deep-link needs — official
// date, both clubs' abbreviations, and the doubleheader game number — in ONE
// batched schedule request (the endpoint takes a comma-separated gamePks list).
// Used by the player page to point the MLB-debut fact and each game-log row at
// that game's (sealed) box score via the normal /{date}/{matchup}/boxscore
// route, so no gamePk-based route is needed. Degrades to {} so a row that can't
// be resolved just renders as plain, un-linked text.
export async function fetchGamesByPk(gamePks) {
  const list = [...new Set((gamePks ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(
      `/api/v1/schedule?gamePks=${list.join(',')}&hydrate=team`,
    )
    const out = {}
    for (const d of data.dates ?? []) {
      for (const g of d.games ?? []) {
        out[g.gamePk] = {
          apiDate: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
          awayAbbr: teamAbbr(g.teams?.away?.team),
          homeAbbr: teamAbbr(g.teams?.home?.team),
          awayId: g.teams?.away?.team?.id ?? null,
          homeId: g.teams?.home?.team?.id ?? null,
          gameNumber: g.gameNumber ?? 1,
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

// Resolve a set of gamePks to full, GameCard-ready game objects — same shape
// as a normal slate row (fetchSchedule), for a CROSS-DATE list like the Top
// Games page, where each card carries its own team identity/level rather
// than inheriting one date's sportId like the ordinary slate does. One
// batched request (same endpoint/hydrate as fetchGamesByPk above), reusing
// normalizeGame so a Top Games card can never drift from an ordinary slate
// card's shape. `officialDate` rides alongside for the card's date banner
// (GameCard's `dateLabel` prop) — normalizeGame's own `gameDate` is a full
// ISO timestamp, not a calendar day. Degrades to {} on failure.
export async function fetchGameCardsByPk(gamePks) {
  const list = [...new Set((gamePks ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(
      `/api/v1/schedule?gamePks=${list.join(',')}&hydrate=team`,
    )
    const out = {}
    for (const d of data.dates ?? []) {
      for (const g of d.games ?? []) {
        const sportId =
          g.teams?.home?.team?.sport?.id ?? g.teams?.away?.team?.sport?.id ?? 1
        out[g.gamePk] = {
          ...normalizeGame(g, sportId),
          officialDate: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

// Both schedule fetchers below prune with `fields=`: the raw schedule row
// carries each side's score/isWinner/leagueRecord, which are score-revealing and
// which these selectors deliberately never read. An allowlist keeps them out of
// the response (and client memory) entirely rather than fetching then discarding
// — a payload win (~85% smaller) and a spoiler win. Each list is the exact
// read-set of its function; `fields=` is name-based, so a name absent here
// arrives `undefined`. (Verified 2026-07-12 against a live season: `fields=`
// composes with `hydrate=team` — abbreviations still resolve.)
const HEAD_TO_HEAD_FIELDS =
  'dates,games,gamePk,officialDate,gameDate,gameNumber,status,abstractGameState,teams,away,home,team,id'
const TEAM_SCHEDULE_FIELDS =
  'dates,games,gamePk,officialDate,gameDate,gameNumber,doubleHeader,teams,away,home,team,id,name,teamName,abbreviation'

// Every regular-season meeting between two clubs in one season, for the
// footer's "find a past matchup" search. The schedule endpoint has no
// two-team filter, so this pulls team A's full-season schedule and keeps only
// games against team B's id. Regular season only ('R') — postseason/spring
// meetings between two arbitrary clubs are rare, and this is a convenience
// lookup, not an exhaustive archive. Sorted soonest -> latest so a
// doubleheader's two games stay in order. Degrades to [].
export async function fetchHeadToHead(teamAId, teamBId, season, sportId = 1) {
  if (!teamAId || !teamBId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/schedule?sportId=${sportId}&teamId=${teamAId}&season=${season}&gameType=R&fields=${HEAD_TO_HEAD_FIELDS}`,
    )
    const games = (data.dates ?? []).flatMap((d) => d.games ?? [])
    // A suspended/resumed game can be listed under both its original and
    // resume dates, so dedupe by gamePk before building the list.
    const byPk = new Map()
    for (const g of games) {
      const a = g.teams?.away?.team?.id
      const h = g.teams?.home?.team?.id
      if ((a === teamAId && h === teamBId) || (a === teamBId && h === teamAId)) {
        byPk.set(g.gamePk, {
          gamePk: g.gamePk,
          apiDate: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
          gameNumber: g.gameNumber ?? 1,
          awayId: a,
          homeId: h,
          final: g.status?.abstractGameState === 'Final',
        })
      }
    }
    return [...byPk.values()].sort((x, y) => new Date(x.apiDate) - new Date(y.apiDate))
  } catch {
    return []
  }
}

// One team's full regular-season schedule, for the team page's monthly
// calendar card. Dates/opponents/home-away are spoiler-free (same rationale as
// fetchHeadToHead above), but the raw schedule row also carries each side's
// score/isWinner/leagueRecord — those ARE score-revealing, so they are
// deliberately never copied into the returned shape below. `hydrate=team` gets
// real abbreviations instead of the teamAbbr() name-derived fallback. Regular
// season only ('R'), like fetchHeadToHead. Degrades to [].
export async function fetchTeamSchedule(teamId, season, sportId = 1) {
  if (!teamId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/schedule?sportId=${sportId}&teamId=${teamId}&season=${season}&gameType=R&hydrate=team&fields=${TEAM_SCHEDULE_FIELDS}`,
    )
    const games = (data.dates ?? []).flatMap((d) => d.games ?? [])
    const byPk = new Map()
    for (const g of games) {
      const away = g.teams?.away?.team
      const home = g.teams?.home?.team
      if (!away?.id || !home?.id) continue
      const isHome = home.id === teamId
      const opponent = isHome ? away : home
      byPk.set(g.gamePk, {
        gamePk: g.gamePk,
        apiDate: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
        gameNumber: g.gameNumber ?? 1,
        doubleHeader: g.doubleHeader ?? 'N',
        isHome,
        away: { abbreviation: teamAbbr(away) },
        home: { abbreviation: teamAbbr(home) },
        opponent: { id: opponent.id, name: opponent.name, abbreviation: teamAbbr(opponent) },
      })
    }
    return [...byPk.values()].sort(
      (x, y) => new Date(x.apiDate) - new Date(y.apiDate) || x.gameNumber - y.gameNumber,
    )
  } catch {
    return []
  }
}
