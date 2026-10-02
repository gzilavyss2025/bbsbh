// The per-game ingest and ship steps shared by the two ledger generators —
// gen-team-records.mjs (regular season, five levels) and
// gen-postseason-records.mjs (MLB postseason). Pulled out of the first so the
// second reads the SAME facts into the SAME row shape: every situational record
// is one predicate over a shipped row (src/api/teamRecords.js's RECORD_GROUPS),
// so a postseason row that differed in shape would need a second set of
// predicates. A generator file is a top-level script — importing one RUNS it —
// so the shared steps live here (scripts/CLAUDE.md).
//
// THREE calls per game, no more: the box score (team home runs and both
// starters' lines — a PROBABLE pitcher is a prediction and is wrong often
// enough to be useless for a record), and a field-pruned play-by-play at ~8 KB
// (the batted-around count, the one fact no other endpoint carries); the third,
// the date's schedule with its full linescore, is the caller's. The two bulk
// per-level fetches (pitcher handedness, season role facts) are made once per
// run by the caller and joined here at ingest.
import { getJson } from '../statsapi.mjs'
import {
  inningRuns,
  encodeInnings,
  decodeInnings,
  scoredFirstSide,
  leadTrailFlags,
  leadStateAfter,
  lastAtBatOutcome,
  inningsScoredMask,
  scoredInExtras,
  starterLine,
  isQualityStart,
  battedAroundHalves,
  PBP_FIELDS,
  firstPitcherKind,
  roleKey,
} from '../team-records.mjs'

// Only what the row needs. The unpruned box score is ~170 KB; this is a
// fraction of it, and a season backfill is ten thousand of them.
export const BOX_FIELDS =
  'teams,away,home,teamStats,batting,homeRuns,pitchers,players,stats,pitching,inningsPitched,earnedRuns'
// The two season numbers the opener inference needs and nothing else; the
// unpruned bulk pitching line is ~40 fields per pitcher at the level.
const ROLE_FIELDS = 'stats,splits,player,id,stat,gamesPlayed,gamesStarted'

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

// Every pitcher's throwing hand at one level, `{ [personId]: 'R' | 'L' }`.
// Resolved once per run and joined at ingest; an unresolved hand stores NULL
// and the app simply counts that game in neither the vs-RHS nor the vs-LHS
// row, which is the conservative degrade — never a guess.
export async function pitchHandsFor(sportId, season) {
  try {
    const data = await getJson(
      `/api/v1/sports/${sportId}/players?season=${season}&fields=people,id,pitchHand,code`,
    )
    const map = {}
    for (const p of data.people ?? []) {
      const code = p?.pitchHand?.code
      if (p?.id != null && (code === 'R' || code === 'L')) map[p.id] = code
    }
    return map
  } catch (err) {
    console.error(`pitch hands sportId ${sportId}: ${err.message}`)
    return {}
  }
}

// Every pitcher's season line at one level, `{ [personId]: { gamesPlayed,
// gamesStarted } }` — the facts the opener / early-exit split is inferred from
// (scripts/lib/team-records.mjs holds the inference and the argument for it).
// One bulk call per level per run, the same export-time-join shape the
// handedness map above uses. Returns NULL, not `{}`, when the call fails: an
// empty map would read as "no pitcher here has a role" and blank the level,
// while null tells the merge to leave the stored snapshot standing.
export async function pitcherRolesFor(sportId, season) {
  try {
    const data = await getJson(
      `/api/v1/stats?stats=season&group=pitching&season=${season}&sportId=${sportId}` +
        `&playerPool=all&limit=8000&fields=${ROLE_FIELDS}`,
    )
    const map = {}
    for (const split of data.stats?.[0]?.splits ?? []) {
      const id = split?.player?.id
      if (id == null) continue
      const stat = split.stat ?? {}
      map[id] = { gamesPlayed: Number(stat.gamesPlayed) || 0, gamesStarted: Number(stat.gamesStarted) || 0 }
    }
    return map
  } catch (err) {
    console.error(`pitcher roles sportId ${sportId}: ${err.message}`)
    return null
  }
}

