// The small presentational pieces MORE THAN ONE player-hub tab renders, plus
// the two date formatters they share. Lifted out of the old single PlayerPage.jsx
// verbatim when the page became four tab routes — nothing here is new, and
// nothing here belongs to one tab (a piece only one tab draws stays in that
// tab's own screen).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DASH = '—'

export function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// "Jul 5" — the as-of cutoff, said the way a caption says it.
export function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}
// "Jul 5, 2019" — a dated career event (the debut fact, every "first").
export function debutLabel(iso) {
  const [y, m, d] = (iso || '').split('-')
  return y ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}

export function roleWord(role) {
  return role === 'SP' ? 'starter' : role === 'CL' ? 'closer' : 'reliever'
}

// `bar` marks one of a tab's top-level sections (2026 Stats, Analytics, Game
// log, Splits, Career stats, Player history — Recent workload / Recent form and
// Photos opt in the same way from their own components) so it wears the club bar
// (.section__title--bar in index.css); the sub-card headings underneath render
// through this same component without it.
// `aside` puts a control (the Career register's MLB-only pill) on the far end of
// the bar, the way SectionMasthead carries the lineup page's toggles.
export function SectionTitle({ title, note, primary = false, bar = false, aside = null }) {
  return (
    <h3
      className={`section__title${primary ? ' section__title--primary' : ''}${bar ? ' section__title--bar' : ''}${aside ? ' section__title--aside' : ''}`}
    >
      <span>{title}</span>
      {note && <em>{note}</em>}
      {aside}
    </h3>
  )
}

// The five-tile "Current season" grid — shared by the main tiles and each
// promoted other-level tile row (see block.otherLevels).
export function StatGrid({ tiles }) {
  return (
    <div className="player__statgrid">
      {tiles.map((t) => (
        <div key={t.k} className={`stat${t.tone === 'run' ? ' stat--run' : ''}`}>
          <div className="stat__v">{t.v}</div>
          <div className="stat__k">{t.k}</div>
        </div>
      ))}
    </div>
  )
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
