// The small presentational pieces MORE THAN ONE player-hub tab renders, plus
// the two date formatters they share. Lifted out of the old single PlayerPage.jsx
// verbatim when the page became four tab routes — nothing here is new, and
// nothing here belongs to one tab (a piece only one tab draws stays in that
// tab's own screen).


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DASH = '—'

// "Jul 5, 2019" — a dated career event (the debut fact, every "first").
export function debutLabel(iso) {
  const [y, m, d] = (iso || '').split('-')
  return y ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}

// "2018 · Rd 1 #21", or the signing year for an undrafted player.
export function draftLabel(draft, signedYear) {
  if (draft && draft.year) {
    if (!draft.round) return String(draft.year)
    return `${draft.year} · Rd ${draft.round}${draft.overall ? ` #${draft.overall}` : ''}`
  }
  if (signedYear) return `Signed ${signedYear}`
  return DASH
}

export function roleWord(role) {
  return role === 'SP' ? 'starter' : role === 'CL' ? 'closer' : 'reliever'
}

export function Fact({ label, value, mono = false, wide = false }) {
  return (
    <div className={`fact${wide ? ' fact--wide' : ''}`}>
      <div className="fact__label">{label}</div>
      <div className={`fact__value${value === DASH ? ' fact__na' : ''}`}>
        {mono ? <span className="mono">{value}</span> : value}
      </div>
    </div>
  )
}