// One game → the two rows it produces, one per club. Returns null when the
// game's own feeds fail, so the gamePk stays unmarked and is retried next run
// rather than being permanently missed. That includes the play-by-play: the
// row keeps the finished batted-around count, so a 0 written for a failed
// fetch would stay wrong until someone re-ingests the game by hand.
export async function rowsForGame({ game, sportId, date }, hands) {
  const gamePk = game.gamePk
  const [box, pbp] = await Promise.all([
    getJson(`/api/v1/game/${gamePk}/boxscore?fields=${BOX_FIELDS}`),
    getJson(`/api/v1/game/${gamePk}/playByPlay?fields=${PBP_FIELDS}`),
  ])
  const ba = battedAroundHalves(pbp?.allPlays)
  if (!ba) return null

  const ls = game.linescore ?? {}
  const innings = inningRuns(ls)
  const awayTotals = ls.teams?.away ?? {}
  const homeTotals = ls.teams?.home ?? {}
  const awayId = game.teams.away.team.id
  const homeId = game.teams.home.team.id
  const homeWon =
    game.teams.home.isWinner === true ? true : game.teams.away.isWinner === true ? false : null

  const starters = {
    away: starterLine(box.teams?.away),
    home: starterLine(box.teams?.home),
  }
  const season = Number(date.slice(0, 4))

  const side = (isHome) => {
    const me = isHome ? homeTotals : awayTotals
    const them = isHome ? awayTotals : homeTotals
    const myBox = isHome ? box.teams?.home : box.teams?.away
    const oppBox = isHome ? box.teams?.away : box.teams?.home
    const myStarter = isHome ? starters.home : starters.away
    const oppStarter = isHome ? starters.away : starters.home
    return {
      game_pk: gamePk,
      team_id: isHome ? homeId : awayId,
      season,
      sport_id: sportId,
      date,
      opp_id: isHome ? awayId : homeId,
      result: homeWon == null ? 'T' : homeWon === isHome ? 'W' : 'L',
      payload: {
        innings: encodeInnings(innings),
        isHome,
        runs: Number(me.runs) || 0,
        oppRuns: Number(them.runs) || 0,
        hits: Number(me.hits) || 0,
        oppHits: Number(them.hits) || 0,
        errors: Number(me.errors) || 0,
        oppErrors: Number(them.errors) || 0,
        homeRuns: Number(myBox?.teamStats?.batting?.homeRuns) || 0,
        oppHomeRuns: Number(oppBox?.teamStats?.batting?.homeRuns) || 0,
        scheduledInnings: Number(game.scheduledInnings) || Number(ls.scheduledInnings) || 9,
        dayNight: game.dayNight ?? '',
        doubleHeader: game.doubleHeader ?? 'N',
        gameNumber: Number(game.gameNumber) || 1,
        venueId: game.venue?.id ?? null,
        starterId: myStarter.id,
        starterOuts: myStarter.outs,
        starterEr: myStarter.earnedRuns,
        oppStarterId: oppStarter.id,
        oppStarterOuts: oppStarter.outs,
        oppStarterEr: oppStarter.earnedRuns,
        oppStarterHand: oppStarter.id != null ? (hands[oppStarter.id] ?? null) : null,
        battedAround: isHome ? ba.home : ba.away,
        oppBattedAround: isHome ? ba.away : ba.home,
      },
    }
  }
  return [side(false), side(true)]
}

