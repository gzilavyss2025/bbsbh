// The Trade Simulator's grade for a real trade on the transaction wire. Each
// player is valued the way the simulator values him (lib/trade/value.js): his
// contract from either club's ledger (Cot's, plus a hand-entered new deal),
// his WAR history, and his age, role and playing time from one statsapi read.
// A club's value is what it got less what it gave; cash, whose amount the wire
// never states, counts as nothing (the line says so). Players are valued as
// they stand today, not on the day of the deal.
// Null when a player cannot be read, so a deal that cannot be scored gets no line.
import { fetchTeamContracts } from '../salaries.js'
import { fetchWarData, fetchWarHistory, warByYearFor } from '../war.js'
import { fetchTradePerson } from './person.js'
import { tradePlayer, contractYears } from '../../lib/trade/deal.js'
import { playerValue } from '../../lib/trade/value.js'
import { fetchTopProspects, prospectRankById } from '../prospects/top100.js'

const loads = new Map()

export function gradeWireTrade({ clubId, otherId, got, gave }) {
  const key = `${clubId}:${otherId}:${got.join(',')}:${gave.join(',')}`
  if (!loads.has(key)) loads.set(key, grade({ clubId, otherId, got, gave }).catch(() => null))
  return loads.get(key)
}

async function grade({ clubId, otherId, got, gave }) {
  const [a, b, war, prospects] = await Promise.all([
    fetchTeamContracts(clubId), fetchTeamContracts(otherId), fetchWarData(), fetchTopProspects().catch(() => null),
  ])
  // A prospect is valued by his rank, as on the simulator's card.
  const topRank = (id) => prospectRankById(prospects?.players ?? [], id) ?? null
  const orgRank = (id) => (prospects?.orgProspects ?? []).find((p) => p.playerId === id)?.orgRank ?? null
  const rows = new Map()
  // His row on either club; a hand-entered new deal wins over Cot's last word.
  for (const ledger of [b, a]) {
    for (const r of (ledger?.groups ?? []).flatMap((g) => g.players)) {
      if (!rows.has(r.id) || r.newDeal) rows.set(r.id, r)
    }
  }
  const season = a?.season ?? b?.season ?? war?.season ?? new Date().getFullYear() - 1
  const nextYear = season + 1
  const warSeason = war?.season ?? season
  const value = async (id) => {
    const [facts, history] = await Promise.all([fetchTradePerson(id).catch(() => null), fetchWarHistory(id).catch(() => null)])
    if (!facts) throw new Error(`no person ${id}`)
    const ledger = rows.get(id) ?? null
    // A big-league contract on file means a 40-man player; anyone else is a minor leaguer.
    const row = tradePlayer({ id, name: facts.name, position: facts.pos, onForty: ledger != null }, { ledger, nextYear, topRank: topRank(id), orgRank: orgRank(id) })
    const p = {
      ...row,
      age: row.age ?? facts.age,
      role: facts.role,
      pitcher: facts.pitcher,
      warByYear: warByYearFor(id, facts.pitcher ? 'pitching' : 'hitting', war, history),
      paByYear: facts.pa,
    }
    return playerValue(p, { nextYear, warSeason, contractYears }).surplusUsd ?? 0
  }
  const sum = async (ids) => (await Promise.all(ids.map(value))).reduce((t, v) => t + v, 0)
  const [inUsd, outUsd] = await Promise.all([sum(got), sum(gave)])
  return { valueUsd: inUsd - outUsd }
}
