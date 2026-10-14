import { useCallback, useMemo, useState } from 'react'
import { MIN_LOOK_SHIFT } from '../../../../api/pitchArsenal.js'
import { MixSheet } from '../sheets/MixSheet.jsx'
import { PitchScene } from '../../../../components/playbyplay/pitcherCard/PitchScene.jsx'
import { useMediaQuery, WIDE_QUERY } from '../../../../hooks/useMediaQuery.js'
import { pitchTiles } from '../../../../lib/pitcherCard/card.js'
import { scenePitches } from '../../../../lib/pitcherCard/scene.js'
import { pitchMark } from '../../../../lib/pitch/pitchTypes.js'
import { barAxisMax, lookAfterSideChange, looksFor, mixRows, totalPitches } from '../logic/pitchMix.js'

const LOOK_LABEL = { 1: '1st look', 2: '2nd', 3: '3rd+' }

// The pitch's shape (its family) in its colour, hollow for a rarer variant (docs/pitch-types.md).
function Mark({ code }) {
  const m = pitchMark(code)
  const paint = { fill: m.ring ? 'none' : m.color, stroke: m.ring ? m.color : 'currentColor', strokeWidth: m.ring ? 2 : 1 }
  const shape = {
    circle: <circle cx="8" cy="8" r="5.5" {...paint} />,
    diamond: <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" {...paint} />,
    square: <rect x="2.5" y="2.5" width="11" height="11" {...paint} />,
    triangle: <path d="M8 2 14.5 13.5h-13Z" {...paint} />,
    hexagon: <path d="M4.5 2h7L15 8l-3.5 6h-7L1 8Z" {...paint} />,
  }[m.shape]
  return (
    <svg className="lmix__mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {shape}
    </svg>
  )
}

function Seg({ label, items, value, onChange }) {
  return (
    <div className="lmix__segrow">
      <span className="lmix__seglabel">{label}</span>
      <div className="lmix__seg" role="group" aria-label={label}>
        {items.map((it) => (
          <button key={String(it.key)} type="button" className={`lmix__segbtn${value === it.key ? ' is-active' : ''}`} aria-pressed={value === it.key} onClick={() => onChange(it.key)}>
            {it.label}
            {it.count != null && <span className="lmix__segn">{it.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// The starter's season pitch mix, in its own card inside the starter card: how many pitches, a
// filter by the side the batter stands on (with how many of tonight's lineup stand there) and
// by the look through the order, and one bar per pitch. The animated scene of his arcs shows
// inline on a wide screen and opens in a sheet from "Watch" on a phone. A season total of
// finished games, the same footing as the Now Pitching card, so nothing here is reveal-only.
export function PitchMixCard({ arsenal, tto, sides, lefty, name, counts }) {
  const wide = useMediaQuery(WIDE_QUERY)
  const [side, setSide] = useState(null)
  const [look, setLook] = useState(null)
  const [open, setOpen] = useState(false)
  const [activeCode, setActiveCode] = useState(null)
  // A pick the data no longer carries (a new starter after Refresh, a look the side never reached)
  // falls back to the season, so the rows and the lit tab always agree.
  const activeSide = side && sides?.[side] ? side : null
  const looks = looksFor(tto, sides, activeSide)
  const activeLook = looks.some((l) => l.look === look) ? look : null
  const rows = useMemo(() => mixRows(arsenal, tto, sides, activeSide, activeLook), [arsenal, tto, sides, activeSide, activeLook])
  const axis = barAxisMax(rows)
  const tiles = useMemo(() => pitchTiles(arsenal), [arsenal])
  const pitches = useMemo(() => scenePitches(tiles, lefty), [tiles, lefty])
  const onActive = useCallback((i) => setActiveCode(pitches[i]?.code ?? null), [pitches])
  if (!rows.length) return null
  const chooseSide = (next) => {
    setSide(next)
    setLook(lookAfterSideChange(look, tto, sides, next))
  }
  return (
    <section className="lmix" aria-label="Pitch mix">
      <header className="lmix__head">
        <div>
          <h4 className="lmix__title">Pitch mix</h4>
          <p className="lmix__sub">{totalPitches(arsenal).toLocaleString()} pitches</p>
        </div>
        {!wide && pitches.length > 0 && (
          <button type="button" className="lmix__watch" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            <span aria-hidden="true">▶</span> Watch
          </button>
        )}
      </header>
      {sides && (
        <Seg
          label="Batter"
          value={activeSide}
          onChange={chooseSide}
          items={[
            { key: null, label: 'All' },
            { key: 'L', label: 'LHB', count: counts?.L || null },
            { key: 'R', label: 'RHB', count: counts?.R || null },
          ]}
        />
      )}
      {looks.length > 0 && (
        <Seg label="Time through" value={activeLook} onChange={setLook} items={[{ key: null, label: 'All' }, ...looks.map((l) => ({ key: l.look, label: LOOK_LABEL[l.look] }))]} />
      )}
      <ul className="lmix__list">
        {rows.map((r) => (
          <li key={r.code} className={`lmix__row${r.code === activeCode ? ' is-active' : ''}`}>
            <Mark code={r.code} />
            <span className="lmix__name">{pitchMark(r.code).code === 'UN' ? r.name : pitchMark(r.code).name}</span>
            <span className="lmix__bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (r.pct / axis) * 100)}%`, background: pitchMark(r.code).color }} />
            </span>
            <span className="lmix__pct">
              {r.pct}%{r.delta != null && Math.abs(r.delta) >= MIN_LOOK_SHIFT && <span className="lmix__shift" aria-label={`${r.delta > 0 ? 'Up' : 'Down'} from the previous look`}>{r.delta > 0 ? '▲' : '▼'}</span>}
            </span>
            {r.velo != null && <span className="lmix__velo">{Math.round(r.velo)} mph</span>}
          </li>
        ))}
      </ul>
      {wide && pitches.length > 0 && (
        <div className="pcard lmix__scene">
          <PitchScene pitches={pitches} lefty={lefty} name={name} onActive={onActive} />
        </div>
      )}
      {open && <MixSheet tiles={tiles} lefty={lefty} name={name} onClose={() => setOpen(false)} />}
    </section>
  )
}
