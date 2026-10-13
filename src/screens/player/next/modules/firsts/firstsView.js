// The Firsts card's pure view (#1895): which firsts a role shows, in order, as rows.
// The two orders are copied from PlayerHistoryTab.jsx, which the page swap (#1898) deletes.
export const FIRSTS_ORDER = ['debut', 'start', 'hit', 'xbh', 'hr', 'run', 'so']
export const PITCHER_FIRSTS_ORDER = ['debut', 'start', 'win', 'loss', 'save', 'so']

// "2023-03-30" -> "3/30/23", as on the board.
const shortDate = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`
}

// A first he has not reached is null (or has no date) and is left off.
// No row at all gives null, so the module reports empty.
export function firstsView({ firsts, role }) {
  const order = role === 'pitching' ? PITCHER_FIRSTS_ORDER : FIRSTS_ORDER
  const rows = order
    .filter((key) => firsts?.[key]?.date)
    .map((key) => {
      const f = firsts[key]
      const date = shortDate(f.date)
      return {
        key,
        label: f.label,
        date,
        path: f.path,
        oppId: f.oppId,
        where: f.oppAbbr ? `${f.isHome ? 'vs' : 'at'} ${f.oppAbbr}` : '',
      }
    })
  if (!rows.length) return null
  return { rows, count: `${rows.length} ${rows.length === 1 ? 'first' : 'firsts'}` }
}
