import { useState } from 'react'
import { ordinal } from '../../../../../lib/format.js'
import { axisPos, inningRows } from './recordsModel.js'
import { SplitRow } from './Splits.jsx'

// The inning scoring grid (S5c): one 48px row per inning, the top half (▲) and the bottom half (▼)
// on one win-pct axis. Left: the top half's W-L over its pct. Right: the bottom half's. The better
// half's W-L is heading ink. A tap on an inning unfolds both halves under it, extras are one bucket.
// The rules sit at .500, .600, .700 and .800; only the ends are labelled, since the track is narrow.
const ENDS = [['.500', 20], ['.800', 80]]

function Side({ row, better }) {
  if (!row) return <span className="rec__half rec__half--none">—</span>
  return (
    <span className={`rec__half${better ? ' rec__half--best' : ''}`}>
      <span className="rec__halfwl">{row.v}</span>
      <span className="rec__halfpct">{row.pct}</span>
    </span>
  )
}

function Track({ top, bottom }) {
  const t = top?.rate != null ? axisPos(top.rate) : null
  const b = bottom?.rate != null ? axisPos(bottom.rate) : null
  const marks = [t, b].filter((x) => x != null)
  return (
    <span className="rec__track" aria-hidden="true">
      {marks.length === 2 && (
        <span className="rec__join" style={{ left: `${Math.min(t, b) * 100}%`, width: `${Math.abs(t - b) * 100}%` }} />
      )}
      {t != null && <span className="rec__mark rec__mark--top" style={{ left: `${t * 100}%` }}>▲</span>}
      {b != null && <span className="rec__mark rec__mark--bot" style={{ left: `${b * 100}%` }}>▼</span>}
    </span>
  )
}

export function InningGrid({ group }) {
  const { innings, extras } = inningRows(group)
  const [open, setOpen] = useState(null)
  if (!innings.length && !extras) return null
  return (
    <div className="rec__inn">
      <div className="rec__innhead" aria-hidden="true">
        <span>Inn</span>
        <span>▲ Top</span>
        <span className="rec__axis">{ENDS.map(([t, at]) => <span key={t} style={{ left: `${at}%` }}>{t}</span>)}</span>
        <span>▼ Bot</span>
      </div>
      {innings.map(({ n, top, bottom, better }) => (
        <div key={n} className="rec__innrow">
          <button
            type="button"
            className="rec__innbtn"
            aria-expanded={open === n}
            aria-label={`${ordinal(n)} inning. Top ${top ? `${top.v}, ${top.pct}` : 'no games'}. Bottom ${bottom ? `${bottom.v}, ${bottom.pct}` : 'no games'}.`}
            onClick={() => setOpen(open === n ? null : n)}
          >
            <span className="rec__innno">{ordinal(n)}</span>
            <Side row={top} better={better === 'top'} />
            <Track top={top} bottom={bottom} />
            <Side row={bottom} better={better === 'bottom'} />
          </button>
          {open === n && (
            <ul className="rec__innopen">
              {top && <SplitRow row={top} label={`▲ Top of the ${ordinal(n)}`} />}
              {bottom && <SplitRow row={bottom} label={`▼ Bottom of the ${ordinal(n)}`} />}
            </ul>
          )}
        </div>
      ))}
      {extras && (
        <ul className="rec__splits">
          <SplitRow row={extras} label="Extra innings · one bucket" />
        </ul>
      )}
      <p className="rec__key">▲ the top half, ▼ the bottom half. Left to right: win pct, .400 to .900.</p>
    </div>
  )
}
