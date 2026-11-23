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
function signingRow(id, s, years) {
  const byYear = new Map(s.cells.map((c) => [c.year, c]))
  return {
    id: Number(id),
    name: s.name,
    pos: s.pos ?? null,
    age: null,
    salary: null,
    cbt: null,
    regime: 'signed',
    estimated: s.cells.some((c) => c.rough),
    terms: s.terms,
    total: s.cells.reduce((t, c) => t + (c.value ?? 0), 0),
    aav: null,
    service: null,
    options: null,
    cells: years.map((year) => (byYear.has(year) ? { year, kind: 'guaranteed', value: byYear.get(year).value } : { year, kind: 'none' })),
    committed: s.cells.reduce((t, c) => t + (c.value ?? 0), 0),
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
    .map(([id, s]) => ({ row: signingRow(id, s, ledger.years), group: s.group ?? 'offRoster' }))
  if (!rows.length) return ledger

  const groups = ledger.groups.map((g) => ({ ...g, players: g.players.filter((p) => !rows.some((r) => r.row.id === p.id)) }))
  for (const { row, group } of rows) {
    let g = groups.find((x) => x.key === group)
    if (!g) groups.push((g = { key: group, label: group, players: [] }))
    g.players = [...g.players, row].sort((a, b) => (b.committed ?? 0) - (a.committed ?? 0))
  }
  const added = rows.map((r) => r.row)
  const totals = ledger.totals.map((t) => {
    const cells = added.map((r) => r.cells.find((c) => c.year === t.year)).filter((c) => c?.value != null)
    return { ...t, committed: t.committed + cells.reduce((s, c) => s + c.value, 0), players: t.players + cells.length }
  })
  const paid = added.reduce((n, r) => n + r.cells.filter((c) => PAID.has(c.kind)).length, 0)
  return {
    ...ledger,
    groups,
    totals,
    counts: { ...ledger.counts, guaranteed: (ledger.counts?.guaranteed ?? 0) + paid },
    payroll: totals[0]?.committed ?? 0,
    committedAfter: totals.slice(1).reduce((s, t) => s + t.committed, 0),
  }
}
