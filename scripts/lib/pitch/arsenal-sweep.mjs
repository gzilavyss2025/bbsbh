// Which Final games the arsenal sweep still owes (#2069). A game is done only when EVERY ledger
// has had it, so the row carries `need`: which of the three passes still has to run.
import { scopeOfGameType } from '../records/postseason.mjs'

// `ledgers` is { arsenal, command, hitter }: each a Set of `${gamePk}:${level}`.
export function acceptArsenalGame(g, level, ledgers) {
  const key = `${g.gamePk}:${level}`
  const need = Object.fromEntries(Object.entries(ledgers).map(([k, set]) => [k, !set.has(key)]))
  need.hitter &&= level === 'mlb' // the hitter grid is MLB only for now (ADR-0096)
  if (!Object.values(need).some(Boolean)) return null
  // The season comes from the game, never the clock (#1200).
  return { gamePk: g.gamePk, level, date: g.officialDate, season: Number(g.season ?? g.officialDate.slice(0, 4)), scope: scopeOfGameType(g.gameType), need }
}
