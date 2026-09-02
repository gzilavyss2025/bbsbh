// BOX LINES — the fetch half. Pulls the game-by-game rows behind a player's
// career line against one club, LIVE, on the tap that opens the sheet
// (ADR-0069). rows.js decides what a row is and which rows may exist; this
// file only gathers the two sources and hands them over.
//
// WHY LIVE, NOT THE NIGHTLY FILE. gen-vs-team-splits.mjs already walks every
// one of these games to fold the career line and throws the rows away. Keeping
// them would be 264,770 rows across the 837 rostered players (summed from the
// 2026-09-02 file), about 25 MB before scores — nine times the dataset, ~850 KB
// a club shard, so a lineup page would read 1.7 MB for a tap that may never
// come, and the cron would rewrite hundreds of shards into git every night.
// The score is not in the game log either, so the generator would need ~750
// club-season schedule calls a run on top. On a tap instead:
//
//   1. yearByYear (seasons only, ~1 KB) — which seasons he pitched or hit in;
//   2. one game log per season, in parallel, trimmed by `fields=` (a pitcher's
//      season is ~7 KB, a hitter's ~25 KB; whole they are 36 KB / 96 KB);
//   3. one schedule call for every matching gamePk (60 fit in one request,
//      ~22 KB trimmed) — the final score, the venue, day/night, the
//      abbreviations the box-score path needs, and the Final status the gate
//      requires. Verified live 2026-09-02; `opposingTeamId=` is IGNORED on the
//      game log (same rows with and without it), which is why step 2 filters
//      client-side.
//
// A twelve-season veteran is 14 requests and under 200 KB, once per session
// per (player, group, club, cutoff). Same endpoint the generator sweeps, one
// tier down: the file keeps the line, the tap fetches the rows.
//
// THE CUTOFF IS APPLIED UPSTREAM OF THE FETCH TOO. `logRequestPlan` asks for
// the cutoff season only through the day before the cutoff (`endDate`, honoured
// inclusively — verified), and never for a later season, so the game being
// scored is never requested. rows.js then re-applies the same gate on what
// came back, and drops anything the schedule does not report Final.
//
// Class: cutoff-gated (spoiler-manifest.json). Degrades to `null` on any
// failure so the sheet shows its retry state rather than an empty ledger.
import { getJson } from '../statsapi.js'
import { boxLineRows, logRequestPlan, matchingSplits } from './rows.js'

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
// statsapi took 60 gamePks in one call without complaint; chunked anyway so a
// long shared history (a division rival over fifteen seasons) cannot build a
// URL some proxy refuses.
const SCHEDULE_CHUNK = 60
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
  return pages.flatMap((p) => (p.dates ?? []).flatMap((d) => d.games ?? []))
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

async function load({ personId, group, opponentId, cutoff }) {
  const seasons = await fetchSeasons(personId, group)
  const plan = logRequestPlan(seasons, cutoff)
  if (!plan.length) return []
  const logs = await mapPool(plan, LOG_CONCURRENCY, (p) => fetchLog(personId, group, p))
  const splits = matchingSplits(logs.flat(), { opponentId })
  if (!splits.length) return []
  const schedule = await fetchSchedule([...new Set(splits.map((s) => s.game.gamePk))])
  return boxLineRows({ splits, schedule, group, cutoff })
}

// Memoize the REQUEST, not the result (see staticJson.js for why): the sheet
// and a second door on the same page may ask on the same tick.
const inFlight = new Map()

// The rows for one player against one club, or null when the fetch failed.
// `cutoff` is YYYY-MM-DD or null; `group` is 'pitching' | 'hitting'.
export function fetchBoxLinesVsClub({ personId, group, opponentId, cutoff = null }) {
  if (!personId || !opponentId || !LOG_FIELDS[group]) return Promise.resolve([])
  const key = `${personId}|${group}|${opponentId}|${cutoff ?? ''}`
  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      load({ personId, group, opponentId, cutoff }).catch(() => {
        // A failure is not memoized: the sheet's Try again should really try.
        inFlight.delete(key)
        return null
      }),
    )
  }
  return inFlight.get(key)
}
