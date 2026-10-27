import '../../../../styles/gameday-next/panels.css'
import '../../../../styles/lineup-next/field.css'
import { useState } from 'react'
import { SealBox } from '../../../../components/SealBox.jsx'
import { BallparkDiagram } from '../../../../components/ballpark/BallparkDiagram.jsx'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { DEFENSE_SPOTS } from '../../../../lib/ballpark/layout/defenseWindow.js'
import { parkWindow } from '../../../../lib/ballpark/layout/parkWindow.js'
import { revealInning } from '../../../../api/linescore.js'
import { halfIndex, selectSkippedBottomHalf } from '../../../../api/select.js'
import { defenseAt } from '../../../../api/gameday/defense.js'
import { battingSideOf } from '../../../../api/gameday/stepCut.js'
import { chipCode, cutAt, orderAt } from './panelData.js'

// Gameday's panels (#2568), one per ladder block. `ctx` is the reader's cursor: the half on
// screen, `step` (the entry count PlayByPlay is capped at; null once the half is committed) and
// `mark`, the reveal mark. Anything that shows a result reads inside a SealBox, up to the cursor
// (ADR-0016). A panel that shows only the half's reference (the Field tab, the order's names) opens
// with the half the reader may reach, revealedThrough + 1 (ADR-0010); the rest wait for a step.
// The navigator's run cells stay the only way to reach a half more than one step away (ADR-0043).

// Result-bearing panels draw through here; `key` re-seals on every half, as the page does. Until
// the panel may show, the slot says "Sealed" (a label, outside the box: it holds no value).
function Sealable({ ctx, reach = false, children }) {
  const { feed, inning, half, step, mark } = ctx
  const idx = halfIndex(inning, half)
  const shown = reach ? idx <= mark + 1 : idx <= mark || step > 0
  if (!shown) return <p className="gdp__sealed">Sealed</p>
  return (
    <SealBox key={`${inning}-${half}`} forceRevealed coverless>
      {() => children(cutAt(feed, inning, half, idx <= mark ? null : step))}
    </SealBox>
  )
}

function Navigator({ ctx }) {
  const { feed, regulation, unlocked, mark, runsInProgress, curIdx, onSelect, disabled, meta } = ctx
  const cols = Array.from({ length: Math.max(regulation, unlocked) }, (_, i) => i + 1)
  const cell = (n, half, side) => {
    const idx = halfIndex(n, half)
    if (idx <= mark) return revealInning(feed, n, side)
    if (idx === runsInProgress?.idx) return { runs: runsInProgress.runs, hits: runsInProgress.hits }
    return null
  }
  const row = (half, side, m) => (
    <tr key={side}>
      <th scope="row">{m.abbreviation}</th>
      {cols.map((n) => {
        const idx = halfIndex(n, half)
        const l = n <= unlocked ? cell(n, half, side) : null
        // A bottom half never played (the game ended in the top), known once the top is revealed.
        const skipped = half === 'bottom' && halfIndex(n, 'top') <= mark && selectSkippedBottomHalf(feed, n)
        return (
          <td key={n}>
            <button
              type="button"
              className="gdp__run"
              aria-current={idx === curIdx || undefined}
              aria-disabled={disabled || undefined}
              disabled={n > unlocked || skipped}
              aria-label={`${half === 'top' ? 'Top' : 'Bottom'} ${n}${skipped ? ', not played' : l ? `, ${l.runs} runs` : ', sealed'}`}
              onClick={() => !disabled && onSelect(idx)}
            >
              {skipped ? '✕' : l ? l.runs : '·'}
            </button>
          </td>
        )
      })}
    </tr>
  )
  return (
    <table className="gdp__line" aria-label="Line score">
      <thead>
        <tr><th />{cols.map((n) => <th key={n}>{n}</th>)}</tr>
      </thead>
      <tbody>{row('top', 'away', meta.away)}{row('bottom', 'home', meta.home)}</tbody>
    </table>
  )
}

const Trail = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {({ cards, more }) => (
      <ol className="gdp__trail" aria-label="At-bats this half">
        {cards.slice(-10).map((c) => (
          <li key={c.atBatIndex} className="gdp__chip">
            <b>{chipCode(c) || '···'}</b>{c.batter?.last ?? c.batter?.fullName}
          </li>
        ))}
        {more && <li className="gdp__chip gdp__chip--cover"><b>Sealed</b></li>}
      </ol>
    )}
  </Sealable>
)

