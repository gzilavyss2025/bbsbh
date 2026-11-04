import { pitcherTiles } from '../../../../api/person/stats.js'
import { postseasonHitterCols } from '../../../../api/player/postseasonRegister.js'
import { DASH } from '../../../../api/person/shared.js'

// The Overview extras card's pure view (#2010). Open surface (ADR-0034): no seal, no gate.

// postseasonByRoundView's rounds -> a tile row each, built as postseasonTilesView builds the Total.
export function roundRows(rounds, group, role) {
  return (rounds ?? []).map(({ gameType, series, stat }) => ({
    gameType,
    series,
    games: Number(stat.gamesPlayed) || 0,
    tiles: group === 'pitching'
      ? [...pitcherTiles(stat, role).slice(0, 4), { k: 'WHIP', v: stat.whip ?? DASH }]
      : postseasonHitterCols(stat),
  }))
}
