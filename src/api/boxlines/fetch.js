// BOX LINES — the fetch half (ADR-0069). Pulls the game-by-game rows behind a
// player's career line, LIVE, on the tap that opens the sheet. rows.js decides
// what a row is and which rows may exist; facets.js says which question is
// being asked; this file only gathers the two sources and hands them over.
//
// WHY LIVE, NOT THE NIGHTLY FILE. gen-vs-team-splits.mjs already walks these
// games to fold the career line and throws the rows away. Keeping them would be
// 264,770 rows across the 837 rostered players (summed from the 2026-09-02
// file), about 25 MB before scores — nine times the dataset, ~850 KB a club
// shard, so a lineup page would read 1.7 MB for a tap that may never come, and
// the cron would rewrite hundreds of shards into git every night. The score is
// not in the game log either, so the generator would need ~750 club-season
// schedule calls a run on top. On a tap instead:
//
//   1. yearByYear (seasons only, ~1 KB) — which seasons he pitched or hit in;
//   2. one game log per season, in parallel, trimmed by `fields=` (a pitcher's
//      season is ~7 KB, a hitter's ~25 KB; whole they are 36 KB / 96 KB);
//   3. one schedule call per chunk of his gamePks — the final score, the venue,
//      day/night, the abbreviations the box-score path needs, and the Final
//      status the gate requires. `opposingTeamId=` is IGNORED on the game log
//      (same rows with and without it — verified 2026-09-02), which is why
//      step 2 filters client-side;
//   4. one linescore call for each of the handful of schedule rows that came
//      back with no score — the games MLB left stuck at `Postponed` after they
//      were played (#1031). ~1% of a career, 47 bytes each, and a miss leaves
//      the row dropped exactly as before. SCORE_FIELDS below has the numbers.
//
// THE SCHEDULE IS FETCHED BY gamePk, FOR EVERY FACET. Issue #997 first
// specified a schedule call per (club, season) instead, to spare a long career
// the ~34 chunk calls a 2,000-game hitter costs at 60 gamePks each. Measured
// live 2026-09-02, that trade does not pay:
//
//   * A CHUNK IS MUCH BIGGER THAN 60. 162 gamePks came back in one call, 177 ms,
//     URL 1,193 chars. At the 120 used here a 2,000-game hitter is 17 calls,
//     not 34, and a pitcher's whole career is 3.
//   * A CLUB-SEASON COSTS MORE BYTES, NOT FEWER. It carries all 164 of the
//     club's games; a starter appeared in ~30 of them, so it is ~5x the bytes
//     for a pitcher and, once a traded season pulls two full club schedules,
//     more for a hitter too.
//   * IT LEAKS PAST THE CUTOFF. A club-season call must be bounded by date to
//     stay behind the cutoff, and `season=` + `endDate=` is a 400 — it takes
//     `startDate`/`endDate`, which is BOTH leaky and lossy: a call ending
//     2024-06-30 returned gamePk 746730 dated 2024-08-30 (a game rescheduled
//     out of the window keeps its original date's slot), and 2 of its 86 rows
//     came back with no score at all though the full-season call had them.
//
// Asking by gamePk needs no date bound to be safe: the only gamePks that exist
// are the ones the already-cutoff-bounded splits named, so a game at or after
// the cutoff is never requested, never mind dropped.
//
// THE CUTOFF IS APPLIED UPSTREAM OF THE FETCH TOO. `logRequestPlan` asks for
// the cutoff season only through the day before the cutoff (`endDate`, honoured
// inclusively — verified), and never for a later season. rows.js then
// re-applies the same gate on what came back, and drops anything the schedule
// does not report Final.
//
// ONE JOIN, MANY DOORS. The player page's Game lines card stacks up to nine
// doors on one player, and it is the SAME join behind all of them — the same
// seasons, the same game logs, the same schedule records — differing only in
// which finished rows each keeps. So the memo below caches the JOIN (the
// splits, the schedule records, and the scores recovered for the records that
// carry none), not the rows, and each facet runs its own `keep` through
// boxLineRows over the shared result. The second door on a card costs no
// requests at all.
//
// THE GAME TYPES ARE ASKED FOR, NOT FILTERED FOR (#1006). Both calls below
// carry `gameType=`, because statsapi answers a game-log question about the
// regular season unless it is told otherwise: a 2018 log for a player who
// played that October is 147 rows, all `R`, until the call names the rounds
// (verified 2026-09-10). Passing the list on the SEASONS call as well is what
// makes the postseason door cheap — `yearByYear&gameType=F,D,L,W` returns the
// five Octobers Yelich played, not his fourteen seasons, so the join fetches
// five game logs instead of fourteen and never asks about a summer he spent at
// home. `gameType=R` returns exactly what the bare call did on both endpoints
// (verified 2026-09-10 on 453286 and 592885), so the club door's fetch is
// unchanged by being made explicit. Which types a facet may ask for, and why
// the umbrella 'P' is never one of them, is rows.js's POSTSEASON.
//
// Class: cutoff-gated (spoiler-manifest.json). Degrades to `null` on any
// failure so the sheet shows its retry state rather than an empty ledger.
import { getJson } from '../statsapi.js'
import { facetPlan } from './facets.js'
import {
  boxLineRows,
  logRequestPlan,
  matchingSplits,
  REGULAR_SEASON,
  scorelessGamePks,
} from './rows.js'

