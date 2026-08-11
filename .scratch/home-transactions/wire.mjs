// The shared base for every version of this feed: fetch the wire, scope it to
// moves involving an MLB club, and apply the three de-duplication rules.
//
// Extracted so the flat feed and the joined feed cannot disagree about what a
// line is — the same "import the shaper, don't copy it" rule the generators in
// scripts/ follow.
import { getJson } from '../../src/api/statsapi.js'

export const iso = (d) => d.toISOString().slice(0, 10)

// The clubs and affiliate map every version needs.
export async function fetchContext(season) {
  const orgTeams = (await getJson('/api/v1/teams?sportId=1')).teams ?? []
  const orgIds = new Set(orgTeams.map((t) => t.id))
  const orgById = new Map(orgTeams.map((t) => [t.id, t]))
  const affil = await getJson(`/api/v1/teams/affiliates?teamIds=${[...orgIds].join(',')}&season=${season}`)
  const affilToOrg = new Map()
  for (const t of affil.teams ?? []) {
    if (t.id != null && t.parentOrgId != null) affilToOrg.set(t.id, t.parentOrgId)
  }
  return { orgTeams, orgIds, orgById, affilToOrg }
}

export async function fetchWire(startDate, endDate) {
  return (await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)).transactions ?? []
}

export const dateOf = (t) => t.effectiveDate || t.date || ''
export const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '').toLowerCase()

const fullness = (t) => (t.person ? 2 : 0) + (t.fromTeam && t.toTeam ? 1 : 0)

// The clubs named on a row, as an unordered set. A trade logged from each side
// carries the same pair, so it still collapses; two clubs that happen to file
// the same sentence on the same day do not. See the Max Muncy case.
export const clubKey = (t) =>
  [...new Set([t.fromTeam?.id, t.toTeam?.id].filter((id) => id != null))].sort().join('+')

// Which MLB club a row belongs to: the major-league club named on it, preferring
// the receiving side, and otherwise the parent org of whichever affiliate is
// named. An option reads "Reds optioned X to Louisville" — the affiliate is the
// destination, so the acting club is the origin.
export function clubOf(t, ctx) {
  for (const side of [t.toTeam, t.fromTeam]) {
    if (side && ctx.orgIds.has(side.id)) return ctx.orgById.get(side.id)
  }
  for (const side of [t.toTeam, t.fromTeam]) {
    const parent = ctx.affilToOrg.get(side?.id)
    if (parent) return ctx.orgById.get(parent)
  }
  return null
}

export const touchesMlb = (t, ctx) => ctx.orgIds.has(t.fromTeam?.id) || ctx.orgIds.has(t.toTeam?.id)

export function repeatShape(keep, rest) {
  const all = [keep, ...rest]
  const ids = new Set(all.map((t) => t.id))
  const people = new Set(all.map((t) => t.person?.id ?? 'none'))
  if (keep.typeCode === 'TR') {
    return people.size > 1
      ? 'A trade, logged once per player. Every row carries the one sentence that already names the whole deal.'
      : 'A trade, logged more than once on a single sentence.'
  }
  if (ids.size === 1) return 'The same wire id, logged more than once.'
  if (people.size === 1) return 'The same move for the same player, filed twice under different ids.'
  return 'The same sentence on the same day, from separate rows.'
}

// Scope, then de-duplicate. Returns the printable lines plus everything removed.
export function buildFeed(fetched, ctx, start, end) {
  const steps = []
  const record = (rule, why, removed) => steps.push({ rule, why, count: removed.length, rows: removed.slice(0, 500) })

  const inWindow = fetched.filter((t) => dateOf(t) >= start && dateOf(t) <= end)
  const backdated = fetched.filter((t) => t.date >= start && dateOf(t) < start)
  const lateFiled = inWindow.filter((t) => t.date < start)

  const mlbRows = inWindow.filter((t) => touchesMlb(t, ctx))
  record(
    'Scope — involves an MLB club',
    'Neither side of the move is a major-league club, so no major-league roster changed. This is most of the wire.',
    inWindow.filter((t) => !touchesMlb(t, ctx)),
  )

  const described = mlbRows.filter((t) => (t.description || '').trim())
  record(
    'Rule 1 — has a sentence to print',
    'The row carries no description at all, and this feed prints the wire’s own words.',
    mlbRows.filter((t) => !(t.description || '').trim()),
  )

  const groups = new Map()
  for (const t of described) {
    const key = `${dateOf(t)}|${clubKey(t)}|${norm(t.description)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }

  const feed = []
  const collapsed = []
  for (const [key, rows] of groups) {
    const sorted = rows.slice().sort((a, b) => fullness(b) - fullness(a) || (a.id ?? 0) - (b.id ?? 0))
    const [keep, ...rest] = sorted
    const shape = rest.length ? repeatShape(keep, rest) : null
    if (rest.length) collapsed.push({ key, keep, rest, shape })
    const club = clubOf(keep, ctx)
    feed.push({
      key,
      date: dateOf(keep),
      description: keep.description,
      typeCode: keep.typeCode,
      typeDesc: keep.typeDesc,
      personId: keep.person?.id ?? null,
      personName: keep.person?.fullName ?? '',
      club: club ? { id: club.id, name: club.name, abbr: club.abbreviation } : null,
      twoClubs: ctx.orgIds.has(keep.fromTeam?.id) && ctx.orgIds.has(keep.toTeam?.id),
      otherClub: (() => {
        if (!(ctx.orgIds.has(keep.fromTeam?.id) && ctx.orgIds.has(keep.toTeam?.id))) return null
        const mine = club?.id
        const other = keep.fromTeam.id === mine ? keep.toTeam : keep.fromTeam
        const rec = ctx.orgById.get(other.id)
        return rec ? { id: rec.id, name: rec.name, abbr: rec.abbreviation } : null
      })(),
      hasResolutionDate: Boolean(keep.resolutionDate),
      row: keep,
      duplicates: rest,
      shape,
    })
  }
  record(
    'Rule 2 — one line per sentence per day',
    'Another row on the same day carries the same sentence, so printing it would repeat a line word for word.',
    collapsed.flatMap((c) => c.rest),
  )

  feed.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.row.id ?? 0) - (b.row.id ?? 0))

  const byCode = new Map()
  for (const f of feed) {
    if (!byCode.has(f.typeCode)) byCode.set(f.typeCode, { code: f.typeCode, desc: f.typeDesc, n: 0 })
    byCode.get(f.typeCode).n += 1
  }
  const shapes = new Map()
  for (const c of collapsed) shapes.set(c.shape, (shapes.get(c.shape) ?? 0) + 1)

  return {
    start,
    end,
    counts: {
      inWindow: inWindow.length,
      mlbRows: mlbRows.length,
      described: described.length,
      printed: feed.length,
      removedAsRepeats: collapsed.reduce((n, c) => n + c.rest.length, 0),
      collapsedGroups: collapsed.length,
      backdatedOutsideWindow: backdated.length,
      lateFiled: lateFiled.length,
    },
    steps,
    byCode: [...byCode.values()].sort((a, b) => b.n - a.n),
    shapes: [...shapes].map(([shape, n]) => ({ shape, n })).sort((a, b) => b.n - a.n),
    feed,
    collapsed,
    backdated,
    lateFiled,
  }
}
