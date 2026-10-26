// Builds test/fixtures/game-<pk>.gameday.json — a field-trimmed snapshot of
// statsapi's /api/v1.1/game/<pk>/feed/live for the Gameday engine tests
// (src/api/gameday/, #2566). It keeps what computeHalfInningFeed, pitchers.js
// and challenges.js read, and drops the heavy per-pitch tracking (pitchData,
// hitData, timestamps). Re-run to refresh; the unit suite never touches the
// network.
//
//   node .scratch/gameday-engine/build-fixture.mjs 823036
//
// The fixtures this built, and what each is for:
//   823036  MIL@STL 2026-07-08 — ABS challenges at play AND pitch level, and a
//           manager's replay challenge (MA) on a pickoff, bottom 3rd.
//   823169  MIN@SF 2026-09-21 — the umpires' own reviews (NO, NH: no club)
//           beside nine ABS challenges.
//   815625  13 innings, five failed away challenges — the extra-inning refill.
//   777747  BOS@MIL 2025-05-27 — Yelich's walk-off grand slam, bottom 10th.
//   778442  ATH@COL 2025-04-05 — a 5-4-3 triple play, top 2nd (ab 9).
//   778501  CHC@ATH 2025-03-31 — Carson Kelly's cycle.
//   824716, 816025, 823764, 823035 — the sub-step cases (ADR-0123): a wild pitch
//           mid-count, a steal on strike three, a caught stealing that ends the
//           half, five changes before a half's first pitch.
// Each carries `winProbability` (the separate endpoint, trimmed) when MLB serves it.
import { writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const PK = Number(process.argv[2])
if (!PK) throw new Error('usage: build-fixture.mjs <gamePk>')
const feed = await getJson(`/api/v1.1/game/${PK}/feed/live`)
// The win-probability endpoint, trimmed to what api/winprob.js reads; absent at
// most MiLB parks.
const wp = await getJson(`/api/v1/game/${PK}/winProbability`).catch(() => null)

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]))
const person = (p) => pick(p, ['id', 'fullName', 'firstName', 'lastName', 'useName', 'boxscoreName', 'primaryNumber', 'primaryPosition', 'batSide', 'pitchHand'])
const players = Object.fromEntries(Object.entries(feed.gameData.players ?? {}).map(([k, p]) => [k, person(p)]))
const boxTeam = (t) => ({
  team: pick(t.team, ['id', 'name', 'abbreviation']),
  battingOrder: t.battingOrder,
  pitchers: t.pitchers,
  batters: t.batters,
  players: Object.fromEntries(Object.entries(t.players ?? {}).map(([k, p]) => [k, {
    person: pick(p.person, ['id', 'fullName']),
    jerseyNumber: p.jerseyNumber,
    position: p.position,
    allPositions: p.allPositions,
    battingOrder: p.battingOrder,
    gameStatus: p.gameStatus,
  }])),
})
const event = (e) => ({
  ...pick(e, ['count', 'index', 'pitchNumber', 'isPitch', 'type', 'player', 'position', 'replacedPlayer', 'battingOrder', 'isSubstitution', 'base', 'reviewDetails', 'playId']),
  details: pick(e.details, ['call', 'description', 'code', 'type', 'event', 'eventType', 'isInPlay', 'isStrike', 'isBall', 'isOut', 'hasReview', 'runnerGoing', 'fromCatcher', 'disengagementNum']),
  ...(e.pitchData?.startSpeed != null ? { pitchData: { startSpeed: e.pitchData.startSpeed } } : {}),
  ...(e.hitData ? { hitData: pick(e.hitData, ['launchSpeed', 'launchAngle', 'totalDistance', 'trajectory', 'location', 'coordinates']) } : {}),
})

const out = {
  gamePk: feed.gamePk,
  gameData: {
    ...pick(feed.gameData, ['game', 'datetime', 'status', 'venue', 'absChallenges']),
    teams: { away: pick(feed.gameData.teams.away, ['id', 'name', 'abbreviation', 'teamName', 'sport', 'league']), home: pick(feed.gameData.teams.home, ['id', 'name', 'abbreviation', 'teamName', 'sport', 'league']) },
    players,
  },
  liveData: {
    linescore: pick(feed.liveData.linescore, ['scheduledInnings', 'currentInning', 'innings']),
    boxscore: { teams: { away: boxTeam(feed.liveData.boxscore.teams.away), home: boxTeam(feed.liveData.boxscore.teams.home) } },
    plays: {
      allPlays: feed.liveData.plays.allPlays.map((p) => ({
        ...pick(p, ['about', 'count', 'runners', 'reviewDetails']),
        result: pick(p.result, ['type', 'event', 'eventType', 'description', 'rbi', 'isOut', 'awayScore', 'homeScore']),
        matchup: { batter: pick(p.matchup?.batter, ['id', 'fullName']), pitcher: pick(p.matchup?.pitcher, ['id', 'fullName']), batSide: p.matchup?.batSide, pitchHand: p.matchup?.pitchHand },
        playEvents: (p.playEvents ?? []).map(event),
      })),
    },
  },
}
if (Array.isArray(wp)) {
  out.winProbability = wp.map((e) => ({
    about: pick(e.about, ['inning', 'isTopInning', 'atBatIndex', 'isScoringPlay']),
    homeTeamWinProbability: e.homeTeamWinProbability,
  }))
}
const path = new URL(`../../test/fixtures/game-${PK}.gameday.json`, import.meta.url)
writeFileSync(path, `${JSON.stringify(out)}\n`)
console.log('wrote', path.pathname, JSON.stringify(out).length, 'bytes of JSON')