// The fields each game-log split must keep for rows.js. `id` reaches both
// `opponent.id` and `team.id`; `gamePk`/`gameNumber` reach `game.*`.
const LOG_FIELDS = {
  pitching:
    'fields=stats,splits,date,gameType,isHome,isWin,opponent,id,team,game,gamePk,gameNumber,' +
    'stat,gamesStarted,inningsPitched,hits,runs,earnedRuns,strikeOuts,baseOnBalls',
  // `positionsPlayed` is the hitting log's own list of the positions he played
  // that day, in the order he played them, and it is what answers the pinch-hit
  // facet (#1002) without a single boxscore. It costs 3 KB on a 19 KB season
  // log (Yelich 2024, verified 2026-09-14) and it is asked for on every hitting
  // join, not just the pinch-hit one, because all of a card's doors share ONE
  // join — a second, differently-shaped join for one door would cost far more
  // than the 16%.
  hitting:
    'fields=stats,splits,date,gameType,isHome,isWin,opponent,id,team,game,gamePk,gameNumber,' +
    'positionsPlayed,abbreviation,' +
    'stat,hits,atBats,doubles,triples,homeRuns,rbi,baseOnBalls,stolenBases,strikeOuts',
}
const SCHEDULE_FIELDS =
  'fields=dates,games,gamePk,officialDate,gameNumber,dayNight,status,abstractGameState,' +
  'teams,away,home,score,team,id,abbreviation,venue,name,fieldInfo,turfType'
// `venue(fieldInfo)` is what puts the park's SURFACE on the row, and it is
// season-correct — Chase Field comes back Grass through 2018 and Artificial
// Turf from 2019, the season it was relaid (verified 2026-09-15). It costs 7%
// on this call (32.3 KB -> 34.7 KB over 73 gamePks), which is why it rides
// along on every facet's join rather than being fetched for the two surface
// doors alone: at that price a second, differently-shaped join would cost far
// more than carrying it, the same trade `positionsPlayed` made for #1002.
const SCHEDULE_HYDRATE = 'team,venue(fieldInfo)'
// The lineups pass asks for NOTHING but the nine names a side. It is a second
// call over the same gamePks rather than a hydrate on the one above, because
// folding `lineups` into the shared call costs +65% (32.3 KB -> 53.4 KB over
// 73 gamePks) on EVERY hitter's join, where two of a card's twenty-odd doors
// need it. Asked on its own it is 23.3 KB over the same games — the same bytes
// — and only the reader who opens one of those two doors ever pays them.
const LINEUP_FIELDS = 'fields=dates,games,gamePk,lineups,homePlayers,awayPlayers,id'
// THE SCORE A STUCK SCHEDULE ROW WILL NOT GIVE UP (#1031). Some games MLB left
// at `Postponed` were played: rained out, replayed the SAME DAY under the SAME
// gamePk, and the schedule row never updated. It still says Final with no score,
// so rows.js drops it — and a door then counts a game the sheet does not show.
//
// The schedule endpoint cannot tell such a game from one that was truly never
// played: `hydrate=linescore` answers `runs: null` on both (verified
// 2026-09-10). The game's OWN linescore can, and that is the whole fix. Over
// nine seasons' 406 scoreless-Final rows (2011, 2014, 2017, 2019–21, 2023,
// 2025, 2026), 400 came back with real runs and 6 with none — and the 6 are
// exactly the games that were never played (no plays either). So the recovery
// FAILS CLOSED by itself: no runs, no row, the same answer as before.
//
// It is one call per stuck row, `fields=`-trimmed to 47 bytes, and stuck rows
// are ~1% of a career: 2 on Scherzer's 33 postseason games, 22 on Yelich's
// 1,725, 33 on Freeman's 2,321, 69 on Cabrera's 2,797 — the worst measured.
// At six at a time that is 180–280 ms on the careers above (2026-09-15).
const SCORE_FIELDS = 'fields=teams,home,away,runs'
const SCORE_CONCURRENCY = 6
// A ceiling on the SOURCE going wrong, not on a long career: the worst career
// measured is 69, so nothing real approaches this. If the schedule endpoint
// ever stopped scoring games wholesale, this is what keeps a sheet from firing
// a request per game — and the gate simply stays as closed as it is today.
const SCORE_RECOVERY_CAP = 150
// 162 gamePks answered in one call (1,193-char URL, 177 ms) — verified
// 2026-09-02. Chunked at 120 anyway, ~900 chars, so a fifteen-year hitter's
// request can never build a URL some proxy refuses.
const SCHEDULE_CHUNK = 120
const LOG_CONCURRENCY = 4

