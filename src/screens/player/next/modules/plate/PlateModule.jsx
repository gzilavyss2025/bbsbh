import { useEffect, useMemo, useState } from 'react'
import { fetchHitterGridFor } from '../../../../../api/scout/hitterGrid.js'
import { FactGrid } from '../../../../../components/ui/frame/FactGrid.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'
import { sidesInOrder } from '../../../../../lib/zone/regions.js'
import { GRID, viewCol } from '../../../../../lib/zone/zoneGeometry.js'
import { StretchTable } from '../form/StretchTable.jsx'
import { MIN_CELL, OUTCOMES, fmtPct, pitchRows, pitchesVs, plateView } from './plateView.js'

// The batter Plate approach (#1887): where his pitches land and how each one ended, by pitch type
// and pitcher hand. An open surface (ADR-0034): season sums over Final games, no game result.
// The grid is the Matchup Scout's hitter-grid store (ADR-0096) plus its plate file (#1911).
const HANDS = [[null, 'All pitchers'], ['L', 'vs LHP'], ['R', 'vs RHP']]
const ROWS = ['Above the zone', 'High', 'Middle', 'Low', 'Below the zone']
const ENDS = ["Hitter's side", "Pitcher's side"]
const COLUMNS = [{ key: 'n', label: 'Pitches' }, { key: 'mph', label: 'MPH' }, { key: 'whiff', label: 'Whiff' }]
const [LEFT, RIGHT] = sidesInOrder('pitcher')
const COLS = [`Wide ${LEFT}`, LEFT, 'Center', RIGHT, `Wide ${RIGHT}`]
const pct = (v) => Math.round(v * 100)
const mph = (v) => (v == null ? '—' : v.toFixed(1))

// A table row: the bar is the five outcomes as whole numbers (under 8% prints no number).
const tableRow = (key, name, sub, at, v) => ({
  key,
  name,
  sub,
  at,
  segs: v.segs ? v.segs.map((n) => ({ n, label: n / v.n >= 0.08 ? String(pct(n / v.n)) : '' })) : [],
  good: v.hit == null ? '—' : `${pct(v.hit)}% hitter's`,
  bad: v.pitcher == null ? '—' : `${pct(v.pitcher)}% pitcher's`,
  n: v.n.toLocaleString(),
  mph: mph(v.rates.mph),
  whiff: fmtPct(v.rates.whiff),
})

