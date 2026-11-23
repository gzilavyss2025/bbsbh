import NEW_SIGNINGS from './new-signings.json' with { type: 'json' }

// Hand-entered offseason deals (new-signings.json) laid over a club's Cot's
// ledger, for the weeks before Cot's posts them. Pure: takes the fetched
// ledger, returns a new one. The signing club gains a row and its totals move
// with it; the old club is left alone, since what it still owes him (a buyout,
// this season's pay) is real money Cot's already has right.
// A deal Cot's has caught up on (the player already on this club with a figure
// for next season) is skipped, so a stale entry never counts him twice.

const PAID = new Set(['salary', 'guaranteed'])

// One cell per ledger year, in order, as the generator writes them: the grid
// draws cells by position, so a missing year would shift every figure left.
// A re-signing (`old`, his row on this club already) keeps that row's cells
// for the years the new deal does not cover (this season's pay), and his age.
function signingRow(id, s, years, old = null) {
  const byYear = new Map(s.cells.map((c) => [c.year, c]))
  const oldCell = (year) => old?.cells?.find((c) => c.year === year)
  const cells = years.map((year) => (byYear.has(year)
    ? { year, kind: 'guaranteed', value: byYear.get(year).value }
    : oldCell(year) ?? { year, kind: 'none' }))
  return {
    id: Number(id),
    name: s.name,
    pos: s.pos ?? old?.pos ?? null,
    age: old?.age ?? null,
    salary: old?.salary ?? null,
    cbt: null,
    regime: 'signed',
    estimated: s.cells.some((c) => c.rough),
    terms: s.terms,
    total: s.cells.reduce((t, c) => t + (c.value ?? 0), 0),
    aav: null,
    service: old?.service ?? null,
    options: old?.options ?? null,
    cells,
    committed: cells.reduce((t, c) => t + (c.value ?? 0), 0),
    newDeal: true,
  }
}

export function applySignings(ledger, teamId, signings = NEW_SIGNINGS) {
  if (!ledger) return ledger
  const nextYear = ledger.season + 1
  const have = new Map(ledger.groups.flatMap((g) => g.players).map((p) => [p.id, p]))
  const rows = Object.entries(signings)
    .filter(([id, s]) => !id.startsWith('_') && s.teamId === teamId)
    .filter(([id]) => !have.get(Number(id))?.cells?.some((c) => c.year === nextYear && c.value != null))
    .map(([id, s]) => {
      const old = have.get(Number(id)) ?? null
      return { row: signingRow(id, s, ledger.years, old), old, group: s.group ?? 'offRoster' }
    })
  if (!rows.length) return ledger

  const groups = ledger.groups.map((g) => ({ ...g, players: g.players.filter((p) => !rows.some((r) => r.row.id === p.id)) }))
  for (const { row, group } of rows) {
    let g = groups.find((x) => x.key === group)
    if (!g) groups.push((g = { key: group, label: group, players: [] }))
    g.players = [...g.players, row].sort((a, b) => (b.committed ?? 0) - (a.committed ?? 0))
  }
  // Each year moves by the new row less the row it replaces (none, for a new arrival),
  // so a re-signing's kept cells are not counted twice.
  const cellOf = (r, year) => r?.cells?.find((c) => c.year === year)
  const totals = ledger.totals.map((t) => {
    let committed = t.committed
    let players = t.players
    for (const { row, old } of rows) {
      const now = cellOf(row, t.year)?.value ?? null
      const was = cellOf(old, t.year)?.value ?? null
      committed += (now ?? 0) - (was ?? 0)
      players += (now != null ? 1 : 0) - (was != null ? 1 : 0)
    }
    return { ...t, committed, players }
  })
  const paidIn = (r) => (r?.cells ?? []).filter((c) => PAID.has(c.kind)).length
  const paid = rows.reduce((n, { row, old }) => n + paidIn(row) - paidIn(old), 0)
  return {
    ...ledger,
    groups,
    totals,
    counts: { ...ledger.counts, guaranteed: (ledger.counts?.guaranteed ?? 0) + paid },
    payroll: totals[0]?.committed ?? 0,
    committedAfter: totals.slice(1).reduce((s, t) => s + t.committed, 0),
  }
}