// The seasons he appeared in UNDER THESE GAME TYPES — for the postseason
// facet, only the Octobers. A traded season comes back once per club stint
// (Scherzer's 2021 three times); logRequestPlan dedupes.
async function fetchSeasons(personId, group, gameTypes) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}&sportId=1` +
      `&gameType=${gameTypes.join(',')}&fields=stats,splits,season`,
  )
  return (data.stats?.[0]?.splits ?? []).map((s) => Number(s.season)).filter(Boolean)
}

async function fetchLog(personId, group, { season, endDate }, gameTypes) {
  const end = endDate ? `&endDate=${endDate}` : ''
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}&sportId=1` +
      `&gameType=${gameTypes.join(',')}${end}&${LOG_FIELDS[group]}`,
  )
  return data.stats?.[0]?.splits ?? []
}

async function fetchSchedule(gamePks) {
  const chunks = []
  for (let i = 0; i < gamePks.length; i += SCHEDULE_CHUNK) chunks.push(gamePks.slice(i, i + SCHEDULE_CHUNK))
  const pages = await Promise.all(
    chunks.map((pks) =>
      getJson(
        `/api/v1/schedule?sportId=1&gamePks=${pks.join(',')}&hydrate=${SCHEDULE_HYDRATE}&${SCHEDULE_FIELDS}`,
      ),
    ),
  )
  // statsapi repeats a game across `dates` entries (162 gamePks came back as
  // 164 rows), so the join list is deduped here. rows.js keys by gamePk and
  // would survive the repeat; deduping keeps the count honest for anything
  // that measures this list.
  const seen = new Set()
  const games = []
  for (const g of pages.flatMap((p) => (p.dates ?? []).flatMap((d) => d.games ?? []))) {
    if (!g?.gamePk || seen.has(g.gamePk)) continue
    seen.add(g.gamePk)
    games.push(g)
  }
  return games
}

// WAS HE IN THE STARTING LINEUP, game by game — a Map gamePk -> boolean over
// the same gamePks the join already holds. The schedule's `hydrate=lineups`
// returns nine names a side, in BATTING ORDER (index 0 is the leadoff man,
// checked against the boxscore's own `battingOrder` on gamePk 747043), and
// `fields=` trims them to bare ids.
//
// Coverage was measured across six full club seasons before this was built:
// every game that was actually PLAYED carries a full eighteen names back to
// 2008, and the only games without one are the games with no score, which the
// gate has already dropped. A game that still answers with no lineup is left
// OUT of the map rather than answered `false`, so rows.js can tell "he came
// off the bench" from "nobody posted a card".
async function fetchLineupStarts(personId, gamePks) {
  const chunks = []
  for (let i = 0; i < gamePks.length; i += SCHEDULE_CHUNK) chunks.push(gamePks.slice(i, i + SCHEDULE_CHUNK))
  const pages = await Promise.all(
    chunks.map((pks) =>
      getJson(`/api/v1/schedule?sportId=1&gamePks=${pks.join(',')}&hydrate=lineups&${LINEUP_FIELDS}`),
    ),
  )
  const starts = new Map()
  for (const g of pages.flatMap((p) => (p.dates ?? []).flatMap((d) => d.games ?? []))) {
    if (!g?.gamePk || starts.has(g.gamePk)) continue
    const home = g.lineups?.homePlayers ?? []
    const away = g.lineups?.awayPlayers ?? []
    if (!home.length || !away.length) continue
    starts.set(g.gamePk, [...home, ...away].some((p) => p?.id === personId))
  }
  return starts
}

