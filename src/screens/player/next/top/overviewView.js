import { pitcherTiles, RANK_STATS } from '../../../../api/person/stats.js'
import { postseasonHitterCols } from '../../../../api/player/postseasonRegister.js'
import { DASH } from '../../../../api/person/shared.js'

// The Overview extras card's pure view (#2010). Open surface (ADR-0034): no seal, no gate.

// The rank chips of one block, each with the hero tile it lights (`tile`, or null: R and 2B
// have no hero tile). Looked up by label in the block's own group, never by index.
export function chipsView(block) {
  const stats = RANK_STATS[block.group] ?? []
  return (block.ranks ?? []).map((r) => ({
    ...r,
    items: r.items.map((it) => ({ ...it, tile: stats.find((s) => s.label === it.label)?.tile ?? null })),
  }))
}

// "3 ranks · Postseason · AAA", built from counts, never from feed strings.
export function countTag(blocks) {
  const ranks = blocks.reduce((n, b) => n + (b.ranks ?? []).reduce((m, r) => m + r.items.length, 0), 0)
  const levels = [...new Set(blocks.flatMap((b) => (b.otherLevels ?? []).map((l) => l.level)))]
  return [
    ranks && `${ranks} ${ranks === 1 ? 'rank' : 'ranks'}`,
    blocks.some((b) => b.postseason) && 'Postseason',
    ...levels,
  ].filter(Boolean).join(' · ')
}

// One tile lit at a time; a second tap on the lit chip, or a chip with no tile, clears it.
export const nextLit = (lit, group, tile) =>
  !tile || (lit?.group === group && lit.tile === tile) ? null : { group, tile }

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
