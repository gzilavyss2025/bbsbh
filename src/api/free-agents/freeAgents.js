import { getJson } from '../statsapi.js'
import { fetchWarData } from '../war.js'
import { fetchPlayerContract, fetchContractsSeason } from '../person/contracts.js'
import { hitterHoverFields, pitcherHoverFields } from '../playerHoverCard.js'

// The free-agent class (#2509): everyone who filed for free agency after a
// season, where he played last, and where he signed. One live read of
// `/api/v1/people/freeAgents?season=YYYY` (about 250 KB for a full class, so
// only this page fetches it), joined by player id to war.json (sort + value),
// one `/people` call for that season's stat line, and the Cot's contract shard
// for the deal that just ran out. Open surface (ADR-0034): no game result.
//
// Feed shape, checked against season 2026 on 2026-11-02: each row has
// `player {id, fullName}`, `position {abbreviation}`, `originalTeam {id, name}`,
// `newTeam {id?, name?}` (only `link` until he signs), `dateDeclared`,
// `dateSigned` (absent until he signs) and an optional `notes` string.

// The one note that marks a minor-league free agent. The MLB-only default hides
// these rows and nothing else: declined options, waiver claims and trades stay,
// with the note shown on the row (Gary, 2026-11-02).
const MINOR_LEAGUE_NOTE = 'Minor League Free Agent'

export const POSITION_GROUPS = ['P', 'C', 'IF', 'OF', 'DH']

const GROUP_OF = {
  P: 'P', SP: 'P', RP: 'P', TWP: 'P',
  C: 'C',
  '1B': 'IF', '2B': 'IF', '3B': 'IF', SS: 'IF', IF: 'IF',
  LF: 'OF', CF: 'OF', RF: 'OF', OF: 'OF',
  DH: 'DH',
}

export function positionGroup(abbr) {
  return GROUP_OF[abbr] ?? null
}

const OPTION_DECLINED = /option declined|declined (club|player|mutual) option/i

