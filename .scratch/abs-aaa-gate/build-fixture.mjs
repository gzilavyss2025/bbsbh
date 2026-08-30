// Builds a test/fixtures/game-<pk>.trimmed.json — a field-trimmed snapshot of
// statsapi's /api/v1.1/game/<pk>/feed/live, keeping only the paths
// src/api/challenges.js reads. Re-run to refresh; the unit suite itself never
// touches the network.
//
//   node .scratch/abs-aaa-gate/build-fixture.mjs            # 815863, the default
//   node .scratch/abs-aaa-gate/build-fixture.mjs 820258     # any other game
//
// The two fixtures this built, and what each is for:
//   815863  Triple-A, BUF@ROC 2026-08-26 — the reveal clamp on real AAA data.
//   820258  Single-A FSL, CLR@TAM 2026-07-11 — George M. Steinbrenner Field,
//           the park that runs the challenge system and reports NO
//           gameData.absChallenges bank (issue #964). Nine real challenges, of
//           which the current code derives seven: two are reviewType "MZ"
//           (issue #965) and one play carries two distinct challenges (#963).
//           Kept unedited so it stays a true record of the game.
//
// `venue` is kept because gameHasAbs reads venue.id for that allowlist.
import { writeFileSync } from 'node:fs'

const PK = Number(process.argv[2]) || 815863
const feed = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${PK}/feed/live`)).json()
const team = (t) => ({ id: t.id, name: t.name, abbreviation: t.abbreviation, sport: t.sport, league: t.league })

const out = {
  gamePk: feed.gamePk,
  gameData: {
    game: feed.gameData.game,
    datetime: { officialDate: feed.gameData.datetime?.officialDate },
    status: { abstractGameState: feed.gameData.status?.abstractGameState },
    teams: { away: team(feed.gameData.teams.away), home: team(feed.gameData.teams.home) },
    venue: { id: feed.gameData.venue?.id, name: feed.gameData.venue?.name },
    ...(feed.gameData.absChallenges ? { absChallenges: feed.gameData.absChallenges } : {}),
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
const path = new URL(`../../test/fixtures/game-${PK}.trimmed.json`, import.meta.url)
writeFileSync(path, `${JSON.stringify(out, null, 1)}\n`)
console.log('wrote', path.pathname, JSON.stringify(out).length, 'bytes of JSON')