export default function PlateModule({ bio, asOf, season, onEmpty, onCount }) {
  const { data: grid, loading, error } = useAsync(() => (asOf ? null : fetchHitterGridFor(bio.id, season, { plate: true })), [bio.id, season, asOf])
  const [pickHand, setHand] = useState(null)
  const [pick, setPick] = useState(null)
  const [cell, setCell] = useState(-1)
  const hand = pitchesVs(grid, pickHand) ? pickHand : null // a hand this hitter never faced falls back to both
  const all = useMemo(() => plateView(grid), [grid])
  const rows = useMemo(() => pitchRows(grid, hand), [grid, hand])
  const code = rows.some((r) => r.code === pick) ? pick : null
  const view = useMemo(() => plateView(grid, { hand, code }), [grid, hand, code])
  // The grid is season sums: a dated page (?d=) cannot cut them, so the card hides there.
  const empty = Boolean(error || asOf || (!loading && !all))

  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  useEffect(() => {
    onCount(all && !asOf ? `${all.n.toLocaleString()} pitches` : undefined)
  }, [all, asOf, onCount])

  if (empty) return null
  if (!view) return <div className="fplate fplate--wait" aria-busy="true"><p className="hint">Loading plate approach…</p></div>

  const name = code ? pitchMark(code).name : 'All pitches'
  const handName = HANDS.find((h) => h[0] === hand)[1]
  const picked = cell >= 0 ? view.cells[cell] : null
  const tableRows = [
    tableRow('all', 'All pitches', `${handName} · ${view.n.toLocaleString()} pitches`, 0, view),
    ...rows.map((r, i) => tableRow(r.code, pitchMark(r.code).name, `${r.code} · ${r.n.toLocaleString()} pitches`, i + 1, r.view)),
  ]
  const at = tableRows.findIndex((r) => r.key === (code ?? 'all'))
  const read = picked
    ? {
        title: `${ROWS[Math.floor(picked.i / GRID)]} · ${COLS[GRID - 1 - (picked.i % GRID)]}`,
        text: picked.n < MIN_CELL
          ? `Only ${picked.n} pitches landed here, too few to read.`
          : picked.segs
            ? `${picked.n} pitches landed here: ${OUTCOMES.map((o, k) => `${o} ${picked.segs[k]}`).join(', ')}.`
            : `${picked.n} pitches landed here.`,
      }
    : { title: name, text: `${handName} · ${view.n.toLocaleString()} pitches in ${season}.` }

  return (
    <div className="fplate">
      <div className="fplate__hands" role="group" aria-label="Pitcher hand">
        {HANDS.map(([h, label]) => (
          <button key={label} type="button" className="pnext-pick" aria-pressed={h === hand} disabled={h != null && !pitchesVs(grid, h)} onClick={() => { setHand(h); setCell(-1) }}>
            {label}
          </button>
        ))}
      </div>
      <div className="fplate__cols">
        <div className="fplate__zone">
          <SectionHead look="rule" as="h3" note={name}>Where it lands</SectionHead>
          <div className="fplate__map" role="group" aria-label={`Strike zone, five by five, pitcher's view. Each box shows the percent of pitches that ended in play or as a ball. ${name}, ${handName}.`}>
            {Array.from({ length: GRID * GRID }, (_, k) => {
              const c = view.cells[Math.floor(k / GRID) * GRID + viewCol(k % GRID)] // drawn column -> stored column
              return (
                <button
                  key={c.i}
                  type="button"
                  className="fplate__cell"
                  data-band={c.band ?? 'none'}
                  aria-pressed={cell === c.i}
                  aria-label={`${ROWS[Math.floor(c.i / GRID)]}, ${COLS[GRID - 1 - (c.i % GRID)]}: ${c.hit == null ? (c.n < MIN_CELL ? `fewer than ${MIN_CELL} pitches` : 'not on file') : `${pct(c.hit)} percent hitter outcomes on ${c.n} pitches`}`}
                  onClick={() => setCell(cell === c.i ? -1 : c.i)}
                >
                  {c.hit != null && <>{pct(c.hit)}<small>%</small></>}
                </button>
              )
            })}
            <span className="fplate__box" aria-hidden="true" />
          </div>
          <div className="fplate__sides" aria-hidden="true"><span>{LEFT}</span><span>{RIGHT}</span></div>
          <div className="fplate__ramp" aria-hidden="true">
            <span className="fplate__endcap fplate__endcap--bad">Pitcher&rsquo;s box</span>
            {[0, 1, 2, 3, 4].map((b) => <span key={b} className="fplate__swatch" data-band={b} />)}
            <span className="fplate__endcap fplate__endcap--good">Hitter&rsquo;s box</span>
          </div>
          <p className="fplate__note">
            The number is the share of pitches that ended in play or as a ball: the hitter&rsquo;s outcomes. A blank box has fewer than {MIN_CELL} pitches.
            {view.segs == null && ' Called strikes and balls in play are not on file for this hitter, so the boxes and the bars stay blank.'}
          </p>
          <div className="fplate__read" aria-live="polite">
            <span className="fplate__readtitle">{read.title}</span>
            <span className="fplate__readtext">{read.text}</span>
          </div>
        </div>
        <div className="fplate__mix">
          <SectionHead look="rule" as="h3" note={handName}>Pitch mix</SectionHead>
          <StretchTable
            columns={COLUMNS}
            rows={tableRows}
            legend={OUTCOMES}
            ends={ENDS}
            cursor={at}
            onPick={(i) => { setPick(i === 0 || tableRows[i].key === code ? null : tableRows[i].key); setCell(-1) }}
          />
          <FactGrid className="fplate__facts">
            <Fact label="Swing" value={fmtPct(view.rates.swing)} />
            <Fact label="Chase" value={fmtPct(view.rates.chase)} />
            <Fact label="In zone" value={fmtPct(view.rates.zone)} />
            <Fact label="Whiff" value={fmtPct(view.rates.whiff)} />
            <Fact label="Avg MPH" value={mph(view.rates.mph)} />
            <Fact label="Swings" value={view.swings.toLocaleString()} />
          </FactGrid>
          <p className="fplate__note">
            Whiff is a swing and a miss, a foul tip included. Swing is swings per pitch; chase is swings at pitches outside the zone; in zone is the share of pitches thrown in it.
            Tap a pitch to read the map for it.
          </p>
        </div>
      </div>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value">{value}</dd>
    </div>
  )
}
