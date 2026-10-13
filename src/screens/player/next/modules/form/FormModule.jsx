import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/batter/form.css'
import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { MLB_LOG_GAME_TYPES } from '../../../../../api/boxlines/rows.js'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Pill } from '../../../../../components/ui/control/Pill.jsx'
import { SectionHead } from '../../../../../components/ui/frame/SectionHead.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { rate3 } from '../../../../../api/person/shared.js'
import { FormChart } from './FormChart.jsx'
import { StretchTable } from './StretchTable.jsx'
import { COLUMNS, DEFAULT_WINDOW, ENDS, OUTCOMES, WINDOWS, cursorText, formView, stretchRows } from './formView.js'

// The batter Form trend (#1889): his rolling OPS over the last 10, 15 or 20 games against the
// season line, and how each stretch ended. An open surface (ADR-0034): season stats only, no
// game result. One game-log fetch, the same call the Recent form card makes.
const STEP_MS = 45

export default function FormModule({ bio, asOf, season, onEmpty, onCount }) {
  const { data: log, error } = useAsync(
    () => fetchPersonStats(bio.id, { type: 'gameLog', group: 'hitting', season, gameType: MLB_LOG_GAME_TYPES }),
    [bio.id, season],
  )
  const [pick, setPick] = useState(DEFAULT_WINDOW)
  const [at, setAt] = useState(null) // null follows the latest game
  const [playing, setPlaying] = useState(false)
  const views = useMemo(() => Object.fromEntries(WINDOWS.map((w) => [w, formView(log, w, asOf)])), [log, asOf])
  // A short season has no 15-game window: fall back to the longest one it has.
  const w = views[pick] ? pick : WINDOWS.findLast((n) => views[n])
  const view = views[w]
  const last = view ? view.points.length - 1 : 0
  const cursor = Math.min(at ?? last, last)
  const running = playing && cursor < last

  useEffect(() => {
    if (error || (log && !view)) onEmpty()
  }, [error, log, view, onEmpty])
  useEffect(() => {
    onCount(view ? `${season} · ${view.games.length} G` : undefined)
  }, [view, season, onCount])
  useEffect(() => {
    if (!running) return undefined
    const t = setTimeout(() => setAt(cursor + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [running, cursor])

  if (error || (log && !view)) return null
  if (!view) return <div className="fform fform--wait"><p className="hint">Loading the form trend…</p></div>

  const scrub = (i) => {
    setPlaying(false)
    setAt(i)
  }
  const text = cursorText(view, cursor)
  const { points } = view
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
            {WINDOWS.map((n) => (
              <Pill key={n} role="control" fill="paper" pressed={n === w} disabled={!views[n]} onClick={() => { setPlaying(false); setPick(n); setAt(null) }}>
                {n} games
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
        points={points}
        season={view.seasonOps}
        better="up"
        step={0.1}
        best={view.best}
        worst={view.worst}
        cursor={cursor}
        onCursor={scrub}
        format={rate3}
        label={`Line chart of ${w}-game rolling OPS across ${view.games.length} games. Best ${rate3(points[view.best].v)}, worst ${rate3(points[view.worst].v)}${view.seasonOps == null ? '' : `, season ${rate3(view.seasonOps)}`}.`}
      />
      <ul className="fform__legend">
        <li>Best stretch <b>{rate3(points[view.best].v)}</b></li>
        <li>Worst <b>{rate3(points[view.worst].v)}</b></li>
        {view.seasonOps != null && <li>Season <b>{rate3(view.seasonOps)}</b></li>}
        {points.some((p) => p.mark) && <li>Game with a home run</li>}
      </ul>
      <p className="fform__note">
        Each point is OPS over his last {w} games. Green fill sits above his season OPS, the other fill below.
        Open surface: season stats only, no game result is shown.
      </p>
      <SectionHead look="rule" as="h3" note="Plate appearances">How the stretches ended</SectionHead>
      <StretchTable columns={COLUMNS} rows={stretchRows(view, cursor)} legend={OUTCOMES} ends={ENDS} cursor={cursor} onPick={scrub} />
      <p className="fform__note">
        Bar: how each plate appearance ended, left to right. Out is an out in play or a sacrifice. On base counts a walk or hit by pitch.
        Tap Best or Worst to move the chart to that stretch.
      </p>
    </div>
  )
}
