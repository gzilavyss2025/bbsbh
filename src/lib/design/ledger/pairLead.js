// THE PAIR LEDGER'S RULES (#2455) — the pure part of components/ui/table/PairLedger.jsx.
// It decides which side of a row leads. It knows no unit, no sport and no threshold:
// the owning model passes the direction and the precision the reader sees.
//
//   a, b       the two figures: numbers or numeric strings. null, '' and NaN are
//              missing, and a missing figure is never zero and never a win.
//   lowerWins  true when a smaller figure is better (a league rank, an ERA).
//   digits     decimals the reader sees. Both figures round to it first, so
//              .2501 and .2504 shown as ".250" tie and mark nobody.
//
// Returns 'a', 'b' or null (a tie or a missing figure).
export function pairLead(a, b, { lowerWins = false, digits } = {}) {
  const x = shown(a, digits)
  const y = shown(b, digits)
  if (x == null || y == null || x === y) return null
  return (x > y) !== lowerWins ? 'a' : 'b'
}

function shown(v, digits) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number.parseFloat(v)
  if (!Number.isFinite(n)) return null
  return digits == null ? n : Number(n.toFixed(digits))
}