// A shipped row. Keys are short because there are ~160 of these per club per
// season and the whole set is committed; a falsy value is OMITTED rather than
// written as 0/false/null, which is most of the saving (a typical row carries
// a dozen keys, not thirty). The reader treats an absent key as falsy — so the
// few whose 0 is a real answer, marked below, are written the long way.
export function shipRow(r, getaway, roles) {
  const p = r.payload
  const innings = decodeInnings(p.innings)
  const isHome = p.isHome === true
  const first = scoredFirstSide(innings)
  const { led, trailed } = leadTrailFlags(innings, isHome)
  const homeWon = r.result === 'T' ? null : isHome === (r.result === 'W')
  const { decided, walkOff } = lastAtBatOutcome(innings, homeWon)
  const won = r.result === 'W'

  const row = {
    d: r.date,
    o: r.opp_id,
    r: r.result,
    rs: p.runs,
    ra: p.oppRuns,
    hi: p.hits,
    ha: p.oppHits,
  }
  const put = (k, v) => {
    if (v) row[k] = v
  }
  put('h', isHome ? 1 : 0)
  put('e', p.errors)
  put('ea', p.oppErrors)
  put('hr', p.homeRuns)
  put('hra', p.oppHomeRuns)
  // Lead state after 6/7/8 completed innings: 1 ahead, -1 behind, 0 tied.
  // A 0 is a real answer here (the "Tied after 7" row), so it can't ride the
  // omit-if-falsy path — it is written whenever the inning was reached.
  for (const [key, n] of [['l6', 6], ['l7', 7], ['l8', 8]]) {
    const state = leadStateAfter(innings, n, isHome)
    if (state != null) row[key] = state
  }
  put('x', innings.length > p.scheduledInnings ? 1 : 0)
  // The club's own scoring line as a bitmask (see inningsScoredMask), plus the
  // one thing the mask cannot say on its own: whether any of that scoring
  // happened past the scheduled length. Together they answer "scored in the
  // top/bottom of the Nth" and "scored in extra innings" for a row that costs
  // a handful of bytes.
  put('ib', inningsScoredMask(innings, isHome))
  put('ix', scoredInExtras(innings, isHome, p.scheduledInnings) ? 1 : 0)
  put('sf', first ? (first === (isHome ? 'home' : 'away') ? 1 : -1) : 0)
  put('cb', won && trailed ? 1 : 0)
  put('ll', !won && r.result === 'L' && led ? 1 : 0)
  // A property of the GAME, not of the winner — both clubs played in a game
  // decided in the last at-bat, so both carry the flag and the row reads as a
  // record. `wo` is the directional half: +1 walked them off, -1 walked off.
  put('la', decided ? 1 : 0)
  put('wo', walkOff ? (won ? 1 : -1) : 0)
  put('ba', p.battedAround)
  // Both out totals ride around the omit-if-falsy path, as the lead states
  // above do: no out recorded is a real answer, the shortest outing there is,
  // while an ABSENT key keeps meaning "no pitching line at all" — the case
  // every starter-length row excludes rather than counts.
  if (p.starterOuts != null) row.si = p.starterOuts
  put('qs', isQualityStart(p.starterOuts, p.starterEr) ? 1 : 0)
  if (p.oppStarterOuts != null) row.oi = p.oppStarterOuts
  put('oh', p.oppStarterHand)
  // What each side's FIRST PITCHER was doing when the outing was short: an
  // opener, or a starter who exited early. Pitcher identity and season totals
  // stay in the authoring layer; the row ships the verdict alone, one digit.
  const roleOf = (id) => (id == null ? null : roles.get(roleKey(r.sport_id, id)))
  put('sk', firstPitcherKind(p.starterOuts, roleOf(p.starterId)))
  put('ok', firstPitcherKind(p.oppStarterOuts, roleOf(p.oppStarterId)))
  put('n', p.dayNight === 'night' ? 1 : 0)
  put('dh', p.doubleHeader !== 'N' ? 1 : 0)
  put('sg', r.seriesGame)
  put('sl', r.seriesLength)
  put('op', r.seriesOpener ? 1 : 0)
  put('fi', r.seriesFinale ? 1 : 0)
  put('ga', getaway ? 1 : 0)
  return row
}
