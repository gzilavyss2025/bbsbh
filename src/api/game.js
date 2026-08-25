// Per-game fetchers that aren't the live feed's own hydration: win
// probability, venue, managers, and a probable starter's season/last-game line.

import { getJson } from './statsapi.js'
import { SPORT_LABEL, MILB_LEVELS, teamAbbr } from '../lib/teams.js'
import { applyJsonPatch } from '../lib/jsonPatch.js'
import { num, outsToIp } from './person/shared.js'

// `options.fields` (array or comma-string) opts a caller into a pruned
// response — see PAST_GAME_FEED_FIELDS below for the one such caller. Omitted
// (GameView's useGameData, loadScorecard) the full feed comes back unchanged.
export async function fetchGameFeed(gamePk, options) {
  const { fields, ...rest } = options ?? {}
  const query = fields
    ? `?fields=${Array.isArray(fields) ? fields.join(',') : fields}`
    : ''
  return getJson(`/api/v1.1/game/${gamePk}/feed/live${query}`, rest)
}

// The COMPLETE feed read-set of the past-game "signals" path — the ONLY
// consumers of usePastGameSignals' cache: dayHighlights.js's
// classifyGameCards (slate pills), GameResultFace (flip-card back, which runs
// selectBoxscore → computePitcherLines), computePlayOfTheGame, and
// PostseasonSeriesPage. A full feed is ~760 KB and a revealed 16-game slate
// fetches one per final game; this allowlist cuts each to a fraction while
// keeping every field those consumers read (same fields=-prunes-the-payload
// idea as WIN_PROB_FIELDS below, and the same failure mode: a name missing
// here arrives `undefined` and blanks its surface with no error — verified
// output-identical against live finals, and pinned by test/past-game-fields.test.js).
// NOT for the in-game view: useGameData's feed reaches derive.js/playbyplay.js/
// linescore.js, whose read-set (pitchData, hitData, per-pitch details, …) is
// far wider and includes filter-opaque maps (docs/api-audit.md) — never pass
// this list there.
export const PAST_GAME_FEED_FIELDS = [
  // envelope + gameData: identity, names, numbers, game info
  'gamePk',
  'gameData',
  'teams',
  'away',
  'home',
  'id',
  'name',
  'teamName',
  'clubName',
  'abbreviation',
  'players',
  'fullName',
  'boxscoreName',
  'lastFirstName',
  'lastName',
  'firstName',
  'useName',
  'primaryNumber',
  'pitchHand',
  'code',
  'jerseyNumber',
  'battingOrder',
  'position',
  'allPositions',
  'person',
  'gameInfo',
  'gameDurationMinutes',
  'delayDurationMinutes',
  'venue',
  'timeZone',
  'tz',
  // liveData: decisions, boxscore, linescore
  'liveData',
  'decisions',
  'winner',
  'loser',
  'save',
  'boxscore',
  'info',
  'label',
  'value',
  'title',
  'fieldList',
  'note',
  'team',
  'pitchers',
  'stats',
  'seasonStats',
  'teamStats',
  'batting',
  'pitching',
  'atBats',
  'runs',
  'hits',
  'rbi',
  'baseOnBalls',
  'strikeOuts',
  'homeRuns',
  'triples',
  'doubles',
  'stolenBases',
  'avg',
  'inningsPitched',
  'earnedRuns',
  'numberOfPitches',
  'pitchesThrown',
  'battersFaced',
  'wins',
  'losses',
  'saves',
  'linescore',
  'innings',
  'num',
  'errors',
  'leftOnBase',
  // plays: only what computePitcherLines + the signal scanners walk
  'plays',
  'allPlays',
  'about',
  'inning',
  'halfInning',
  'endTime',
  'result',
  'type',
  'eventType',
  'event',
  'description',
  'matchup',
  'pitcher',
  'playEvents',
  'isPitch',
  'runners',
  'details',
  'isScoringEvent',
  'responsiblePitcher',
  'earned',
  'movement',
  'end',
  'count',
  'outs',
]

// The undocumented diffPatch mode: returns an array of RFC 6902 patch
// entries (`{ diff: [...] }`) covering everything that changed since
// `startTimecode`, OR — once the gap since `startTimecode` grows too large
// (observed ~200-300s; MLB sets no documented contract on the exact window)
// — silently degrades to returning a plain full-feed object instead, same
// shape as fetchGameFeed's response. Callers MUST branch on
// `Array.isArray(...)`; mergeFeedDiff below does this. See ADR-0032 and
// `.scratch/live-feed-diffpatch/findings.md` for how this was verified.
export async function fetchGameFeedDiff(gamePk, startTimecode, options) {
  return getJson(`/api/v1.1/game/${gamePk}/feed/live/diffPatch?startTimecode=${startTimecode}`, options)
}

