import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/batter/form.css'
import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { MLB_LOG_GAME_TYPES } from '../../../../../api/boxlines/rows.js'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Pill } from '../../../../../components/ui/control/Pill.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { FormChart } from '../form/FormChart.jsx'
import { StretchTable } from '../form/StretchTable.jsx'
import { ENDS, OUTCOMES } from '../form/formView.js'
import { CHIPS, COLUMNS, METRICS, chartOf, cursorText, pformView, roleOf, stretchRows } from './pformView.js'

// The pitcher Form trend (#1930): his rolling ERA, or K%, against the season line, and how each
// stretch ended. The batter card's twin (../form/): the same chart, table and look, so the CSS
// is the batter's. An open surface (ADR-0034): season stats only, no game result. One game-log
// fetch, made when the slot comes near: the module is handed no overview splits.
const STEP_MS = 45

export default function PformModule({ bio, asOf, season, onEmpty, onCount }) {
  const { data: log, loading, error } = useAsync(
    () => fetchPersonStats(bio.id, { type: 'gameLog', group: 'pitching', season, gameType: MLB_LOG_GAME_TYPES }),
    [bio.id, season],
  )
  const [pick, setPick] = useState(null) // null reads the role's default chip
  const [metric, setMetric] = useState('era')
  const [at, setAt] = useState(null) // null follows the latest game
  const [playing, setPlaying] = useState(false)
  const kind = roleOf(log, asOf)
  const chips = CHIPS[kind]
  const views = useMemo(
    () => (chips ? Object.fromEntries(chips.windows.map((w) => [w, pformView(log, kind, w, asOf)])) : {}),
    [log, kind, chips, asOf],
  )
  // A short season has no window of the chip asked for: fall back to the longest it has.
  const w = views[pick ?? chips?.pick] ? (pick ?? chips.pick) : chips?.windows.findLast((n) => views[n])
  const view = views[w]
  const last = view ? view.points.length - 1 : 0
  const cursor = Math.min(at ?? last, last)
  const running = playing && cursor < last
  const empty = Boolean(error) || (!loading && !view) // a fetcher that resolves null ends the loader too

  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  useEffect(() => {
    onCount(view ? `${season} · ${view.games.length} ${view.starter ? 'GS' : 'G'}` : undefined)
  }, [view, season, onCount])
  useEffect(() => {
    if (!running) return undefined
    const t = setTimeout(() => setAt(cursor + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [running, cursor])

  if (empty) return null
  if (!view) return <div className="fform fform--wait" aria-busy="true"><p className="hint">Loading the form trend…</p></div>

  const scrub = (i) => {
    setPlaying(false)
    setAt(i)
  }
  const text = cursorText(view, cursor, metric)
  const chart = chartOf(view, metric)
  const name = METRICS[metric].label
  const { points } = chart
  return (
    <div className="fform">
      <div className="fform__top">
        <div className="fform__read" aria-live={running ? 'off' : 'polite'}>
          <span className="fform__big">{text.big}</span>
          <span className="fform__lines">
            <span className="fform__line1">{text.line1}</span>
            <span className="fform__line2">{text.line2}</span>
          </span>
        </div>
        <div className="fform__controls">
          <div className="fform__windows" role="group" aria-label="Rolling window">
            {chips.windows.map((n) => (
              <Pill key={n} role="control" fill="paper" pressed={n === w} disabled={!views[n]} onClick={() => { setPlaying(false); setPick(n); setAt(null) }}>
                {n} {chips.unit}
              </Pill>
            ))}
          </div>
          <div className="fform__windows" role="group" aria-label="Chart shows">
            {Object.entries(METRICS).map(([k, { label }]) => (
              <Pill key={k} role="control" fill="paper" pressed={k === metric} onClick={() => { setPlaying(false); setMetric(k) }}>
                {label}
              </Pill>
            ))}
          </div>
          {!motionIsReduced() && (
            <Button size="control" onClick={() => { if (!running && cursor >= last) setAt(0); setPlaying(!running) }}>
              {running ? 'Pause' : 'Play the season'}
            </Button>
          )}
        </div>
      </div>
      <FormChart
        {...chart}
        cursor={cursor}
        onCursor={scrub}
        label={`Line chart of ${w}-${chips.unit === 'IP' ? 'inning' : 'start'} rolling ${name} across ${view.games.length} games. Best ${chart.format(points[chart.best].v)}, worst ${chart.format(points[chart.worst].v)}${chart.season == null ? '' : `, season ${chart.format(chart.season)}`}.`}
      />
      <ul className="fform__legend">
        <li>Best stretch <b>{chart.format(points[chart.best].v)}</b></li>
        <li>Worst <b>{chart.format(points[chart.worst].v)}</b></li>
        {chart.season != null && <li>Season <b>{chart.format(chart.season)}</b></li>}
      </ul>
      <p className="fform__note">
        Each point is {name} over his last {w} {chips.unit === 'IP' ? 'innings' : 'starts'}. Green fill sits {chart.better === 'down' ? 'below' : 'above'} his season {name}, the other fill {chart.better === 'down' ? 'above' : 'below'}.
        Open surface: season stats only, no game result is shown.
      </p>
      <SectionHead look="rule" as="h3" note="Batters faced">How the stretches ended</SectionHead>
      <StretchTable columns={COLUMNS} rows={stretchRows(view, cursor, metric)} legend={OUTCOMES} ends={ENDS} cursor={cursor} onPick={scrub} />
      <p className="fform__note">
        Bar: how each plate appearance against him ended, left to right. Out is an out in play or a sacrifice. On base counts a walk or hit by pitch.
        Tap Best or Worst to move the chart to that stretch.
      </p>
    </div>
  )
}
