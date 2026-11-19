// One side of the trade card (/trade): a club's live 40-man roster (statsapi),
// joined to its Cot's ledger (team-contracts), war.json and the club's
// top-30 prospects. The prospects off the 40-man are listed too, since they
// trade as often as anyone on it. Every source degrades to "not posted yet":
// a missing ledger row is a player with no pay line, never a failed page.
import { getJson } from '../statsapi.js'
import { fetchTeamRoster } from '../team/fetch.js'
import { fetchTeamContracts } from '../salaries.js'
import { fetchWarData } from '../war.js'
import { fetchTopProspects, prospectRankById } from '../prospects/top100.js'
import { tradePlayer, combineLines } from '../../lib/trade/deal.js'
import { fetchTradePedigree } from './pedigree.js'
import { LEVEL_OF_SPORT } from '../../lib/trade/levelPct.js'

// Everyone the organization holds, every level (rosterType=fullRoster: ~250
// for an MLB club), each with his current affiliate. Verified against
// teams/158 on 2026-11-18: person.currentTeam names the affiliate.
async function fetchOrgRoster(teamId, season) {
  const data = await getJson(`/api/v1/teams/${teamId}/roster?rosterType=fullRoster&season=${season}&hydrate=person(currentAge,currentTeam)`)
  return data.roster ?? []
}

const LEVEL = LEVEL_OF_SPORT

// The organization's clubs (/teams/affiliates), fetched once per club and
// season: the level map and the farm lines both read it.
const affiliatesLoad = new Map()
function fetchOrgClubs(teamId, season) {
  const key = `${teamId}:${season}`
  if (!affiliatesLoad.has(key)) {
    affiliatesLoad.set(key, getJson(`/api/v1/teams/affiliates?teamIds=${teamId}&season=${season}`)
      .then((d) => d.teams ?? [])
      .catch(() => { affiliatesLoad.delete(key); return [] }))
  }
  return affiliatesLoad.get(key)
}

// teamId -> level ('MLB' for the parent club) for every club in the organization.
async function fetchOrgLevels(teamId, season) {
  const levels = new Map([[teamId, 'MLB']])
  for (const t of await fetchOrgClubs(teamId, season)) if (t.id !== teamId && LEVEL[t.sport?.id]) levels.set(t.id, LEVEL[t.sport.id])
  return levels
}

export async function loadTradeSide(teamId, { season = new Date().getFullYear() } = {}) {
  const [roster, ledger, war, prospects, org, levels, pedigree] = await Promise.all([
    fetchTeamRoster(teamId, season, { rosterType: '40Man' }).catch(() => []),
    fetchTeamContracts(teamId).catch(() => null),
    fetchWarData().catch(() => null),
    fetchTopProspects().catch(() => null),
    fetchOrgRoster(teamId, season).catch(() => []),
    fetchOrgLevels(teamId, season),
    fetchTradePedigree(teamId).catch(() => ({})),
  ])
  const byId = new Map((ledger?.groups ?? []).flatMap((g) => g.players).map((p) => [p.id, p]))
  // The ledger is one season's; the card prices the season after it.
  const nextYear = (ledger?.season ?? season) + 1
  const warOf = (id) => {
    const bat = war?.bat?.[id], pit = war?.pit?.[id]
    return bat == null && pit == null ? null : (bat ?? 0) + (pit ?? 0)
  }
  const orgList = (prospects?.orgProspects ?? []).filter((p) => p.teamId === teamId)
  const orgRank = new Map(orgList.map((p) => [p.playerId, p.orgRank]))
  const topRank = (id) => prospectRankById(prospects?.players ?? [], id) ?? null
  // This season's line from the roster hydrate: OPS for a hitter, ERA for a pitcher.
  const lineOf = (person, isPitcher) => {
    const group = (person.stats ?? []).find((g) => g.group?.displayName === (isPitcher ? 'pitching' : 'hitting'))
    const stat = group?.splits?.[0]?.stat
    if (!stat) return null
    return isPitcher ? { era: stat.era ?? null, ip: stat.inningsPitched ?? null } : { ops: stat.ops ?? null, pa: stat.plateAppearances ?? null }
  }

  const forty = roster
    .filter((r) => r.person?.id)
    .map((r) =>
      tradePlayer(
        { id: r.person.id, name: r.person.fullName, position: r.position?.abbreviation },
        { ledger: byId.get(r.person.id), war: warOf(r.person.id), orgRank: orgRank.get(r.person.id) ?? null, topRank: topRank(r.person.id), line: lineOf(r.person, r.position?.type === 'Pitcher' || r.position?.abbreviation === 'P'), nextYear },
      ),
    )
  const onForty = new Set(forty.map((p) => p.id))
  const minors = orgList
    .filter((p) => !onForty.has(p.playerId))
    .sort((x, y) => x.orgRank - y.orgRank)
    .map((p) => ({
      ...tradePlayer({ id: p.playerId, name: p.name, position: p.position, onForty: false }, { orgRank: p.orgRank, topRank: topRank(p.playerId), nextYear }),
      age: p.age ?? null,
    }))

  const orgById = new Map(org.filter((r) => r.person?.id).map((r) => [r.person.id, r.person]))
  const levelOf = (id) => orgById.get(id)?.currentTeam?.name ?? null
  for (const p of minors) p.level = levelOf(p.id)
  // The rest of the organization: no 40-man spot and no prospect ranking.
  const listed = new Set([...onForty, ...minors.map((p) => p.id)])
  const others = org
    .filter((r) => r.person?.id && !listed.has(r.person.id))
    .map((r) => ({
      ...tradePlayer({ id: r.person.id, name: r.person.fullName, position: r.position?.abbreviation, onForty: false }, { nextYear }),
      age: r.person.currentAge ?? null,
      level: r.person.currentTeam?.name ?? null,
    }))
    .sort((x, y) => x.name.localeCompare(y.name))

  // Every player gets how he joined the club and his draft pick (nightly file),
  // and the level he plays at now; the depth grid reads the level.
  const levelAt = (id) => levels.get(orgById.get(id)?.currentTeam?.id) ?? null
  for (const p of [...forty, ...minors, ...others]) {
    p.how = pedigree[p.id]?.how ?? null
    p.draft = pedigree[p.id]?.draft ?? null
    p.levelCode = levelAt(p.id) ?? (p.onForty ? 'MLB' : null)
    // Throwing hand, for the wire's RHP / LHP.
    p.throws = orgById.get(p.id)?.pitchHand?.code ?? null
  }
  // A minor-league player's position for the depth grid comes from the org roster,
  // which writes pitchers as P; the prospect list writes RHP/LHP.
  const depth = org
    .filter((r) => r.person?.id)
    .map((r) => ({ id: r.person.id, name: r.person.fullName, pos: r.position?.abbreviation, level: levelAt(r.person.id), war: warOf(r.person.id) }))

  return { teamId, nextYear, warSeason: war?.season ?? null, fortyCount: forty.length, forty, minors, others, depth }
}

