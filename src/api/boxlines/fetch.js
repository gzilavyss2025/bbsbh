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
//      step 2 filters client-side.
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
// splits and the schedule records), not the rows, and each facet runs its own
// `keep` through boxLineRows over the shared result. The second door on a card
// costs no requests at all.
//
// Class: cutoff-gated (spoiler-manifest.json). Degrades to `null` on any
// failure so the sheet shows its retry state rather than an empty ledger.
import { getJson } from '../statsapi.js'
import { facetPlan } from './facets.js'
import { boxLineRows, logRequestPlan, matchingSplits, REGULAR_SEASON } from './rows.js'

// The fields each game-log split must keep for rows.js. `id` reaches both
// `opponent.id` and `team.id`; `gamePk`/`gameNumber` reach `game.*`.
const LOG_FIELDS = {
  pitching:
    'fields=stats,splits,date,gameType,isHome,isWin,opponent,id,team,game,gamePk,gameNumber,' +
    'stat,gamesStarted,inningsPitched,hits,runs,earnedRuns,strikeOuts,baseOnBalls',
  hitting:
    'fields=stats,splits,date,gameType,isHome,isWin,opponent,id,team,game,gamePk,gameNumber,' +
    'stat,hits,atBats,doubles,triples,homeRuns,rbi,baseOnBalls,stolenBases,strikeOuts',
}
const SCHEDULE_FIELDS =
  'fields=dates,games,gamePk,officialDate,gameNumber,dayNight,status,abstractGameState,' +
  'teams,away,home,score,team,id,abbreviation,venue,name'
// 162 gamePks answered in one call (1,193-char URL, 177 ms) — verified
// 2026-09-02. Chunked at 120 anyway, ~900 chars, so a fifteen-year hitter's
// request can never build a URL some proxy refuses.
const SCHEDULE_CHUNK = 120
const LOG_CONCURRENCY = 4

async function fetchSeasons(personId, group) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}&sportId=1&fields=stats,splits,season`,
  )
  return (data.stats?.[0]?.splits ?? []).map((s) => Number(s.season)).filter(Boolean)
}

async function fetchLog(personId, group, { season, endDate }) {
  const end = endDate ? `&endDate=${endDate}` : ''
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}&sportId=1${end}&${LOG_FIELDS[group]}`,
  )
  return data.stats?.[0]?.splits ?? []
}

async function fetchSchedule(gamePks) {
  const chunks = []
  for (let i = 0; i < gamePks.length; i += SCHEDULE_CHUNK) chunks.push(gamePks.slice(i, i + SCHEDULE_CHUNK))
  const pages = await Promise.all(
    chunks.map((pks) =>
      getJson(`/api/v1/schedule?sportId=1&gamePks=${pks.join(',')}&hydrate=team&${SCHEDULE_FIELDS}`),
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

// The two sources, joined and ready for the gate: every split that could
// produce a row, and the schedule record for each one's game.
async function loadJoin({ personId, group, opponentId, gameTypes, cutoff }) {
  const seasons = await fetchSeasons(personId, group)
  const plan = logRequestPlan(seasons, cutoff)
  if (!plan.length) return { splits: [], schedule: [] }
  const logs = await mapPool(plan, LOG_CONCURRENCY, (p) => fetchLog(personId, group, p))
  const splits = matchingSplits(logs.flat(), { opponentId, gameTypes })
  if (!splits.length) return { splits: [], schedule: [] }
  const schedule = await fetchSchedule([...new Set(splits.map((s) => s.game.gamePk))])
  return { splits, schedule }
}

// Memoize the REQUEST, not the result (see staticJson.js for why): the sheet
// and a second door on the same page may ask on the same tick.
const inFlight = new Map()

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

// The rows for one player under one facet, or null when the fetch failed.
// `cutoff` is YYYY-MM-DD or null; `group` is 'pitching' | 'hitting'; `facet`
// is one of the tagged objects facets.js knows, or null for every game.
export async function fetchBoxLines({ personId, group, cutoff = null, facet = null }) {
  if (!personId || !LOG_FIELDS[group]) return []
  const { opponentId, gameTypes, keep, narrowsSplits } = facetPlan(facet)
  if (narrowsSplits && !opponentId) return []
  const types = gameTypes ?? REGULAR_SEASON
  // Only a facet that narrows the game log itself belongs in the join key:
  // every other facet reads the SAME join and differs only in its `keep`, so
  // leaving them out of the key is what lets nine doors share one fetch.
  const key = [personId, group, cutoff ?? '', types.join('+'), narrowsSplits ? opponentId : ''].join('|')
  const join = await joinFor(key, { personId, group, opponentId, gameTypes: types, cutoff })
  if (!join) return null
  return boxLineRows({ ...join, group, cutoff, gameTypes: types, keep })
}
