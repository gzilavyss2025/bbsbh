import { useState } from 'react'
import { mixOf } from '../../../../api/gameday/pitchMix.js'
import { fetchPitcherRecentGames } from '../../../../api/game.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { pitchMark } from '../../../../lib/pitch/pitchTypes.js'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { ScrollCue } from '../ScrollCue.jsx'

// The Gameday arm card's tabs, under his line tonight (Gary, 2026-10-29): Arsenal (his season
// repertoire, the card's own pitch tiles), Pitch Mix (tonight so far, with drill-downs), Game Log
// (every outing this season before tonight) and Scout (him against the batter up). Pitch Mix opens.
// `mix` and `scout` arrive already drawn inside the arm panel's seal (GamedayPanels.jsx): this
// file only switches between them.
const TABS = [
  ['arsenal', 'Arsenal'],
  ['mix', 'Pitch mix'],
  ['log', 'Game log'],
  ['scout', 'Scout'],
]

export function ArmTabs({ arsenal, mix, log, scout }) {
  const [tab, setTab] = useState('mix')
  const body = { arsenal, mix, log, scout }[tab]
  return (
    <div className="gdtabs">
      <div className="gdtabs__row" role="tablist" aria-label="Pitcher views">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`gdtabs__tab${tab === key ? ' is-on' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {/* A long view scrolls inside the card, with Gameday's bouncing chevron while more is below. */}
      <div className="gdtabs__body" role="tabpanel">
        <ScrollCue key={tab} label="More below">{body ?? <p className="gdtabs__empty">Nothing on file yet.</p>}</ScrollCue>
      </div>
    </div>
  )
}

const OUTCOMES = [
  ['ball', 'Ball'],
  ['called', 'Called'],
  ['whiff', 'Whiff'],
  ['foul', 'Foul'],
  ['inplay', 'In play'],
  // Any bat on ball: fouls (foul tips and foul bunts included) and balls in play (Gary, 2026-10-29).
  ['contact', 'Contact'],
]
const TTO = [
  [1, '1st'],
  [2, '2nd'],
  [3, '3rd+'],
]
const pct = (x) => `${Math.round(x * 100)}%`

// The filters as a tap strip (Gary, 2026-10-29): the four filters, each showing its choice; a tap
// slides that filter's options in over them, with Back, and a pick slides the strip back. Reset
// clears every filter. The slide is a transform, and none at all under reduced motion (panels.css).
function FilterStrip({ filters, onReset }) {
  const [open, setOpen] = useState(null)
  const f = filters.find((x) => x.key === open)
  const label = (x) => (x.value == null ? 'All' : x.options.find(([v]) => v === x.value)?.[1] ?? 'All')
  const active = filters.some((x) => x.value != null)
  return (
    <div className={`gdfilt${open ? ' is-open' : ''}`}>
      <div className="gdfilt__track">
        <div className="gdfilt__pane" aria-hidden={open ? true : undefined}>
          {filters.map((x) => (
            <button key={x.key} type="button" tabIndex={open ? -1 : undefined} className={`gdfilt__cat${x.value != null ? ' is-set' : ''}`} onClick={() => setOpen(x.key)}>
              <small>{x.label}</small>
              <b>{label(x)}</b>
            </button>
          ))}
          {active && <button type="button" tabIndex={open ? -1 : undefined} className="gdfilt__reset" onClick={onReset}>Reset</button>}
        </div>
        <div className="gdfilt__pane" aria-hidden={open ? undefined : true}>
          <button type="button" tabIndex={open ? undefined : -1} className="gdfilt__back" onClick={() => setOpen(null)} aria-label="Back to the filters">‹ {f?.label}</button>
          {f && [[null, 'All'], ...f.options].map(([v, text]) => (
            <button key={String(v)} type="button" aria-pressed={f.value === v} className={`gdfilt__opt${f.value === v ? ' is-on' : ''}`}
              onClick={() => { f.set(v); setOpen(null) }}>
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Tonight's mix, drawn from the on-screen pitches the arm panel hands in (pitchMix.js's
// tonightPitches, read inside its seal). The filters narrow the same list; the table reads each
// pitch's share, count and average speed, with a bar in the pitch's own colour (Gary, 2026-10-29).
export function TonightMix({ pitches }) {
  const [hand, setHand] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [inning, setInning] = useState(null)
  const [tto, setTto] = useState(null)
  if (!pitches?.length) return <p className="gdtabs__empty">No pitches yet tonight.</p>
  const innings = [...new Set(pitches.map((p) => p.inning))].map((n) => [n, String(n)])
  const ttos = TTO.filter(([n]) => pitches.some((p) => Math.min(p.tto, 3) >= n))
  const shown = pitches.filter(
    (p) => (!hand || p.hand === hand) && (!outcome || p.outcome === outcome || (outcome === 'contact' && (p.outcome === 'foul' || p.outcome === 'inplay'))) && (!inning || p.inning === inning) && (!tto || Math.min(p.tto, 3) === tto),
  )
  const rows = mixOf(shown)
  return (
    <div className="gdmix">
      <FilterStrip
        filters={[
          { key: 'hand', label: 'Batter', value: hand, set: setHand, options: [['L', 'LHB'], ['R', 'RHB']] },
          { key: 'outcome', label: 'Result', value: outcome, set: setOutcome, options: OUTCOMES },
          { key: 'inning', label: 'Inning', value: inning, set: setInning, options: innings },
          { key: 'tto', label: 'Time thru', value: tto, set: setTto, options: ttos },
        ]}
        onReset={() => { setHand(null); setOutcome(null); setInning(null); setTto(null) }}
      />
      <table className="gdmix__table">
        <thead>
          <tr><th>Pitch</th><th>%</th><th>#</th><th>MPH</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = pitchMark(r.type)
            return (
              <tr key={r.type} style={{ '--pitch': m.color, '--share': `${Math.round(r.share * 100)}%` }}>
                <td className="gdmix__name"><i className="gdmix__dot" aria-hidden="true" />{r.typeName || m.name}</td>
                <td><b>{pct(r.share)}</b></td>
                <td>{r.n}</td>
                <td>{r.mph != null ? r.mph.toFixed(1) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr><td>Total</td><td /><td>{shown.length}</td><td /></tr>
        </tfoot>
      </table>
    </div>
  )
}

const shortDate = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`

// Every outing this season BEFORE tonight, postseason and minor-league/rehab outings included (fetchPitcherRecentGames' cutoff),
// newest first: completed games only.
export function ArmGameLog({ pitcherId, season, date, gameNumber, sportId = 1 }) {
  const { data, loading } = useAsync(() => fetchPitcherRecentGames(pitcherId, season, date, gameNumber, Infinity), [pitcherId, season, date, gameNumber])
  if (loading && !data) return <p className="gdtabs__empty">…</p>
  if (!data?.length) return <p className="gdtabs__empty">No outings before tonight this season.</p>
  return (
    <table className="gdlog">
      <thead>
        <tr><th>Date</th><th colSpan={2}>Opp</th><th>IP</th><th>P</th><th>H</th><th>ER</th><th>BB</th><th>K</th></tr>
      </thead>
      <tbody>
        {data.map((g) => (
          // An outing at another level than tonight's (a rehab or minor-league start) is shaded and tagged.
          <tr key={`${g.gamePk}-${g.date}`} className={g.sportId !== sportId ? 'is-other' : undefined}>
            <td>{shortDate(g.date)}{g.sportId !== sportId && g.level && <small className="gdlog__level">{g.level}</small>}</td>
            {/* "@" in its own narrow column, so every opponent's mark lines up (Gary, 2026-10-29). */}
            <td className="gdlog__at">{g.home ? '' : '@'}</td>
            <td className="gdlog__opp"><TeamLogo teamId={g.opponentId} name={g.opponent} size={16} /></td>
            <td>{g.ip}</td><td>{g.pitches}</td><td>{g.h}</td><td>{g.er}</td><td>{g.bb}</td><td>{g.k}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
