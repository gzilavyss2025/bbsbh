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
    result: { eventType: p.result?.eventType },
    matchup: { pitcher: { id: ID }, batSide: { code: p.matchup.batSide.code } },
    playEvents: p.playEvents.map((e) => ({
      isPitch: e.isPitch,
      details: { call: e.details?.call, type: e.details?.type, eventType: e.details?.eventType },
      ...(e.player && { player: { id: e.player.id } }),
      ...(e.pitchData && {
        pitchData: {
          startSpeed: e.pitchData.startSpeed,
          strikeZoneTop: e.pitchData.strikeZoneTop,
          strikeZoneBottom: e.pitchData.strikeZoneBottom,
          zone: e.pitchData.zone,
          coordinates: pick(e.pitchData.coordinates, ['pX', 'pZ', 'pfxX', 'pfxZ']),
          breaks: pick(e.pitchData.breaks, ['breakVerticalInduced', 'breakHorizontal']),
        },
      }),
      ...(e.hitData && { hitData: { ...pick(e.hitData, ['launchSpeed', 'launchAngle']), coordinates: pick(e.hitData.coordinates, ['coordX', 'coordY']) } }),
    })),
  }))
const p = feed.liveData.boxscore.teams.away.players[`ID${ID}`]
const g = feed.gameData
const out = {
  gamePk: 813024,
  gameData: {
    game: { type: g.game.type },
    venue: { id: g.venue?.id, name: g.venue?.name },
    datetime: { officialDate: g.datetime.officialDate },
    status: { codedGameState: g.status.codedGameState },
    teams: { away: { abbreviation: g.teams.away.abbreviation }, home: { abbreviation: g.teams.home.abbreviation, sport: { id: g.teams.home.sport?.id } } },
  },
  liveData: {
    linescore: { currentInning: feed.liveData.linescore.currentInning, teams: { away: { runs: feed.liveData.linescore.teams.away.runs }, home: { runs: feed.liveData.linescore.teams.home.runs } } },
    boxscore: { teams: { away: { players: { [`ID${ID}`]: { person: p.person, stats: { pitching: p.stats.pitching } } } } } },
    plays: { allPlays },
  },
}
writeFileSync('test/fixtures/game-813024.yamamoto.json', JSON.stringify(out) + '\n')
