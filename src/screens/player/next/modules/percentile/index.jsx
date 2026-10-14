import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/season/percentile.css'
import { fetchSavantPercentiles } from '../../../../../api/savantPercentiles.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { percentileView } from './percentileView.js'

// Rows a role draws at most: the loading box holds one line per metric (9 batter, 7 pitcher).
const ROWS = { hitting: 9, pitching: 7 }

// Percentile rank (#2011): a rank-strip ledger, best at the right edge. Open surface (ADR-0034):
// season Statcast ranks off a nightly file, no seal. The file holds one season; another season has no card.
export default function PercentileModule({ bio, role, season, onEmpty, onCount }) {
  const { data, loading } = useAsync(fetchSavantPercentiles, [])
  const [openKey, setOpenKey] = useState(null)
  const view = useMemo(() => percentileView(data, bio.id, role, season), [data, bio.id, role, season])
  // A missing file resolves to its fallback (staticJson), it does not reject: a settled load with no view is empty.
  const empty = !loading && !view
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  const tag = view?.tag
  useEffect(() => {
    onCount(tag)
  }, [tag, onCount])
  if (loading) return <div className="pctl pctl--loading" style={{ '--rows': ROWS[role] ?? 9 }} aria-busy="true" />
  if (empty) return null
  return (
    <div className="pctl">
      <div className="pctl__axis mono" aria-hidden="true">
        <span className="pctl__axis-name">Statcast</span>
        <span className="pctl__axis-scale">
          <span>Worst</span>
          <span>
            <i className="pctl__sq" />
            <span className="pctl__axis-word"> Median</span>
          </span>
          <span>Best</span>
        </span>
        <span className="pctl__axis-pct">Pctl</span>
      </div>
      <ul className="pctl__list">
        {view.rows.map((r) => (
          <Row key={r.key} r={r} open={openKey === r.key} onToggle={() => setOpenKey(openKey === r.key ? null : r.key)} />
        ))}
      </ul>
      <p className="pctl__key" aria-hidden="true">
        <span><i className="pctl__swatch pctl__swatch--top" /> ▲ Top third</span>
        <span><i className="pctl__swatch pctl__swatch--mid" /> Middle</span>
        <span><i className="pctl__swatch pctl__swatch--low" /> ▼ Bottom third</span>
        <span>↓ Lower is better</span>
      </p>
      <p className="pctl__foot mono">{view.season} season · Baseball Savant</p>
    </div>
  )
}

function Row({ r, open, onToggle }) {
  return (
    <li className={`pctl__row${open ? ' pctl__row--open' : ''}`}>
      <button type="button" className="pctl__btn" aria-expanded={open} aria-label={`${r.aria} ${open ? r.def : 'Tap for what it measures.'}`} onClick={onToggle}>
        <span className="pctl__label" aria-hidden="true">{r.label}</span>
        <span className="pctl__raw mono" aria-hidden="true">
          <b>{r.value}</b>
          {r.lowerIsBetter && <span className="pctl__down"> ↓</span>}
          <span className="pctl__med"> med {r.baseline}</span>
        </span>
        <span className="pctl__strip" aria-hidden="true">
          <span className={`pctl__fill pctl__fill--${r.tier}`} style={{ width: `${r.percentile}%` }} />
          <span className="pctl__mid" />
          <span className="pctl__tick" style={{ left: `${r.percentile}%` }} />
        </span>
        <span className="pctl__pct mono" aria-hidden="true">
          {r.ord}
          <em>{r.mark}</em>
        </span>
      </button>
      {open && (
        <div className="pctl__more">
          <p>{r.def}</p>
          <p className="mono">{r.detail}</p>
        </div>
      )}
    </li>
  )
}
