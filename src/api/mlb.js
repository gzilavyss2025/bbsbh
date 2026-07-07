// Thin wrapper around the public MLB Stats API. All requests run in the user's
// browser; there is no backend. Field paths here were verified against the
// live July 5 2026 Brewers @ D-backs game (gamePk 825061).

import { SEARCHABLE_SPORT_IDS, SPORT_LABEL } from '../lib/teams.js'
import { matchupSlug } from '../lib/route.js'

const BASE = 'https://statsapi.mlb.com'

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`MLB API ${res.status} for ${path}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Schedule / slate
// ---------------------------------------------------------------------------

// A team's slug-safe abbreviation. The schedule's hydrate=team payload can be
// absent (thin MiLB rows, hydration outages); an empty abbreviation would
// build a broken/ambiguous matchup slug ('mil' + '' collides with any other
// missing side), so fall back to the first letters of the team name.
function teamAbbr(team) {
  return (
    team?.abbreviation ||
    (team?.teamName || team?.name || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  )
}

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
    // Status codes: 'S'/'P' pre-game, 'I' in-progress, 'F'/'O' final.
    statusCode: game.status?.statusCode,
    detailedState: game.status?.detailedState,
    abstractState: game.status?.abstractGameState,
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

// Every active club at a level, independent of any date's schedule — used by
// the logo sheet's level browser so it can show a league's full set of marks
// rather than just the teams playing today.
export async function fetchTeams(sportId) {
  const data = await getJson(`/api/v1/teams?sportId=${sportId}&activeStatus=Y`)
  const teams = data.teams ?? []
  return teams
    .filter((t) => t.active)
    .map((t) => ({ id: t.id, name: t.name, sportId }))
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

// ---------------------------------------------------------------------------
// Full game feed
// ---------------------------------------------------------------------------

export async function fetchGameFeed(gamePk) {
  return getJson(`/api/v1.1/game/${gamePk}/feed/live`)
}

// Per-play win probability — the ONLY source of WPA, which is absent from the
// live feed (verified: /feed/live carries no homeTeamWinProbabilityAdded). Used
// solely to rank the box score's three stars, so it's fetched lazily with that
// view and resolves null on failure — many MiLB parks don't compute it, and it
// must never take the game view down. Score-revealing (like the feed itself), so
// the caller only turns it into DOM inside the box score's seal.
export async function fetchWinProbability(gamePk) {
  try {
    const data = await getJson(`/api/v1/game/${gamePk}/winProbability`)
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

// The uniforms each club is actually wearing tonight, from the dedicated
// /api/v1/uniforms/game endpoint — the live feed carries zero uniform data
// (see docs/uniforms-and-logos.md for the verified findings). Spoiler-FREE:
// the assignment reveals nothing about the score and never changes once
// posted. It IS empty until around first pitch, and MiLB games return
// nothing, so this degrades to null and callers show the usual "—".
// Assets sort jersey → pants → cap so the composed line always reads top-down.
const UNIFORM_PIECE_ORDER = { J: 0, P: 1, C: 2 }

export async function fetchGameUniforms(gamePk) {
  if (!gamePk) return null
  try {
    const data = await getJson(`/api/v1/uniforms/game?gamePks=${gamePk}`)
    const game = data.uniforms?.[0]
    const normalize = (side) => {
      const assets = (side?.uniformAssets ?? [])
        .map((a) => ({
          text: a.uniformAssetText ?? '',
          piece: a.uniformAssetType?.uniformAssetTypeCode ?? '',
        }))
        .filter((a) => a.text)
        .sort(
          (a, b) =>
            (UNIFORM_PIECE_ORDER[a.piece] ?? 9) -
            (UNIFORM_PIECE_ORDER[b.piece] ?? 9),
        )
      return assets.length > 0 ? assets : null
    }
    const away = normalize(game?.away)
    const home = normalize(game?.home)
    if (!away && !home) return null
    return { away, home }
  } catch {
    // Not posted yet / MiLB / endpoint hiccup — the uniform row just shows "—".
    return null
  }
}

// Slate-wide uniform readiness: given the day's gamePks, return a map
// gamePk -> boolean of whether BOTH clubs' uniforms are posted yet. The
// /uniforms/game endpoint takes a comma-separated gamePks list, so the whole
// slate resolves in ONE request rather than one per card. Spoiler-free (a
// uniform assignment reveals no score) and, like the per-game fetch, empty
// until ~first pitch and absent for MiLB — so a missing/errored game just maps
// to `false` (the card's uniform chip stays red until the assignment lands).
export async function fetchScheduleUniforms(gamePks) {
  const list = (gamePks ?? []).filter(Boolean)
  if (list.length === 0) return {}
  try {
    const data = await getJson(
      `/api/v1/uniforms/game?gamePks=${list.join(',')}`,
    )
    const posted = (side) =>
      (side?.uniformAssets ?? []).some((a) => a.uniformAssetText)
    const out = {}
    for (const u of data.uniforms ?? []) {
      out[u.gamePk] = posted(u.away) && posted(u.home)
    }
    return out
  } catch {
    return {}
  }
}

// One printable uniform line — "Alt 2 Navy Blue jersey · Road Grey pants ·
// Alt Yellow Front hat". Asset labels arrive as "<Club> <desc> <Piece>"
// ("Brewers Alt 2 Navy Blue Jersey"); the club name is redundant next to a
// team header, so it's stripped, and the trailing piece word is lowercased so
// the descriptor reads as the name and the piece as a plain noun.
export function uniformLine(assets, clubName) {
  if (!assets?.length) return ''
  return assets
    .map((a) => {
      let text = a.text
      if (clubName && text.startsWith(`${clubName} `)) {
        text = text.slice(clubName.length + 1)
      }
      return text.replace(/\s(Jersey|Pants|Hat)$/, (m) => m.toLowerCase())
    })
    .join(' · ')
}

// A venue with its coordinates and field info hydrated. The live feed's
// gameData.venue is usually enough (it carries location + fieldInfo), but on
// leaner feeds those are absent, so the weather generator falls back to this
// dedicated endpoint for the park's lat/lon and roofType. Degrades to null on
// failure — the caller then shows no generated weather rather than crashing.
export async function fetchVenue(venueId) {
  if (!venueId) return null
  try {
    const data = await getJson(
      `/api/v1/venues/${venueId}?hydrate=location,fieldInfo`,
    )
    return data.venues?.[0] ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Managers — NOT in the live feed (its coaches array comes back empty), so we
// hit the dedicated coaches endpoint and find the manager row. The job title
// varies: a permanent skipper is 'Manager' (jobId 'MNGR'), but a fill-in is
// 'Interim Manager' (jobId 'NTRM') — e.g. Don Mattingly for the 2026 Phillies.
// So we match any job ending in "Manager", prefer a permanent one, and tag an
// interim with "(interim)" so the label stays honest.
// ---------------------------------------------------------------------------

export async function fetchManager(teamId) {
  if (!teamId) return null
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/coaches`)
    const roster = data.roster ?? []
    const managers = roster.filter((r) => /(^|\s)manager$/i.test(r.job ?? ''))
    // Prefer the exact 'Manager' over an 'Interim Manager' if both appear.
    const mgr =
      managers.find((r) => r.job === 'Manager') ?? managers[0] ?? null
    const name = mgr?.person?.fullName
    if (!name) return null
    return {
      name,
      lastFirst: toLastFirst(name),
      jersey: mgr.jerseyNumber ?? '',
      interim: mgr.job !== 'Manager',
    }
  } catch {
    // MiLB affiliates may not expose coaches; degrade gracefully.
    return null
  }
}