// Minor-league 2026 lines for the whole farm, one call per affiliate (AAA to
// the complex leagues), loaded only when the card lists players off the 40-man.
// Verified 2026-11-18 on teams/158: /teams/affiliates names each club and its
// sport; a club's fullSeason roster hydrates that sport's season stats.
export async function loadMinorLines(teamId, { season = new Date().getFullYear() } = {}) {
  const clubs = (await fetchOrgClubs(teamId, season)).filter((t) => t.id !== teamId && LEVEL[t.sport?.id])
  const rosters = await Promise.all(clubs.map((t) =>
    getJson(`/api/v1/teams/${t.id}/roster?rosterType=fullSeason&season=${season}&hydrate=person(stats(type=season,group=[hitting,pitching],season=${season},sportId=${t.sport.id}))`)
      .then((d) => ({ club: t, roster: d.roster ?? [] }))
      .catch(() => ({ club: t, roster: [] })),
  ))
  // A player who moved levels gets one line across all of them; his club is
  // the highest level he reached, and `levels` lists them low to high.
  const byPlayer = new Map()
  for (const { club, roster } of rosters) {
    for (const r of roster) {
      const id = r.person?.id
      if (!id) continue
      const isPitcher = r.position?.type === 'Pitcher'
      const stat = r.person.stats?.find((g) => g.group?.displayName === (isPitcher ? 'pitching' : 'hitting'))?.splits?.[0]?.stat
      const e = byPlayer.get(id) ?? { isPitcher, stints: [] }
      e.stints.push({ sport: club.sport.id, club: club.teamName ?? club.name, stat })
      byPlayer.set(id, e)
    }
  }
  const lines = new Map()
  for (const [id, { isPitcher, stints }] of byPlayer) {
    const played = stints.filter((x) => x.stat)
    const order = [...stints].sort((a, b) => b.sport - a.sport)
    const top = order.at(-1)
    // His line at his highest level that he played at, for the "By level"
    // percentile: a population is one level, so a combined line would rank
    // AA-and-A+ at-bats against AA alone (prospect-trend's rule, #1279).
    const ranked = [...played].sort((a, b) => a.sport - b.sport)[0]
    lines.set(id, {
      level: [...new Set(order.map((x) => LEVEL[x.sport]))].join(' · '),
      club: top.club,
      ranked: ranked ? { sport: ranked.sport, isPitcher, ops: ranked.stat.ops ?? null, era: ranked.stat.era ?? null, pa: ranked.stat.plateAppearances ?? null, outs: ranked.stat.outs ?? null } : null,
      ...(played.length ? combineLines(played.map((x) => x.stat), isPitcher) : {}),
    })
  }
  return lines
}