// Merges a diffPatch response onto the last-known feed, or passes through a
// full-feed fallback response as-is. Returns null — never throws — on any
// apply failure or on a sanity-check mismatch (wrong gamePk), so callers can
// treat "no merge" as a plain signal to fall back to fetchGameFeed rather
// than needing their own try/catch. ALWAYS returns a fresh object distinct
// from `base` (never mutates it) — see jsonPatch.js's header for why that's
// load-bearing (ADR-0007).
export function mergeFeedDiff(base, diffResponse, gamePk) {
  try {
    let merged = diffResponse
    if (Array.isArray(diffResponse)) {
      // Seed with an empty-ops apply so an ZERO-entry response (nothing
      // changed since the last poll) still returns a NEW clone rather than
      // `base` itself by reference — a same-reference "merge" is exactly the
      // case ADR-0007's identity-keyed reveal cache can't tell apart from
      // "nothing to invalidate for."
      merged = applyJsonPatch(base, [])
      for (const entry of diffResponse) {
        merged = applyJsonPatch(merged, entry.diff)
      }
    }
    return merged && String(merged.gamePk ?? '') === String(gamePk) ? merged : null
  } catch {
    return null
  }
}

// Per-play win probability — the ONLY source of WPA, which is absent from the
// live feed (verified: /feed/live carries no homeTeamWinProbabilityAdded). It
// powers three consumers, so it's fetched lazily with the game view and resolves
// null on failure — many MiLB parks don't compute it, and it must never take the
// game view down. Score-revealing (like the feed itself), so the caller only
// turns it into DOM behind the reveal gate (the box-score seal, or the innings
// view's `revealedThrough` clamp).
//
// The unpruned response is ~186 KB gzipped — nearly a whole second feed —
// because each play entry carries the full `playEvents` pitch-by-pitch array
// (~85% of the payload), which this app never reads (it takes pitch data from
// /feed/live instead). WIN_PROB_FIELDS is the COMPLETE read-set of the THREE
// consumers — `computeThreeStars` + `computePlayOfTheGame` in boxscore.js (which
// read the per-play delta `homeTeamWinProbabilityAdded`) AND `selectWinProbPath`
// in winprob.js → the WinProbChart line, which reads the CUMULATIVE
// `homeTeamWinProbability` plus `about.isScoringPlay` and `about.atBatIndex`
// (the at-bat-stepping clamp, ADR-0016 — see its `stepHalfIndex`/
// `throughAtBatIndex` doc) — so the `fields=` allowlist prunes the payload
// while keeping every field those three read. The
// MLB `fields=` filter matches key names at any depth, so a nested read like
// `about.isScoringPlay` needs BOTH `about` and `isScoringPlay` listed. `matchup`
// keeps BOTH `batter` and `pitcher` (three stars credit the pitcher the inverse
// WPA — dropping `pitcher` silently corrupts the stars on games a pitcher stars
// in). If you read a NEW field off a win-prob entry, add its name here or it
// arrives `undefined` — this is exactly how the WinProbChart once went blank
// (`homeTeamWinProbability` was missing from the list; pinned now by
// test/winprob.test.js).
export const WIN_PROB_FIELDS = [
  'homeTeamWinProbability',
  'homeTeamWinProbabilityAdded',
  'atBatIndex',
  'about',
  'captivatingIndex',
  'inning',
  'isTopInning',
  'isScoringPlay',
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
]

