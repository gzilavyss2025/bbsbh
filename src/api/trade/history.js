// The trade that brought a player to his club, for the trade card's sheet
// (/trade). Live: one wire call for the club he came from on the trade's date,
// grouped by the transaction id (src/lib/trade/history.js), then one people
// call for where each player in it is now. Season WAR comes from war.json.
import { getJson } from '../statsapi.js'
import { fetchWarData } from '../war.js'
import { groupTrade } from '../../lib/trade/history.js'

export async function loadTrade(playerId, how, toId) {
  if (!how?.fromId || !how?.date) return null
  const day = how.date.slice(0, 10)
  const wire = await getJson(`/api/v1/transactions?teamId=${how.fromId}&startDate=${day}&endDate=${day}`)
  const trade = groupTrade(wire.transactions ?? [], playerId, toId)
  if (!trade) return null
  const ids = [...trade.got, ...trade.gave].map((p) => p.id)
  const [people, war] = await Promise.all([
    ids.length ? getJson(`/api/v1/people?personIds=${ids.join(',')}&hydrate=currentTeam`).catch(() => null) : null,
    fetchWarData().catch(() => null),
  ])
  const now = new Map((people?.people ?? []).map((p) => [p.id, p]))
  const enrich = (p) => {
    const person = now.get(p.id)
    const bat = war?.bat?.[p.id], pit = war?.pit?.[p.id]
    return {
      ...p,
      pos: person?.primaryPosition?.abbreviation ?? null,
      nowTeam: person?.currentTeam?.name ?? null,
      active: person?.active ?? null,
      war: bat == null && pit == null ? null : (bat ?? 0) + (pit ?? 0),
    }
  }
  return { ...trade, got: trade.got.map(enrich), gave: trade.gave.map(enrich), warSeason: war?.season ?? null }
}