const Pitches = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {({ cards }) => {
      const c = cards.at(-1)
      if (!c) return null
      return (
        <div>
          <span className="gdp__label">Pitches · {c.batter?.last ?? c.batter?.fullName}</span>
          <ol className="gdp__pitches">
            {c.pitchDetails.map((p) => (
              <li key={p.no}>
                <span className="gdp__pip">{p.cat === 'inplay' ? 'X' : p.no}</span>
                <span>{p.type}</span>
                <span className="gdp__num">{p.mph != null ? `${Math.round(p.mph)} mph` : ''}</span>
              </li>
            ))}
          </ol>
        </div>
      )
    }}
  </Sealable>
)

// Names and slots are the order entering the half (lineupEntering gates itself); the codes are results.
const BattingOrder = ({ ctx }) => (
  <Sealable ctx={ctx} reach>
    {({ cards }) => (
      <ol className="gdp__order">
        {orderAt(ctx.feed, battingSideOf(ctx.half), ctx.inning, ctx.half, ctx.mark, cards).map((r) => (
          <li key={r.slot}>
            <em>{r.slot}</em>
            <span>{r.last} <em>{r.position}</em></span>
            <em>{r.codes.join(' ')}</em>
          </li>
        ))}
      </ol>
    )}
  </Sealable>
)

// The Field tab: FieldCard's park with surnames at the spots, the defense as of the cursor.
function Field({ ctx }) {
  const { feed, inning, half, mark } = ctx
  const v = feed?.gameData?.venue
  const layout = resolveBallparkLayout({ venueId: v?.id, venueName: v?.name, gameDate: feed?.gameData?.datetime?.officialDate })
  if (!layout) return <p className="gdp__sealed">No park drawing for this venue.</p>
  const win = parkWindow(layout)
  return (
    <Sealable ctx={ctx} reach>
      {({ cap }) => {
        const by = defenseAt(feed, { inning, half, step: cap, revealedThrough: mark }) ?? {}
        return (
          <>
            <div className="lfld__field" style={{ aspectRatio: win.aspectRatio }}>
              <BallparkDiagram layout={layout} viewBox={win.viewBox} className="lfld__park" label={`${v?.name} with the defense`} />
              {Object.entries(DEFENSE_SPOTS).map(([pos, xy]) => {
                const { left, top } = win.percent(xy)
                return (
                  <span key={pos} className="lfld__node" style={{ left: `${left}%`, top: `${top}%` }} role="group" aria-label={pos}>
                    <span className={`lfld__name${by[pos] ? '' : ' lfld__name--tbd'}`}>{by[pos]?.last ?? '—'}</span>
                  </span>
                )
              })}
            </div>
            {by.DH && <p className="lfld__dh"><span>DH</span>{by.DH.last}</p>}
          </>
        )
      }}
    </Sealable>
  )
}

// ponytail: Field is the one tab built (round 2's Arms and Extras tabs are later prompts).
const Reference = ({ ctx }) => {
  const [tab, setTab] = useState('field')
  return (
    <div className="gdp__ref">
      <div className="gdp__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'field'} onClick={() => setTab('field')}>Field</button>
      </div>
      <Field ctx={ctx} />
    </div>
  )
}

const EventLog = ({ ctx }) => (
  <Sealable ctx={ctx}>
    {({ cards }) => (
      <div className="gdp__log">
        <span className="gdp__label">This half</span>
        {cards.map((c) => (
          <p key={c.atBatIndex}><b>{c.batter?.last}</b> {c.descSegments?.map((s) => s.text ?? s).join('')}</p>
        ))}
      </div>
    )}
  </Sealable>
)

const PANELS = { navigator: Navigator, trail: Trail, pitches: Pitches, battingOrder: BattingOrder, reference: Reference, eventLog: EventLog }

// The panel for a ladder block, or null for the blocks other prompts build.
export function GamedayPanel({ block, ctx }) {
  const P = PANELS[block]
  return P && ctx ? <P ctx={ctx} /> : null
}