export async function fetchWinProbability(gamePk) {
  try {
    const data = await getJson(
      `/api/v1/game/${gamePk}/winProbability?fields=${WIN_PROB_FIELDS.join(',')}`,
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
// So we match any job ending in "Manager", prefer an interim over a
// permanent one, and tag the interim with "(interim)" so the label stays
// honest.
//
// The endpoint defaults to the CURRENT roster, so a historical box score
// needs its game's own `season` passed through — otherwise a 2014 game shows
// today's skipper instead of the one who actually managed it (verified: the
// endpoint accepts `?season=YYYY` and returns that season's staff).
//
// A fired mid-season permanent manager's 'Manager' row is NOT removed from
// the roster once an interim replaces him — both appear in the same season's
// response (verified live: the 2026 Mets' coaches endpoint still lists
// Carlos Mendoza as 'Manager' alongside Andy Green as 'Interim Manager' after
// Mendoza was let go). An active interim appointment always means the
// permanent skipper isn't running the team right now, so the interim wins —
// the opposite of the old "prefer permanent" rule, which kept showing the
// fired manager for the rest of the season.
// ---------------------------------------------------------------------------

export async function fetchManager(teamId, season) {
  if (!teamId) return null
  try {
    const data = await getJson(
      `/api/v1/teams/${teamId}/coaches${season ? `?season=${season}` : ''}`,
    )
    const roster = data.roster ?? []
    // jobId, not a job-name match — the coaches endpoint also has an
    // 'Associate Manager' role (jobId 'ASSM'), a senior-advisor title that
    // isn't a second team manager but would false-match a "manager" regex.
    const managers = roster.filter((r) => r.jobId === 'MNGR' || r.jobId === 'NTRM')
    // Prefer the Interim Manager over a permanent 'Manager' if both appear —
    // see the comment block above.
    const mgr =
      managers.find((r) => r.job !== 'Manager') ?? managers[0] ?? null
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

// ---------------------------------------------------------------------------
// A pitcher's most recent appearance, whatever level it came at — a rehabbing
// big leaguer's last time out is often a MiLB start, and a MiLB starter can
// straddle a level in either direction around a promotion/option, so a single
// sportId-scoped gameLog call (the way the season line above is scoped to
// `game.sportId`) would miss it. statsapi's gameLog has no combined-level
// query (same limitation statsLevels.js documents for season totals), so this
// fans out one gameLog call per level — MLB plus every full-season MiLB level
// — and keeps whichever split has the latest date strictly BEFORE
// `cutoffDate` (the officialDate of the game being staged). That cutoff is the
// whole spoiler defense, same as person.js's gameLogView: it can never
// resolve to tonight's own outing once the feed starts reflecting it. Falls
// back to last season's log when the current season has no eligible start
// yet (the first week or two of a new year).
// ---------------------------------------------------------------------------

const LAST_GAME_SPORT_IDS = [1, ...MILB_LEVELS.map((l) => l.sportId)]

async function fetchGameLogSplits(personId, season, sportId) {
  try {
    const sport = sportId !== 1 ? `&sportId=${sportId}` : ''
    const data = await getJson(
      `/api/v1/people/${personId}/stats?stats=gameLog&group=pitching&season=${season}${sport}`,
    )
    return data.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

export async function fetchPitcherLastGame(personId, season, cutoffDate) {
  if (!personId || !season) return null
  for (const yr of [season, season - 1]) {
    const perLevel = await Promise.all(
      LAST_GAME_SPORT_IDS.map((sportId) => fetchGameLogSplits(personId, yr, sportId)),
    )
    const eligible = perLevel
      .flat()
      .filter((s) => s.date && (!cutoffDate || s.date < cutoffDate))
    if (eligible.length === 0) continue
    eligible.sort((a, b) => (a.date < b.date ? 1 : -1))
    const s = eligible[0]
    const st = s.stat ?? {}
    return {
      date: s.date,
      opponent: teamAbbr(s.opponent ?? {}),
      home: Boolean(s.isHome),
      // Blank for MLB (the common case) — a level tag only earns its keep
      // when it's NOT tonight's own level, same convention as gameLogView's
      // tagLevel option.
      level: s.sport?.id && s.sport.id !== 1 ? SPORT_LABEL[s.sport.id] ?? '' : '',
      inningsPitched: st.inningsPitched ?? '',
      hits: st.hits ?? 0,
      earnedRuns: st.earnedRuns ?? 0,
      strikeOuts: st.strikeOuts ?? 0,
      baseOnBalls: st.baseOnBalls ?? 0,
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// The starter's summed line against TONIGHT'S OPPONENT, THIS SEASON — every
// regular-season start he's made against that one club so far this year,
// folded into one line (games, IP, H, ER, K, BB), sitting under his last-outing
// row. `games` carries each contributing start's date/home flag (not just a
// count) so a caller can format a single meeting exactly like
// fetchPitcherLastGame's line — the common case, one start against a given
// opponent in a season — and fall back to a summary only when there's more
// than one. Unlike fetchPitcherLastGame this never fans out across sportIds: a
// specific opponent team id belongs to one level, so a single gameLog call at
// tonight's own sportId already covers every start against them this season.
// Same cutoffDate discipline as fetchPitcherLastGame — a start on or after the
// game being staged must never fold in. Innings pitched are summed in OUTS
// (see outsToIp) so multi-game IP totals add correctly ("6.1" + "6.1" = "12.2",
// not "12.2" from naive decimal addition, which would read as 12 innings and 2
// tenths). Returns null when he hasn't faced this opponent yet this season.
// ---------------------------------------------------------------------------

function ipToOuts(ip) {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}

export async function fetchPitcherSeasonVsOpponent(personId, season, opponentTeamId, cutoffDate, sportId = 1) {
  if (!personId || !season || !opponentTeamId) return null
  const splits = await fetchGameLogSplits(personId, season, sportId)
  const eligible = splits.filter(
    (s) =>
      s.gameType === 'R' &&
      s.opponent?.id === opponentTeamId &&
      s.date &&
      (!cutoffDate || s.date < cutoffDate),
  )
  if (eligible.length === 0) return null

  let outs = 0
  let hits = 0
  let earnedRuns = 0
  let strikeOuts = 0
  let baseOnBalls = 0
  for (const s of eligible) {
    const st = s.stat ?? {}
    outs += ipToOuts(st.inningsPitched)
    hits += num(st.hits)
    earnedRuns += num(st.earnedRuns)
    strikeOuts += num(st.strikeOuts)
    baseOnBalls += num(st.baseOnBalls)
  }
  return {
    games: eligible.map((s) => ({ date: s.date, home: Boolean(s.isHome) })),
    inningsPitched: outsToIp(outs),
    hits,
    earnedRuns,
    strikeOuts,
    baseOnBalls,
  }
}
