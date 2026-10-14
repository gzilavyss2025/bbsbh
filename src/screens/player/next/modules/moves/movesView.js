// The Transactions card's pure view (#2020): the career ledger as dated rows, newest first, with year dividers.
// The live card stretches its fold from 5 to 8 rows; this design is a fixed 8.
export const OPEN = 8

// "2023-06-29" -> "6/29/23", as on the board.
const shortDate = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`
}
const MARK = { add: '+', out: '−', move: '↔' }

// A row with no date is left off, and so is one after endDate. No row at all gives null, so the module reports empty.
// The IL code is told by its code, not its tone (IL rows have tone 'out'): a clay chip with words, no mark.
export function movesView(rows, endDate) {
  const kept = (rows ?? []).filter((r) => r?.date && (!endDate || r.date <= endDate))
  if (!kept.length) return null
  const seen = new Map()
  const perYear = new Map()
  for (const r of kept) perYear.set(r.year, (perYear.get(r.year) ?? 0) + 1)
  const out = kept.map((r, i) => {
    const base = `${r.date}-${r.code}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    const injured = r.code === 'IL'
    return {
      key: `${base}-${n}`,
      code: r.code,
      date: shortDate(r.date),
      iso: r.date,
      year: r.year,
      yearHead: i === 0 || r.year !== kept[i - 1].year ? { year: r.year, n: perYear.get(r.year) } : null,
      injured,
      mark: injured ? '' : (MARK[r.tone] ?? ''),
      chip: injured ? 'Injured list' : r.label,
      tone: injured ? 'out' : r.tone,
      description: r.description,
      links: r.links,
      club: r.club ?? null,
    }
  })
  const total = out.length
  return {
    rows: out,
    total,
    count: total,
    showAll: total > OPEN ? `Show all ${total} moves` : null,
    showFewer: 'Show fewer',
  }
}
