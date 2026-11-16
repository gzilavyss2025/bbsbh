// Rebuilds test/fixtures/game-813024.yamamoto.json: World Series 2025 Game 7,
// trimmed to Yoshinobu Yamamoto's (808967) plays and box line, and to the
// paths src/api/pitcher/gameCard.js reads. Run: node .scratch/pitcher-game-card/build-fixture.mjs
import { writeFileSync } from 'node:fs'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const ID = 808967
const feed = await getJson('/api/v1.1/game/813024/feed/live')
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]))
const allPlays = feed.liveData.plays.allPlays
  .filter((p) => p.matchup.pitcher.id === ID)
  .map((p) => ({
    about: { halfInning: p.about.halfInning },
    matchup: { pitcher: { id: ID }, batSide: { code: p.matchup.batSide.code } },
    playEvents: p.playEvents.map((e) => ({
      isPitch: e.isPitch,
      details: { call: e.details?.call, type: e.details?.type, eventType: e.details?.eventType },
      ...(e.player && { player: { id: e.player.id } }),
      ...(e.pitchData && {
        pitchData: {
          startSpeed: e.pitchData.startSpeed,
          zone: e.pitchData.zone,
          coordinates: pick(e.pitchData.coordinates, ['pX', 'pZ']),
          breaks: pick(e.pitchData.breaks, ['breakVerticalInduced', 'breakHorizontal']),
        },
      }),
      ...(e.hitData && { hitData: pick(e.hitData, ['launchSpeed', 'launchAngle']) }),
    })),
  }))
const p = feed.liveData.boxscore.teams.away.players[`ID${ID}`]
const out = {
  gamePk: 813024,
  liveData: {
    boxscore: { teams: { away: { players: { [`ID${ID}`]: { person: p.person, stats: { pitching: p.stats.pitching } } } } } },
    plays: { allPlays },
  },
}
writeFileSync('test/fixtures/game-813024.yamamoto.json', JSON.stringify(out) + '\n')
