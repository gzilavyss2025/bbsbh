// Builds test/fixtures/game-815863.trimmed.json — a field-trimmed snapshot of
// statsapi's /api/v1.1/game/815863/feed/live (Triple-A, BUF@ROC 2026-08-26),
// keeping only the paths src/api/challenges.js reads. Re-run this to refresh
// the fixture; the unit suite itself never touches the network.
//   node .scratch/abs-aaa-gate/build-fixture.mjs
import { writeFileSync } from 'node:fs'

const PK = 815863
const feed = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${PK}/feed/live`)).json()
const team = (t) => ({ id: t.id, name: t.name, abbreviation: t.abbreviation, sport: t.sport, league: t.league })

const out = {
  gamePk: feed.gamePk,
  gameData: {
    game: feed.gameData.game,
    datetime: { officialDate: feed.gameData.datetime?.officialDate },
    status: { abstractGameState: feed.gameData.status?.abstractGameState },
    teams: { away: team(feed.gameData.teams.away), home: team(feed.gameData.teams.home) },
    absChallenges: feed.gameData.absChallenges,
  },
  liveData: {
    linescore: { currentInning: feed.liveData.linescore?.currentInning },
    plays: {
      allPlays: feed.liveData.plays.allPlays.map((p) => ({
        about: { inning: p.about?.inning, halfInning: p.about?.halfInning, atBatIndex: p.about?.atBatIndex },
        result: { description: p.result?.description },
        ...(p.reviewDetails ? { reviewDetails: p.reviewDetails } : {}),
        playEvents: (p.playEvents ?? [])
          .filter((e) => e.isPitch)
          .map((e) => ({
            isPitch: true,
            pitchNumber: e.pitchNumber,
            ...(e.details?.hasReview ? { details: { hasReview: true } } : {}),
            ...(e.reviewDetails ? { reviewDetails: e.reviewDetails } : {}),
          })),
      })),
    },
  },
}
const path = new URL('../../test/fixtures/game-815863.trimmed.json', import.meta.url)
writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`)
console.log('wrote', path.pathname, JSON.stringify(out).length, 'bytes of JSON')
