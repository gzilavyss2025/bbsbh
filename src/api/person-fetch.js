// Player pages — bio + stats fetchers (see src/api/person.js for the pure
// view-model shaping). Everything here is READ BY THE PLAYER PAGE ONLY, keyed
// on the person id we already carry. It is *not* wired into any sealed game
// surface: a name-link injects no score into the DOM, and the player page
// fetches its own date-cut stats rather than reading the live feed. See
// docs/data-enrichment.md for the per-endpoint spoiler notes.

import { MILB_LEVELS, teamAbbr, teamLogoUrl } from '../lib/teams.js'
import { tintFromSvg } from '../lib/logoTint.js'
import { getJson } from './statsapi.js'
import { fetchGameFeed } from './game.js'

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

// Game-log rows across every MiLB level, fanned out one request per level (the
// API takes a single sportId) and tagged with the level's sportId so the shaper
// can label each row — statsapi's gameLog splits don't carry `sport` on their
// own. Used only for a rehabbing big leaguer's combined MLB + MiLB log; the MLB
// side is a plain single-sportId gameLog call the caller makes alongside this.
// Degrades per level.
export async function fetchMilbGameLog(personId, group, season) {
  const results = await Promise.allSettled(
    MILB_LEVELS.map((lvl) =>
      fetchPersonStats(personId, { type: 'gameLog', group, season, sportId: lvl.sportId }).then((splits) =>
        splits.map((s) => ({ ...s, sport: s.sport ?? { id: lvl.sportId } })),
      ),
    ),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// ---------------------------------------------------------------------------
// Position innings — fielding innings per position (the "where he's played"
// diamond) and starter-vs-reliever IP. Both are aggregates, not tonight's line,
// so — like the vs-L/R splits — they're spoiler-free and NOT date-cut: a
// season scope is the whole season, a career scope the whole career. `season`
// omitted => career.
// ---------------------------------------------------------------------------

// Fielding innings by position for one level. `stats=season` (with `season`) or
// `stats=career` (without) both break down per position and carry the position
// abbreviation (unlike byDateRange, which drops it). Degrades to [].
export async function fetchFielding(personId, { season, sportId = 1 } = {}) {
  if (!personId) return []
  const params = season
    ? ['stats=season', 'group=fielding', `season=${season}`]
    : ['stats=career', 'group=fielding']
  if (sportId && sportId !== 1) params.push(`sportId=${sportId}`)
  try {
    const data = await getJson(`/api/v1/people/${personId}/stats?${params.join('&')}`)
    return (data.stats?.[0]?.splits ?? []).map((s) => ({ ...s, sport: s.sport ?? { id: sportId } }))
  } catch {
    return []
  }
}

// Career fielding across every MiLB level, fanned out like fetchMilbYearByYear —
// one request per level (the API takes a single sportId). The shaper sums a
// position's innings across the levels. Degrades per level.
export async function fetchMilbFielding(personId) {
  const results = await Promise.allSettled(
    MILB_LEVELS.map((lvl) => fetchFielding(personId, { sportId: lvl.sportId })),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// Innings pitched as a starter vs. reliever for one (season, level). statSplits
// is season-scoped; a mid-season trade WITHIN the level emits per-team rows plus
// a team-less synthetic aggregate (verified: Rich Hill 2021 SP = NYM + TB + a
// team-less sum of the two), so the shaper dedupes per code like levelSeasonStat.
export async function fetchStarterReliever(personId, { season, sportId = 1 } = {}) {
  if (!personId) return []
  const params = ['stats=statSplits', 'group=pitching', 'sitCodes=sp,rp']
  if (season) params.push(`season=${season}`)
  if (sportId && sportId !== 1) params.push(`sportId=${sportId}`)
  try {
    const data = await getJson(`/api/v1/people/${personId}/stats?${params.join('&')}`)
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

// Career SP/RP: fan out one statSplits call per (season, sportId) stint the
// player pitched (statSplits has no career mode — the no-season call returns
// only the current year), tagging each result with its stint so the shaper can
// dedupe WITHIN a stint before summing ACROSS stints. Parallel + lazy (only run
// when the user toggles to a career scope).
export async function fetchStarterRelieverStints(personId, stints) {
  const results = await Promise.allSettled(
    (stints ?? []).map((st) => fetchStarterReliever(personId, st)),
  )
  return results.map((r, i) => ({
    stint: stints[i],
    splits: r.status === 'fulfilled' ? r.value : [],
  }))
}

// Current-season fielding across every MiLB level — the season-scope counterpart
// to fetchMilbFielding, for a player who is currently in the minors and may have
// moved levels mid-season (e.g. a prospect promoted AA -> AAA). The shaper
// combines the levels (an MLB player's season stays a single sportId-1 call,
// matching how resolveCurrentSeasonStat scopes the tiles). Degrades per level.
export async function fetchMilbFieldingSeason(personId, season) {
  const results = await Promise.allSettled(
    MILB_LEVELS.map((lvl) => fetchFielding(personId, { season, sportId: lvl.sportId })),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// SP/RP for the current season across every MiLB level (same promotion case).
export async function fetchMilbStarterRelieverSeason(personId, season) {
  const results = await Promise.allSettled(
    MILB_LEVELS.map((lvl) => fetchStarterReliever(personId, { season, sportId: lvl.sportId })),
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
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
// Firsts — first career instances of a handful of milestones, read off the
// debut season's game log.
// ---------------------------------------------------------------------------

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

// The `result.eventType` strings that count as each hitter milestone (verified
// live against the game feed). A hit is any of the four; XBH drops the single;
// HR is just the homer; a strikeout is either flavor.
export const MILESTONE_EVENTS = {
  hit: new Set(['single', 'double', 'triple', 'home_run']),
  xbh: new Set(['double', 'triple', 'home_run']),
  hr: new Set(['home_run']),
  so: new Set(['strikeout', 'strikeout_double_play']),
}

// The opposing PITCHER a hitter faced on the play of a given milestone — the
// batter's counterpart to findFirstStrikeoutBatter. gameLog gives the game; this
// re-fetches that concluded game's feed and returns the pitcher off the earliest
// play where this batter did the thing (allPlays is chronological). `events` is
// one of MILESTONE_EVENTS. Degrades to null on an unreadable feed or no match.
export async function findFirstPitcherFaced(personId, gamePk, events) {
  if (!gamePk || !events) return null
  try {
    const feed = await fetchGameFeed(gamePk)
    const plays = feed?.liveData?.plays?.allPlays ?? []
    for (const play of plays) {
      if (play.matchup?.batter?.id !== personId) continue
      if (!events.has(play.result?.eventType)) continue
      return play.matchup?.pitcher ?? null // { id, fullName }
    }
  } catch {
    // Unreadable game feed — no pitcher to show.
  }
  return null
}

// Every award a person has won (MVP, Cy Young, Silver Slugger, All-Star, …).
// Each object carries `id` (a stable AL*/NL* code), `name`, `season`, a real
// `date`, and (usually) `team` — the timeline filters to the majors and pins a
// row per award to its date (see transactionTimelineView). Roster/award data
// carries no score, so it's spoiler-free like the rest of the page. Degrades to
// [] off MLB / on failure.
export async function fetchPlayerAwards(personId) {
  if (!personId) return []
  try {
    const data = await getJson(`/api/v1/people/${personId}/awards`)
    return data.awards ?? []
  } catch {
    return []
  }
}

// Every player moved in a trade — read by querying one of the two clubs' moves
// on the trade's own date (the player-scoped feed names the OTHER players only
// in free text, but a team+date query returns each of them as its own row with
// a real person id and direction). The caller keys these by tradeKey to attach
// the cohort to the matching swap. Returns the RAW transaction rows; degrades
// to [] on failure.
export async function fetchTradeCohort(teamId, date) {
  if (!teamId || !date) return []
  try {
    const data = await getJson(
      `/api/v1/transactions?teamId=${teamId}&startDate=${date}&endDate=${date}`,
    )
    return data.transactions ?? []
  } catch {
    return []
  }
}

// Full career roster-move history for one person — trades, signings, the draft,
// call-ups/options, waivers, releases, DFAs, and (for a prospect) every
// affiliate-to-affiliate assignment up the farm system. The `/transactions`
// endpoint is player-scoped by a date WINDOW rather than "all history", so bind
// it wide-open on the low end and cap the high end at `endDate` — the caller
// passes the same "entering today" cutoff the stats use, so the timeline never
// surfaces a move that hadn't happened yet as of the game being scored.
// Roster moves carry no score (see docs/data-enrichment.md), so this is
// spoiler-free like the rest of the player page. Returns the RAW rows (shaping
// + curation live in person.js's transactionTimelineView); degrades to [] on
// failure or off-MLB. MiLB moves come back without needing a sportId (verified).
export async function fetchTransactions(personId, endDate) {
  if (!personId) return []
  try {
    const end = endDate || new Date().toISOString().slice(0, 10)
    const data = await getJson(
      `/api/v1/transactions?playerId=${personId}&startDate=1900-01-01&endDate=${end}`,
    )
    return data.transactions ?? []
  } catch {
    return []
  }
}

// Player ids selected to this season's All-Star Game. Roster membership isn't
// score-revealing, so this is spoiler-safe to show year-round (unlike the game
// itself, which stays sealed like any other).
//
// Source is the official All-Star SELECTIONS — the awards-recipients endpoint
// for each league's squad (award ids ALAS = AL, NLAS = NL). This is the
// authoritative list: it still names a player who was selected but then
// withdrew / was replaced and never appears in the game (e.g. a starter who
// pitched the prior Sunday, or a rookie held back for workload) — he earned the
// honor and stays an All-Star. An earlier version read the game's boxscore
// instead, which drops those withdrawn selectees (Jacob Misiorowski, a 2026 NL
// selection who was pulled from the game, was missing that way); the boxscore is
// now only a fallback for a season the awards data doesn't cover. Degrades to an
// empty Set (works fine before rosters are announced, after a season with no
// game, or off MLB).
export async function fetchAllStarRosterIds(season) {
  if (!season) return new Set()
  try {
    const rosters = await Promise.all(
      ['ALAS', 'NLAS'].map((award) =>
        getJson(`/api/v1/awards/${award}/recipients?sportId=1&season=${season}`).catch(() => null),
      ),
    )
    const ids = new Set()
    for (const r of rosters) {
      for (const a of r?.awards ?? []) {
        if (a.player?.id) ids.add(a.player.id)
      }
    }
    if (ids.size > 0) return ids
    return await fetchAllStarBoxscoreIds(season)
  } catch {
    return new Set()
  }
}

// Fallback for fetchAllStarRosterIds: the All-Star Game's own boxscore rosters,
// read via the schedule's gameType=A entry. Used only when the awards-recipients
// source above comes back empty for a season. Misses selectees who withdrew (see
// above), but populated as soon as rosters are announced — better than nothing.
async function fetchAllStarBoxscoreIds(season) {
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
}