// A feed note in sentence case, without a trailing full stop: the feed writes
// "Claimed off waivers.", "Claimed Off Waivers." and "Club Option Declined".
export function cleanNote(note) {
  if (!note) return ''
  const s = String(note).trim().replace(/\.$/, '').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function mapFreeAgent(row, { war } = {}) {
  const id = row?.player?.id ?? null
  const newTeamId = row?.newTeam?.id ?? null
  const signed = Boolean(row?.dateSigned && newTeamId)
  const pos = row?.position?.abbreviation ?? ''
  const rawNote = row?.notes ?? ''
  const warValue = id == null ? null : sumWar(war, id)
  return {
    id,
    name: row?.player?.fullName ?? '',
    pos,
    group: positionGroup(pos),
    isPitcher: positionGroup(pos) === 'P',
    teamId: row?.originalTeam?.id ?? null,
    teamName: row?.originalTeam?.name ?? '',
    newTeamId: signed ? newTeamId : null,
    newTeamName: signed ? (row?.newTeam?.name ?? '') : '',
    signed,
    // Back with the club he left (an exercised option, a quick re-sign).
    resigned: signed && newTeamId === (row?.originalTeam?.id ?? null),
    dateDeclared: row?.dateDeclared ?? null,
    dateSigned: signed ? row.dateSigned : null,
    minor: rawNote === MINOR_LEAGUE_NOTE,
    optionDeclined: OPTION_DECLINED.test(rawNote),
    note: rawNote === MINOR_LEAGUE_NOTE ? '' : cleanNote(rawNote),
    war: warValue,
  }
}

function sumWar(war, id) {
  const bat = war?.bat?.[id]
  const pit = war?.pit?.[id]
  if (bat == null && pit == null) return null
  return Math.round(((bat ?? 0) + (pit ?? 0)) * 10) / 10
}

// Highest WAR first; a player with no WAR sinks below every number, then name.
export function sortFreeAgents(rows) {
  return [...rows].sort((a, b) => {
    const aw = a.war ?? -Infinity
    const bw = b.war ?? -Infinity
    if (aw !== bw) return bw - aw
    return a.name.localeCompare(b.name)
  })
}

export function filterFreeAgents(rows, { group = null, teamId = null, unsignedOnly = false, includeMinors = false } = {}) {
  return rows.filter(
    (r) =>
      (includeMinors || !r.minor) &&
      (!group || r.group === group) &&
      (!teamId || r.teamId === teamId) &&
      (!unsignedOnly || !r.signed),
  )
}

// One short stat line: a slash line and homers for a hitter, ERA/IP/K (and
// saves when he has any) for a pitcher. A two-way player reads as his group.
export function statLine({ hitting, pitching } = {}, isPitcher) {
  if (isPitcher && pitching) {
    const sv = Number(pitching.saves) > 0 ? ` · ${pitching.saves} SV` : ''
    return `${pitching.era} ERA · ${pitching.inningsPitched} IP · ${pitching.strikeOuts} K${sv}`
  }
  if (!isPitcher && hitting) {
    return `${hitting.avg}/${hitting.obp}/${hitting.slg} · ${hitting.homeRuns} HR`
  }
  return ''
}

export function statsByPerson(people) {
  const out = {}
  for (const p of people ?? []) {
    const groups = {}
    for (const s of p?.stats ?? []) {
      const name = s?.group?.displayName
      const stat = s?.splits?.[0]?.stat
      if (name && stat) groups[name] = stat
    }
    out[p.id] = { age: p?.currentAge ?? null, ...groups }
  }
  return out
}

const PEOPLE_CHUNK = 150

async function fetchSeasonStats(ids, season, signal) {
  const chunks = []
  for (let i = 0; i < ids.length; i += PEOPLE_CHUNK) chunks.push(ids.slice(i, i + PEOPLE_CHUNK))
  const hydrate = `stats(group=[hitting,pitching],type=season,season=${season})`
  const pages = await Promise.all(
    chunks.map((c) =>
      getJson(`/api/v1/people?personIds=${c.join(',')}&hydrate=${encodeURIComponent(hydrate)}`, { signal }).catch(() => null),
    ),
  )
  return statsByPerson(pages.flatMap((p) => p?.people ?? []))
}

// The class, sorted, with each row's age and stat line. A failed stats read
// leaves the lines blank; a failed class read throws (the page shows a retry).
export async function loadFreeAgents(season, { signal } = {}) {
  const [json, war] = await Promise.all([
    getJson(`/api/v1/people/freeAgents?season=${season}`, { signal }),
    fetchWarData(),
  ])
  // war.json holds one season; a past class gets no WAR rather than the wrong year's.
  const seasonWar = Number(war?.season) === Number(season) ? war : null
  const rows = (json?.freeAgents ?? []).map((r) => mapFreeAgent(r, { war: seasonWar })).filter((r) => r.id != null)
  const stats = rows.length ? await fetchSeasonStats(rows.filter((r) => !r.minor).map((r) => r.id), season, signal) : {}
  return sortFreeAgents(
    rows.map((r) => ({ ...r, age: stats[r.id]?.age ?? null, stats: statLine(stats[r.id], r.isPitcher) })),
  )
}

// The deal that just ran out, or null. The Cot's file holds ONE season's
// contracts; for any other class it would show the wrong deal (a past class's
// player may already have signed the next one), so it shows nothing.
export function dealFor(contract, season) {
  const fileSeason = contract?.season ?? contract?.source?.season
  if (!contract?.terms || Number(fileSeason) !== Number(season)) return null
  return contract.terms
}

// Deals by player id for the rows on screen, read after the list draws. The
// shard reads are memoized, so a filter change refetches nothing it has seen.
// A missing shard or player is a dash, never a failure.
export async function loadLastDeals(ids, season) {
  // One shard first: if the file is another season, no deal can show, so the
  // rest are never fetched (a past class would otherwise pull every shard).
  const fileSeason = await fetchContractsSeason().catch(() => null)
  if (fileSeason != null && Number(fileSeason) !== Number(season)) return {}
  const deals = await Promise.all(ids.map((id) => fetchPlayerContract(id).catch(() => null)))
  const out = {}
  ids.forEach((id, i) => {
    const terms = dealFor(deals[i], season)
    if (terms) out[id] = terms
  })
  return out
}

// The home page's top free agents (OffseasonLead): the best unsigned major
// leaguers by WAR, nothing else. Pure, so the cut is testable.
export function topUnsigned(rows, n = 8) {
  return sortFreeAgents(rows.filter((r) => !r.signed && !r.minor)).slice(0, n)
}

// The same class read, but stats for the top few only — the full page reads
// stats for the whole class, too much for a block on the home page. Each row
// carries the player hover card's four stats (`fields`).
export async function loadTopFreeAgents(season, { signal, n = 8 } = {}) {
  const [json, war] = await Promise.all([
    getJson(`/api/v1/people/freeAgents?season=${season}`, { signal }),
    fetchWarData(),
  ])
  const seasonWar = Number(war?.season) === Number(season) ? war : null
  const rows = (json?.freeAgents ?? []).map((r) => mapFreeAgent(r, { war: seasonWar })).filter((r) => r.id != null)
  const top = topUnsigned(rows, n)
  const stats = top.length ? await fetchSeasonStats(top.map((r) => r.id), season, signal) : {}
  return top.map((r) => ({
    ...r,
    fields: r.isPitcher ? pitcherHoverFields(stats[r.id]?.pitching ?? null) : hitterHoverFields(stats[r.id]?.hitting ?? null),
  }))
}
