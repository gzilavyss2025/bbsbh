// Per-game fetchers that aren't the live feed's own hydration: win
// probability, venue, managers, and a probable starter's season line.

import { getJson } from './statsapi.js'

export async function fetchGameFeed(gamePk) {
  return getJson(`/api/v1.1/game/${gamePk}/feed/live`)
}

// Per-play win probability — the ONLY source of WPA, which is absent from the
// live feed (verified: /feed/live carries no homeTeamWinProbabilityAdded). Used
// solely to rank the box score's three stars, so it's fetched lazily with that
// view and resolves null on failure — many MiLB parks don't compute it, and it
// must never take the game view down. Score-revealing (like the feed itself), so
// the caller only turns it into DOM inside the box score's seal.
//
// The unpruned response is ~186 KB gzipped — nearly a whole second feed —
// because each play entry carries the full `playEvents` pitch-by-pitch array
// (~85% of the payload), which this app never reads (it takes pitch data from
// /feed/live instead). WIN_PROB_FIELDS is the COMPLETE read-set of the two
// consumers — `computeThreeStars` and `computePlayOfTheGame` in boxscore.js —
// so the `fields=` allowlist prunes it to ~6 KB with byte-identical output
// (measured/validated across 5 games, 2026-07-12; ADR/api-audit R1). `matchup`
// keeps BOTH `batter` and `pitcher` (three stars credit the pitcher the inverse
// WPA — dropping `pitcher` silently corrupts the stars on games a pitcher stars
// in). If you read a NEW field off a win-prob entry, add its name here or it
// arrives `undefined`.
const WIN_PROB_FIELDS = [
  'homeTeamWinProbabilityAdded',
  'atBatIndex',
  'about',
  'captivatingIndex',
  'inning',
  'isTopInning',
  'matchup',
  'batter',
  'pitcher',
  'id',
  'result',
  'awayScore',
  'homeScore',
  'description',
  'runners',
  'details',
  'isScoringEvent',
  'runner',
].join(',')

export async function fetchWinProbability(gamePk) {
  try {
    const data = await getJson(
      `/api/v1/game/${gamePk}/winProbability?fields=${WIN_PROB_FIELDS}`,
    )
    return Array.isArray(data) ? data : null
  } catch {
    return null
  }
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
//
// The endpoint defaults to the CURRENT roster, so a historical box score
// needs its game's own `season` passed through — otherwise a 2014 game shows
// today's skipper instead of the one who actually managed it (verified: the
// endpoint accepts `?season=YYYY` and returns that season's staff).
// ---------------------------------------------------------------------------

export async function fetchManager(teamId, season) {
  if (!teamId) return null
  try {
    const data = await getJson(
      `/api/v1/teams/${teamId}/coaches${season ? `?season=${season}` : ''}`,
    )
    const roster = data.roster ?? []
    const managers = roster.filter((r) => /(^|\s)manager$/i.test(r.job ?? ''))
    // Prefer the exact 'Manager' over an 'Interim Manager' if both appear.
    const mgr =
      managers.find((r) => r.job === 'Manager') ?? managers[0] ?? null
    const name = mgr?.person?.fullName
    if (!name) return null
    return {
      name,
      personId: mgr.person?.id ?? null,
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