// A small in-order pool: statsapi is public and shared, and a veteran's
// twenty seasons need not all land at once.
async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// THE SCORE OF A GAME THE SCHEDULE LEFT STUCK, off the game's own linescore —
// a Map gamePk -> { away, home } holding only the games that answered with
// both. Anything else, a miss or a throw, leaves the gamePk OUT of the map, and
// rows.js drops that row exactly as it does today: the recovery can put a
// played game back on the sheet, and it can do nothing else.
//
// `mapPool` and not `Promise.all`: statsapi is public and shared, and the worst
// career measured asks it 69 questions here.
async function fetchRecoveredScores(gamePks) {
  const found = await mapPool(gamePks, SCORE_CONCURRENCY, async (pk) => {
    try {
      const d = await getJson(`/api/v1/game/${pk}/linescore?${SCORE_FIELDS}`)
      const away = d.teams?.away?.runs ?? null
      const home = d.teams?.home?.runs ?? null
      return away == null || home == null ? null : [pk, { away, home }]
    } catch {
      return null
    }
  })
  return new Map(found.filter(Boolean))
}

// The two sources, joined and ready for the gate: every split that could
// produce a row, the schedule record for each one's game, and the scores
// recovered for the handful of records that carry none.
async function loadJoin({ personId, group, opponentId, gameTypes, cutoff }) {
  const seasons = await fetchSeasons(personId, group, gameTypes)
  const plan = logRequestPlan(seasons, cutoff)
  if (!plan.length) return { splits: [], schedule: [], recoveredScores: null }
  const logs = await mapPool(plan, LOG_CONCURRENCY, (p) => fetchLog(personId, group, p, gameTypes))
  const splits = matchingSplits(logs.flat(), { opponentId, gameTypes })
  if (!splits.length) return { splits: [], schedule: [], recoveredScores: null }
  const schedule = await fetchSchedule([...new Set(splits.map((s) => s.game.gamePk))])
  // Only the rows the gate turned away FOR WANT OF A SCORE, named by the gate
  // itself (rows.js), so nothing at or after the cutoff can be asked about.
  // It rides in the join rather than behind a facet, the way the lineups pass
  // does, because every door reads these rows — a door that counted a game its
  // own sheet then hid is the bug, and it must close for all of them at once.
  const stuck = scorelessGamePks({ splits, schedule, cutoff, gameTypes })
  const recoveredScores =
    stuck.length && stuck.length <= SCORE_RECOVERY_CAP ? await fetchRecoveredScores(stuck) : null
  return { splits, schedule, recoveredScores }
}

// Memoize the REQUEST, not the result (see staticJson.js for why): the sheet
// and a second door on the same page may ask on the same tick.
const inFlight = new Map()
// The lineups pass is memoized on the SAME key as the join it belongs to, so
// the two doors that need it share one pass and every other door pays nothing.
const lineupsInFlight = new Map()

function joinFor(key, args) {
  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      loadJoin(args).catch(() => {
        // A failure is not memoized: the sheet's Try again should really try.
        inFlight.delete(key)
        return null
      }),
    )
  }
  return inFlight.get(key)
}

function lineupStartsFor(key, personId, gamePks) {
  if (!lineupsInFlight.has(key)) {
    lineupsInFlight.set(
      key,
      fetchLineupStarts(personId, gamePks).catch(() => {
        // Not memoized on failure, same as the join: Try again should try.
        lineupsInFlight.delete(key)
        // An empty map leaves every row's `lineupStart` null, so the two doors
        // that asked render an empty sheet rather than a confidently wrong one.
        return new Map()
      }),
    )
  }
  return lineupsInFlight.get(key)
}

// The rows for one player under one facet, or null when the fetch failed.
// `cutoff` is YYYY-MM-DD or null; `group` is 'pitching' | 'hitting'; `facet`
// is one of the tagged objects facets.js knows, or null for every game.
export async function fetchBoxLines({ personId, group, cutoff = null, facet = null }) {
  if (!personId || !LOG_FIELDS[group]) return []
  const { opponentId, gameTypes, keep, narrowsSplits, needsLineups } = facetPlan(facet)
  if (narrowsSplits && !opponentId) return []
  const types = gameTypes ?? REGULAR_SEASON
  // Only a facet that narrows the game log itself belongs in the join key:
  // every other facet reads the SAME join and differs only in its `keep`, so
  // leaving them out of the key is what lets nine doors share one fetch.
  const key = [personId, group, cutoff ?? '', types.join('+'), narrowsSplits ? opponentId : ''].join('|')
  const join = await joinFor(key, { personId, group, opponentId, gameTypes: types, cutoff })
  if (!join) return null
  // Only the two lineup doors go back for a second pass, and only once a card.
  const lineupStarts = needsLineups
    ? await lineupStartsFor(key, personId, [...new Set(join.splits.map((s) => s.game.gamePk))])
    : null
  return boxLineRows({ ...join, group, cutoff, gameTypes: types, keep, lineupStarts })
}
