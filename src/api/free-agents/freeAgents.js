import { getJson } from '../statsapi.js'
import { fetchWarData } from '../war.js'
import { fetchPlayerContract } from '../person/contracts.js'

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
export const MINOR_LEAGUE_NOTE = 'Minor League Free Agent'

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

// The four header tiles, over the MLB-only list.
export function summarizeFreeAgents(rows) {
  const mlb = rows.filter((r) => !r.minor)
  const signed = mlb.filter((r) => r.signed)
  const unsigned = mlb.filter((r) => !r.signed)
  const latest = [...signed].sort((a, b) => String(b.dateSigned).localeCompare(String(a.dateSigned)))[0] ?? null
  const best = sortFreeAgents(unsigned).find((r) => r.war != null) ?? null
  return {
    declared: mlb.length,
    signed: signed.length,
    unsigned: unsigned.length,
    latest,
    best,
    optionsDeclined: mlb.filter((r) => r.optionDeclined).length,
  }
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

async function fetchSeasonStats(ids, season) {
  const chunks = []
  for (let i = 0; i < ids.length; i += PEOPLE_CHUNK) chunks.push(ids.slice(i, i + PEOPLE_CHUNK))
  const hydrate = `stats(group=[hitting,pitching],type=season,season=${season})`
  const pages = await Promise.all(
    chunks.map((c) =>
      getJson(`/api/v1/people?personIds=${c.join(',')}&hydrate=${encodeURIComponent(hydrate)}`).catch(() => null),
    ),
  )
  return statsByPerson(pages.flatMap((p) => p?.people ?? []))
}

// The class, sorted, with each row's age and stat line. A failed stats read
// leaves the lines blank; a failed class read throws (the page shows a retry).
export async function loadFreeAgents(season) {
  const [json, war] = await Promise.all([
    getJson(`/api/v1/people/freeAgents?season=${season}`),
    fetchWarData(),
  ])
  // war.json holds one season; a past class gets no WAR rather than the wrong year's.
  const seasonWar = Number(war?.season) === Number(season) ? war : null
  const rows = (json?.freeAgents ?? []).map((r) => mapFreeAgent(r, { war: seasonWar })).filter((r) => r.id != null)
  const stats = rows.length ? await fetchSeasonStats(rows.filter((r) => !r.minor).map((r) => r.id), season) : {}
  return sortFreeAgents(
    rows.map((r) => ({ ...r, age: stats[r.id]?.age ?? null, stats: statLine(stats[r.id], r.isPitcher) })),
  )
}

// The deal that just ran out, by player id, from the Cot's shards. Read after
// the list draws: a missing shard or player is a dash, never a failure.
export async function loadLastDeals(ids) {
  const deals = await Promise.all(ids.map((id) => fetchPlayerContract(id).catch(() => null)))
  const out = {}
  ids.forEach((id, i) => {
    if (deals[i]?.terms) out[id] = deals[i].terms
  })
  return out
}
