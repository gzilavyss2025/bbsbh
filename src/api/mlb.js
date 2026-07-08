// Thin wrapper around the public MLB Stats API. All requests run in the user's
// browser; there is no backend. Field paths here were verified against the
// live July 5 2026 Brewers @ D-backs game (gamePk 825061).

import { SEARCHABLE_SPORT_IDS, SPORT_LABEL, MILB_LEVELS, teamLogoUrl } from '../lib/teams.js'
import { matchupSlug } from '../lib/route.js'
import { tintFromSvg } from '../lib/logoTint.js'

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
    // 'N' = single game; 'Y'/'S' = part of a doubleheader (regular or split).
    // Lets a card label itself "Game 1 / Game 2" (gameNumber alone can't tell a
    // lone game from game 1 of a twin bill — both carry gameNumber 1).
    doubleHeader: game.doubleHeader ?? 'N',
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
// rather than just the teams playing today, and by the footer's team
// directory (see fetchTeamDirectory) for cross-level name search.
export async function fetchTeams(sportId) {
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

// A tight, at-a-glance uniform summary — "Away Alternate Navy Blue",
// "Home White", "Road Grey" — synthesized from the full asset list the way
// weather.js boils a forecast down to a scorebook line. The JERSEY is the
// identifying piece (pants and cap almost always follow the home/road default —
// grey pants, plain cap on the road), so the summary leads with tonight's side
// and the jersey's descriptor, dropping the redundant club name, the piece noun,
// and any variant number. A standard Home/Road jersey already names the side, so
// the prefix isn't doubled up ("Home White", not "Home Home White").
export function uniformSummary(assets, side, clubName) {
  if (!assets?.length) return ''
  const jersey = assets.find((a) => a.piece === 'J') ?? assets[0]
  let text = jersey.text
  if (clubName && text.startsWith(`${clubName} `)) {
    text = text.slice(clubName.length + 1)
  }
  text = text
    .replace(/\s*\bJersey\b\s*/i, ' ') // drop the piece noun
    .replace(/\bAlt\b/gi, 'Alternate') // expand the abbreviation
    .replace(/\bAlternate\s+\d+\b/i, 'Alternate') // "Alternate 2" → "Alternate"
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  // A Home/Road/Away jersey self-identifies; anything else (an alternate, a
  // City Connect) gets tonight's side stamped on the front.
  if (/^(home|road|away)\b/i.test(text)) return text
  return `${side === 'away' ? 'Away' : 'Home'} ${text}`
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

// ---------------------------------------------------------------------------
// Player pages — bio + stats fetchers (see src/api/person.js for the pure
// view-model shaping). Everything here is READ BY THE PLAYER PAGE ONLY, keyed
// on the person id we already carry. It is *not* wired into any sealed game
// surface: a name-link injects no score into the DOM, and the player page
// fetches its own date-cut stats rather than reading the live feed. See
// docs/data-enrichment.md for the per-endpoint spoiler notes.
// ---------------------------------------------------------------------------

// Full bio for one person. `hydrate=currentTeam,draft` folds in the current
// club (whose sport.id tells us the level to query stats at) and the player's
// draft record(s) in one request. The bare `currentTeam` hydration field
// never carries `sport` on its own (verified live) — `personSportId` would
// then silently fall back to MLB (1) for every MiLB player, which is why the
// `team` hydration field has to ride along too: paired with `currentTeam` it's
// the one that makes the API merge `sport`/`league`/`division` into the
// `currentTeam` object (the standalone `team` field itself comes back empty).
// Degrades to null (MiLB / bad id), so the page can show a graceful "couldn't
// load".
export async function fetchPerson(personId) {
  if (!personId) return null
  try {
    const data = await getJson(
      `/api/v1/people/${personId}?hydrate=currentTeam,team,draft`,
    )
    return data.people?.[0] ?? null
  } catch {
    return null
  }
}

// One stats bundle, parameterized by `type`
// ('byDateRange' | 'career' | 'yearByYear' | 'statSplits' | 'gameLog') and
// `group` ('hitting' | 'pitching'). Returns the RAW splits array — shaping and
// (for byDateRange) de-duplication/aggregation live in person.js, since one
// call can return multiple rows (stints, or the duplicate rows byDateRange
// emits). MiLB routes via `sportId`, exactly like fetchPitcherSeasonLine.
// Degrades to [] so a missing group (e.g. no MiLB splits) just drops its
// section rather than taking the page down.
export async function fetchPersonStats(
  personId,
  { type, group, season, startDate, endDate, sitCodes, sportId = 1 } = {},
) {
  if (!personId || !type || !group) return []
  try {
    const params = [`stats=${type}`, `group=${group}`]
    if (season) params.push(`season=${season}`)
    if (startDate) params.push(`startDate=${startDate}`)
    if (endDate) params.push(`endDate=${endDate}`)
    if (sitCodes) params.push(`sitCodes=${sitCodes}`)
    if (sportId && sportId !== 1) params.push(`sportId=${sportId}`)
    const data = await getJson(
      `/api/v1/people/${personId}/stats?${params.join('&')}`,
    )
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// Every yearByYear split for a person across every MiLB level. The live API
// accepts exactly one sportId per request (a comma-list silently returns no
// stats), so this fans out in parallel across MILB_LEVELS — the same
// SEARCHABLE_SPORT_IDS idiom resolveGame already uses. Degrades per level (an
// unplayed level just contributes no splits); raw splits only, tagged with
// their own sport.id — dedup and shaping happen in person.js.
export async function fetchMilbYearByYear(personId, group) {
  const results = await Promise.allSettled(
    MILB_LEVELS.map((lvl) =>
      fetchPersonStats(personId, { type: 'yearByYear', group, sportId: lvl.sportId }),
    ),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// Same fan-out as fetchMilbYearByYear, but for a date-cut "current season"
// window instead of full prior years — lets the caller combine a player's
// stints across every MiLB level he's appeared at THIS season (e.g. a
// mid-season promotion from AA to AAA), the same way fetchMilbYearByYear
// already combines full completed seasons. Degrades per level.
export async function fetchMilbByDateRange(personId, group, season, startDate, endDate) {
  const results = await Promise.allSettled(
    MILB_LEVELS.map((lvl) =>
      fetchPersonStats(personId, {
        type: 'byDateRange', group, season, startDate, endDate, sportId: lvl.sportId,
      }),
    ),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
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
          gameNumber: g.gameNumber ?? 1,
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

// Team abbreviations for a set of ids, one batched request — used to label a
// player's year-by-year row(s) with the club(s) they played for that season
// (those stat splits carry only a team id/name, never an abbreviation). The
// plural `teamIds` filter param is silently ignored by this endpoint (it
// returns every team, MLB and MiLB alike); the singular `teamId` is the one
// that actually filters, and it does accept a comma-separated list. Degrades
// to {} on failure/empty input, so an unresolved team just shows no label.
export async function fetchTeamAbbrevs(teamIds) {
  const list = [...new Set((teamIds ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(`/api/v1/teams?teamId=${list.join(',')}`)
    const out = {}
    for (const t of data.teams ?? []) out[t.id] = teamAbbr(t)
    return out
  } catch {
    return {}
  }
}

// A soft background wash for a team, derived from its own logo colors so the
// full-color mark reads cleanly on it with no border or drop shadow (see
// lib/logoTint.js). The mlbstatic logo CDN serves its SVGs cross-origin, so we
// read the actual fills out of the markup rather than keeping a per-club color
// table — statsapi has no color field, and there are hundreds of MiLB clubs.
// Tries the (clean, two-color) cap mark first, then the full primary. Memoized
// per team id, since a career timeline re-requests the same clubs, and degrades
// to null so a club whose logo is missing or colorless (a black/silver cap)
// just gets a plain neutral cell.
const logoTintCache = new Map()
export function fetchTeamLogoTint(teamId) {
  if (!teamId) return Promise.resolve(null)
  if (logoTintCache.has(teamId)) return logoTintCache.get(teamId)
  const p = (async () => {
    for (const variant of ['cap', 'base']) {
      try {
        const res = await fetch(teamLogoUrl(teamId, variant))
        if (!res.ok) continue
        const tint = tintFromSvg(await res.text())
        if (tint) return tint
      } catch {
        // try the next variant, else fall through to the neutral null below
      }
    }
    return null
  })()
  logoTintCache.set(teamId, p)
  return p
}

// ---------------------------------------------------------------------------
// Team pages — identity, roster, standings, ranked team stats.
// ---------------------------------------------------------------------------

// Basic team identity, incl. league + division ids (needed to pull the right
// standings). Degrades to null.
export async function fetchTeam(teamId) {
  if (!teamId) return null
  try {
    const data = await getJson(`/api/v1/teams/${teamId}`)
    return data.teams?.[0] ?? null
  } catch {
    return null
  }
}

// The active roster, with each player's season pitching line hydrated so the
// team page can infer starter/reliever/closer (there is no role field in the
// API). Position players simply carry no pitching stats. Degrades to [].
export async function fetchTeamRoster(teamId, season) {
  if (!teamId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/teams/${teamId}/roster?rosterType=active&hydrate=person(stats(type=season,group=pitching,season=${season}))`,
    )
    return data.roster ?? []
  } catch {
    return []
  }
}

// Just the active roster's person ids — no stat hydration — for the slate's
// "N prospects on this roster" badge, which only needs to know who's on the
// roster, not their stats. Lighter than fetchTeamRoster. Degrades to [].
export async function fetchTeamRosterIds(teamId) {
  if (!teamId) return []
  try {
    const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=active`)
    return (data.roster ?? []).map((r) => r.person?.id).filter(Boolean)
  } catch {
    return []
  }
}

// Fan out fetchTeamRosterIds across every team on the current slate — same
// Promise.allSettled "degrade per item" idiom as fetchTeamDirectory /
// fetchMilbYearByYear, since there's no batched multi-team roster endpoint.
export async function fetchRosterIdsForTeams(teamIds) {
  const results = await Promise.allSettled(teamIds.map((id) => fetchTeamRosterIds(id)))
  const out = {}
  teamIds.forEach((id, i) => {
    out[id] = results[i].status === 'fulfilled' ? results[i].value : []
  })
  return out
}

// A club's full affiliate tree in one request, via the dedicated
// /teams/affiliates endpoint (a plain team hydrate doesn't carry this).
// `hydrate=venue(location)` folds in each affiliate's ballpark city/state
// alongside its own team id (which already drives the logo CDN), so the team
// page's affiliates section needs no per-team follow-up fetch. Filtered to
// the four full-season farm levels (AAA/AA/A+/A, sportIds 11/12/13/14) — the
// endpoint also returns complex-league/DSL/alternate-site/"Prospects" entries
// that aren't proper affiliate clubs the rest of the app tracks (see
// MILB_LEVELS). Sorted highest level first. Degrades to [].
const AFFILIATE_SPORT_IDS = [11, 12, 13, 14]
export async function fetchAffiliates(teamId, season) {
  if (!teamId || !season) return []
  try {
    const data = await getJson(
      `/api/v1/teams/affiliates?teamIds=${teamId}&season=${season}&hydrate=venue(location)`,
    )
    const teams = data.teams ?? []
    return teams
      .filter((t) => t.id !== teamId && AFFILIATE_SPORT_IDS.includes(t.sport?.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        sportId: t.sport?.id,
        city: t.venue?.location?.city || t.locationName || '',
        state: t.venue?.location?.stateAbbrev || t.venue?.location?.state || '',
      }))
      .sort((a, b) => AFFILIATE_SPORT_IDS.indexOf(a.sportId) - AFFILIATE_SPORT_IDS.indexOf(b.sportId))
  } catch {
    return []
  }
}

// Division standings AS OF a date. The `date` param is honored by the API
// (verified: a June-1 query returns the June-1 record, not today's, and it
// folds in games THROUGH the end of that day), which is what makes this
// spoiler-safe — pass the day BEFORE the game being scored so a team you
// haven't revealed never shows a record that folds tonight's result. Optional
// `hydrate` ('division' fills in the division name/abbrev the per-team records
// omit — the standings page needs it; TeamPage doesn't and passes none).
// Returns the raw division records array; person.js/TeamPage pick the team's
// own division. Degrades to [].
export async function fetchStandings(leagueId, season, date, hydrate) {
  if (!leagueId || !season) return []
  try {
    const dateParam = date ? `&date=${date}` : ''
    const hydrateParam = hydrate ? `&hydrate=${hydrate}` : ''
    const data = await getJson(
      `/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason${dateParam}${hydrateParam}`,
    )
    return data.records ?? []
  } catch {
    return []
  }
}

// Both leagues' division standings AS OF a date, in one flat records array for
// the standings page. The /standings endpoint takes exactly one leagueId, so
// this fans out over the AL (103) and NL (104) in parallel — the same
// degrade-per-item idiom as resolveGame. `hydrate=division` carries the
// division name each record is grouped under (see api/standings.js for the
// shaping). Same `date` semantics + spoiler stance as fetchStandings: the
// standings page defaults `date` to yesterday ("entering today") so a slate the
// user is mid-scoring never leaks. Degrades per league (a failed league just
// contributes no records).
const STANDINGS_LEAGUE_IDS = [103, 104]
export async function fetchLeagueStandings(season, date) {
  if (!season) return []
  const results = await Promise.allSettled(
    STANDINGS_LEAGUE_IDS.map((leagueId) =>
      fetchStandings(leagueId, season, date, 'division'),
    ),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// Every MLB club's season hitting+pitching totals, so the team page can rank
// one team league-wide (there's no per-team "rank" field). Ranking is computed
// in person.js. Only meaningful at MLB (sportId 1); MiLB team-stat coverage is
// thin, so callers gate on level and this degrades to []. Returns
// { hitting: [{teamId, stat}], pitching: [...] }.
export async function fetchLeagueTeamStats(season) {
  if (!season) return { hitting: [], pitching: [] }
  const one = async (group) => {
    try {
      const data = await getJson(
        `/api/v1/teams/stats?season=${season}&sportIds=1&group=${group}&stats=season`,
      )
      return (data.stats?.[0]?.splits ?? []).map((s) => ({
        teamId: s.team?.id,
        stat: s.stat,
      }))
    } catch {
      return []
    }
  }
  const [hitting, pitching] = await Promise.all([one('hitting'), one('pitching')])
  return { hitting, pitching }
}

// The earliest (chronologically first) split in an ascending-sorted debut-year
// game log where the person's OWN boxscore entry shows a starter's batting
// order — a multiple of 100, the same convention selectLineup uses in
// select.js (a sub's is offset 801/802…). No gameLog field distinguishes a
// start from a sub appearance, so this is the only way to find it; it walks
// oldest-first and stops at the first match, which for the vast majority of
// players is the very first game checked (their debut). Degrades to null on a
// game whose feed can't be read or is offline (keeps scanning the rest).
export async function findFirstStart(personId, splitsAscending) {
  const key = `ID${personId}`
  for (const s of splitsAscending ?? []) {
    const gamePk = s.game?.gamePk
    if (!gamePk) continue
    try {
      const feed = await fetchGameFeed(gamePk)
      const teams = feed?.liveData?.boxscore?.teams ?? {}
      const box = teams.away?.players?.[key] ?? teams.home?.players?.[key]
      const bo = Number(box?.battingOrder)
      if (Number.isFinite(bo) && bo >= 100 && bo % 100 === 0) return s
    } catch {
      // Unreadable game feed — skip it and keep scanning.
    }
  }
  return null
}

// The batter a pitcher recorded his first career strikeout against — not
// carried by gameLog (a per-game aggregate), so this re-fetches that one
// already-concluded game's feed and scans its plays for the earliest
// strikeout charged to the pitcher. Mirrors findFirstStart's per-game feed
// lookup; degrades to null on an unreadable feed or no match.
export async function findFirstStrikeoutBatter(personId, gamePk) {
  if (!gamePk) return null
  try {
    const feed = await fetchGameFeed(gamePk)
    const plays = feed?.liveData?.plays?.allPlays ?? []
    for (const play of plays) {
      if (play.matchup?.pitcher?.id !== personId) continue
      const ev = play.result?.eventType
      if (ev !== 'strikeout' && ev !== 'strikeout_double_play') continue
      return play.matchup?.batter ?? null // { id, fullName }
    }
  } catch {
    // Unreadable game feed — no batter to show.
  }
  return null
}

// Player ids selected to this season's All-Star Game. Roster membership isn't
// score-revealing, so this is spoiler-safe to show year-round (unlike the
// game itself, which stays sealed like any other). The team roster endpoints
// for the All-Star squads (ids 159 AL / 160 NL) come back empty, so instead
// look up the game via the schedule's gameType=A entry and read both teams'
// player lists off its boxscore — populated as soon as rosters are announced,
// well before the game is played. Degrades to an empty Set (works fine before
// rosters are announced, after a season with no game, or off MLB).
export async function fetchAllStarRosterIds(season) {
  if (!season) return new Set()
  try {
    const sched = await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=A`)
    const gamePk = sched.dates?.[0]?.games?.[0]?.gamePk
    if (!gamePk) return new Set()
    const feed = await getJson(`/api/v1.1/game/${gamePk}/feed/live`)
    const teams = feed.liveData?.boxscore?.teams ?? {}
    const ids = new Set()
    for (const side of ['away', 'home']) {
      for (const p of Object.values(teams[side]?.players ?? {})) {
        if (p.person?.id) ids.add(p.person.id)
      }
    }
    return ids
  } catch {
    return new Set()
  }
}

// ---------------------------------------------------------------------------
// Site-wide search — the footer's player/team/matchup lookups. All
// spoiler-free: search surfaces identity and schedule only, never a score.
// ---------------------------------------------------------------------------

// Name search across every person the Stats API knows (current and retired
// alike — the endpoint doesn't distinguish). Matches on either name part as a
// prefix ("jud" -> Judge, Jud Fabian). Active players sort first, since a
// footer search is almost always for someone playing right now; capped at
// `limit` so a common surname doesn't flood the dropdown. Degrades to [] so a
// flaky request just shows "no results" rather than an error state.
export async function searchPeople(query, limit = 8) {
  const q = (query ?? '').trim()
  if (q.length < 2) return []
  try {
    const data = await getJson(
      `/api/v1/people/search?names=${encodeURIComponent(q)}&hydrate=currentTeam`,
    )
    return (data.people ?? [])
      .map((p) => ({
        id: p.id,
        name: p.fullName ?? '',
        active: !!p.active,
        pos: p.primaryPosition?.abbreviation ?? '',
        team: p.currentTeam?.name ?? '',
      }))
      .sort((a, b) => Number(b.active) - Number(a.active))
      .slice(0, limit)
  } catch {
    return []
  }
}

// Every active club across every searchable level, fetched once and cached
// for the session. The /teams endpoint has no search param and (verified)
// ignores a comma-joined sportIds list, so a cross-level directory needs one
// request per level up front — the same SEARCHABLE_SPORT_IDS fan-out
// resolveGame already does — rather than a fresh multi-request round trip on
// every keystroke. Degrades to whatever levels succeeded; only truly empty if
// every level failed.
let teamDirectoryPromise = null
export function fetchTeamDirectory() {
  if (!teamDirectoryPromise) {
    teamDirectoryPromise = Promise.allSettled(
      SEARCHABLE_SPORT_IDS.map((sportId) => fetchTeams(sportId)),
    ).then((results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])))
  }
  return teamDirectoryPromise
}

// Pure client-side filter over a fetchTeamDirectory() list — substring match
// on the full team name, case-insensitive ("brew" -> Brewers).
export function searchTeams(directory, query, limit = 8) {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return []
  return (directory ?? [])
    .filter((t) => (t.name ?? '').toLowerCase().includes(q))
    .slice(0, limit)
}

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
      `/api/v1/schedule?sportId=${sportId}&teamId=${teamAId}&season=${season}&gameType=R`,
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
      `/api/v1/schedule?sportId=${sportId}&teamId=${teamId}&season=${season}&gameType=R&hydrate=team`,
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