// "Pat Murphy" -> "Murphy, Pat" for staging pages, which pencil every name
// surname-first the way the scorebook lineup slots read. The coaches endpoint
// only carries fullName (no lastFirstName like gameData.players), so this
// splits on the last word while keeping generational suffixes with the surname
// ("Ken Griffey Jr." -> "Griffey Jr., Ken").
function toLastFirst(fullName) {
  const words = fullName.trim().split(/\s+/)
  if (words.length < 2) return fullName
  let cut = words.length - 1
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(words[cut]) && cut > 1) cut -= 1
  return `${words.slice(cut).join(' ')}, ${words.slice(0, cut).join(' ')}`
}

// One printable manager line — "MURPHY, PAT (interim)" — for surfaces that
// need a plain string (the box score's fill-in card). The jersey number stays
// separate so callers can ink it in clay like every other uniform number.
export function managerLabel(mgr) {
  if (!mgr) return ''
  return `${mgr.lastFirst}${mgr.interim ? ' (interim)' : ''}`
}

// ---------------------------------------------------------------------------
// A pitcher's season line — the "3.12 ERA · 9-4 · 142 K" you pencil next to
// the opposing starter while staging. Season AGGREGATES, not this game's line,
// so it's staging-safe; strictly speaking a final game's runs are already
// folded into the season ERA, but that's a drift you'd need the before-value
// to read anything from — never this game's score itself. `sportId` routes
// MiLB pitchers to their own league's stats (statsapi defaults to MLB).
// Verified against /api/v1/people/{id}/stats on 2026-07-07.
// ---------------------------------------------------------------------------

export async function fetchPitcherSeasonLine(personId, season, sportId = 1) {
  if (!personId || !season) return null
  try {
    const sport = sportId && sportId !== 1 ? `&sportId=${sportId}` : ''
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=season&group=pitching&season=${season}${sport}`,
    )
    const stat = data.stats?.[0]?.splits?.[0]?.stat
    if (!stat) return null
    return {
      era: stat.era ?? '',
      wins: stat.wins ?? 0,
      losses: stat.losses ?? 0,
      inningsPitched: stat.inningsPitched ?? '',
      strikeOuts: stat.strikeOuts ?? 0,
      whip: stat.whip ?? '',
    }
  } catch {
    // MiLB coverage gaps / pre-debut arms — the staging row just omits it.
    return null
  }
}
