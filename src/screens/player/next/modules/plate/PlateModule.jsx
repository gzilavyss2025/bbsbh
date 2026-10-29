import { useEffect, useMemo, useState } from 'react'
import { fetchHitterGridFor } from '../../../../../api/scout/hitterGrid.js'
import { FactGrid } from '../../../../../components/ui/frame/FactGrid.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'
import { sidesInOrder } from '../../../../../lib/zone/regions.js'
import { GRID } from '../../../../../lib/zone/zoneGeometry.js'
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
import { glyphD } from '../arsenal/PitchGlyph.jsx'
import { MIN_CELL, OUTCOMES, fmtMph, fmtPct, outcomeFigures, pitchRows, pitchesVs, plateView } from './plateView.js'

// The batter Plate approach (#1887): where his pitches land and how each one ended, by pitch type
// and pitcher hand. An open surface (ADR-0034): season sums over Final games, no game result.
// The grid is the Matchup Scout's hitter-grid store (ADR-0096) plus its plate file (#1911).
// The pitch mix is the shared MenuRail (#2073): a card a pitch type; the panel opens the picked one.
const HANDS = [[null, 'All pitchers'], ['L', 'vs LHP'], ['R', 'vs RHP']]
const ROWS = ['Above the zone', 'High', 'Middle', 'Low', 'Below the zone']
const ENDS = ["Hitter's outcomes", "Pitcher's outcomes"]
const [LEFT, RIGHT] = sidesInOrder('hitter')
const COLS = [`Wide ${LEFT}`, LEFT, 'Center', RIGHT, `Wide ${RIGHT}`]
const pct = (v) => Math.round(v * 100)

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
  const card = (r) => {
    const title = pitchMark(r.code).name
    const f = outcomeFigures(title, r.view)
    return {
      key: r.code,
      title,
      meta: f.n,
      mark: <Glyph code={r.code} />,
      label: f.aria,
      figures: (
        <>
          <span className="fplate__figs">MPH {f.mph} · Whiff {f.whiff}</span>
          <Bar f={f} />
        </>
      ),
    }
  }
  // The focus panel: the picked pitch. While the panel folds shut it keeps the last pick;
  // a hand change can drop that pitch, so a missing row draws nothing.
  const focus = (key) => {
    const r = rows.find((x) => x.code === key)
    if (!r) return null
    const f = outcomeFigures(pitchMark(key).name, r.view)
    return (
      <div className="fplate__focus">
        <div className="fplate__phead">
          <Glyph code={key} size={30} />
          <span className="fplate__pname">
            {pitchMark(key).name}
            <small className="fplate__psub">{key} · {f.n} pitches</small>
          </span>
        </div>
        <Bar f={f} />
      </div>
    )
  }
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
          <div className="fplate__map" role="group" aria-label={`Strike zone, five by five, catcher's view, the third-base side on the left. Each box shows the percent of pitches that ended in play or as a ball. ${name}, ${handName}.`}>
            {Array.from({ length: GRID * GRID }, (_, k) => {
              const c = view.cells[k] // drawn in the stored order (catcher's view)
              return (
                <button
                  key={c.i}
                  type="button"
                  className="fplate__cell"
                  data-band={c.band ?? 'none'}
                  aria-pressed={cell === c.i}
                  aria-label={`${ROWS[Math.floor(c.i / GRID)]}, ${COLS[c.i % GRID]}: ${c.hit == null ? (c.n < MIN_CELL ? `fewer than ${MIN_CELL} pitches` : 'not on file') : `${pct(c.hit)} percent hitter outcomes on ${c.n} pitches`}`}
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
            {!picked && view.segs && <Bar f={outcomeFigures(name, view)} />}
            <span className="fplate__readtext">{read.text}</span>
          </div>
        </div>
        <div className="fplate__mix">
          <SectionHead look="rule" as="h3" note={handName}>Pitch mix</SectionHead>
          <MenuRail
            className="fplate__menu"
            label="Pitch type"
            items={rows.map(card)}
            picked={code}
            onPick={(key) => { setPick(key); setCell(-1) }}
            panel={focus}
            backLabel="All pitches"
          />
          <Key />
          <FactGrid className="fplate__facts">
            <Fact label="Swing" value={fmtPct(view.rates.swing)} />
            <Fact label="Chase" value={fmtPct(view.rates.chase)} />
            <Fact label="In zone" value={fmtPct(view.rates.zone)} />
            <Fact label="Whiff" value={fmtPct(view.rates.whiff)} />
            <Fact label="Avg MPH" value={fmtMph(view.rates.mph)} />
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

// The pitch's mark (docs/pitch-types.md): the family is the shape, the pitch the colour.
function Glyph({ code, size = 20 }) {
  const mark = pitchMark(code)
  return (
    <svg className="fplate__icon" width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true">
      <path className={`fplate__glyph${mark.ring ? ' fplate__glyph--ring' : ''}`} d={glyphD(mark.shape, 7)} style={{ '--pitch': mark.color }} />
    </svg>
  )
}

// The five outcomes and the two sides: the Form trend table's bar markup, on its classes (formchart.css).
function Bar({ f }) {
  return (
    <>
      <span className="fstretch__bar" aria-hidden="true">
        {f.segs.map((s, i) => (
          <span key={OUTCOMES[i]} className="fstretch__seg" data-i={i} hidden={!s.n} style={{ flex: `${s.n} 1 0` }}>{s.label}</span>
        ))}
      </span>
      <span className="fstretch__ends" aria-hidden="true">
        <span className="fstretch__end fstretch__end--good">{f.good}</span>
        <span className="fstretch__end fstretch__end--bad">{f.bad}</span>
      </span>
    </>
  )
}

// The key to the bars: the Form trend table's key markup.
function Key() {
  return (
    <div className="fstretch__key">
      <div className="fstretch__keyhead"><span className="fstretch__end--good">{ENDS[0]}</span><span className="fstretch__end--bad">{ENDS[1]}</span></div>
      <div className="fstretch__bar" aria-hidden="true">
        {OUTCOMES.map((o, i) => <span key={o} className="fstretch__seg" data-i={i}>{o}</span>)}
      </div>
    </div>
  )
}
