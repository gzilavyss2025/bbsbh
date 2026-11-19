// One side of the trade card (/trade): a club's live 40-man roster (statsapi),
// joined to its Cot's ledger (team-contracts), war.json and the club's
// top-30 prospects. The prospects off the 40-man are listed too, since they
// trade as often as anyone on it. Every source degrades to "not posted yet":
// a missing ledger row is a player with no pay line, never a failed page.
import { getJson } from '../statsapi.js'
import { roleFromCounts } from '../../lib/roster/pitcherRole.js'
import { fetchTeamRoster, fetchAffiliates, fetchComplexAffiliates } from '../team/fetch.js'
import { loadCombinedPoolForTeams } from '../statsLevels.js'
import { fetchTeamContracts } from '../salaries.js'
import { fetchWarData, fetchWarHistory, warByYearFor } from '../war.js'
import { playerValue } from '../../lib/trade/value.js'
import { fetchTopProspects, prospectRankById } from '../prospects/top100.js'
import { tradePlayer, farmLine, farmIsPitcher, contractYears } from '../../lib/trade/deal.js'
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

// The organization's clubs, AAA through the complex leagues, from the team
// page's own readers (static affiliates.json first, then live): fetched once
// per club and season, since the level map and the farm lines both read it.
const orgClubsLoad = new Map()
function fetchOrgClubs(teamId, season) {
  const key = `${teamId}:${season}`
  if (!orgClubsLoad.has(key)) {
    orgClubsLoad.set(key, Promise.all([fetchAffiliates(teamId, season), fetchComplexAffiliates(teamId, season)])
      .then(([full, complex]) => {
        const clubs = [...full, ...complex].filter((t) => LEVEL[t.sportId])
        // The readers answer [] on a failure: don't keep that, so the next call tries again.
        if (!clubs.length) orgClubsLoad.delete(key)
        return clubs
      }))
  }
  return orgClubsLoad.get(key)
}

// teamId -> level ('MLB' for the parent club) for every club in the organization.
async function fetchOrgLevels(teamId, season) {
  return new Map([[teamId, 'MLB'], ...(await fetchOrgClubs(teamId, season)).map((t) => [t.id, LEVEL[t.sportId]])])
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
    return isPitcher ? { era: stat.era ?? null, ip: stat.inningsPitched ?? null, role: roleFromCounts(stat.gamesStarted, stat.gamesPitched, stat.saves) } : { ops: stat.ops ?? null, pa: stat.plateAppearances ?? null }
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

// What each player is worth to a club that gets him (lib/trade/value.js),
// added after the roster draws: his WAR by season from the stored history
// (one shard per hundred ids, so a club's 40-man and ranked prospects read up
// to ~50 small files) and this season's file, then the projection and surplus
// over his years of control. Answers a new side with new player rows, so a
// page holding the first answer re-renders when this one lands.
const pitcherPos = (p) => ['P', 'SP', 'RP', 'TWP', 'RHP', 'LHP'].includes(p.pos)
export async function valueTradeSide(side) {
  if (!side) return null
  const war = await fetchWarData().catch(() => null)
  const warSeason = war?.season ?? side.nextYear - 1
  const value = async (p, withHistory) => {
    const history = withHistory ? await fetchWarHistory(p.id).catch(() => null) : null
    const row = { ...p, role: p.line?.role ?? null }
    if (withHistory) row.warByYear = warByYearFor(p.id, pitcherPos(p) ? 'pitching' : 'hitting', war, history)
    row.value = playerValue(row, { nextYear: side.nextYear, warSeason, contractYears })
    // Next season's pay when the ledger has no figure: the estimate.
    if (row.payUsd == null && row.onForty && row.value.payEstUsd != null) row.payEstUsd = row.value.payEstUsd
    return row
  }
  const [forty, minors, others] = await Promise.all([
    Promise.all(side.forty.map((p) => value(p, true))),
    Promise.all(side.minors.map((p) => value(p, true))),
    Promise.all(side.others.map((p) => value(p, false))),
  ])
  return { ...side, forty, minors, others, valued: true }
}

// Minor-league lines for the whole farm, loaded only when the card lists
// players off the 40-man. The team page's stats pool (statsLevels.js) does the
// work: each club's season stats, summed per player across the levels he
// played, his club the highest level he reached.
export async function loadMinorLines(teamId, { season = new Date().getFullYear() } = {}) {
  const clubs = await fetchOrgClubs(teamId, season)
  const nameOf = new Map(clubs.map((t) => [t.id, t.name]))
  const pool = await loadCombinedPoolForTeams(clubs, season)
  const lines = new Map()
  for (const e of pool) {
    const isPitcher = farmIsPitcher(e)
    // His line at his highest level, for the "By level" percentile: a
    // population is one level, so a combined line would rank AA-and-A+ at-bats
    // against AA alone (prospect-trend's rule, #1279).
    const top = [...(isPitcher ? e.pitchingSplits : e.hittingSplits)].sort((a, b) => a.sport.id - b.sport.id)[0]
    lines.set(e.id, {
      level: e.levels.map((id) => LEVEL[id]).filter(Boolean).join(' · '),
      club: nameOf.get(e.teamId) ?? null,
      ranked: top ? { sport: top.sport.id, isPitcher, ops: top.stat.ops ?? null, era: top.stat.era ?? null, pa: top.stat.plateAppearances ?? null, outs: top.stat.outs ?? null } : null,
      ...farmLine(isPitcher ? null : e.hitting, isPitcher ? e.pitching : null),
    })
  }
  return lines
}
