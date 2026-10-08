import { useEffect, useRef, useState } from 'react'
import { fetchOvrHistory } from '../../api/ovr/ovrData.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { countUpValue, ovrView } from '../../lib/ovr/card.js'
import { durationMs } from '../../lib/scorecard/glide.js'
import { IconButton } from '../ui/control/IconButton.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { OvrBars } from './OvrBars.jsx'
import { OvrPath } from './OvrPath.jsx'

const GROUPS = [['hitting', 'Hitting'], ['pitching', 'Pitching']]

// The season sparkline: this season's ratings as one line, the last point dotted.
function Spark({ values }) {
  const W = 84
  const H = 22
  const lo = Math.min(...values)
  const span = Math.max(...values) - lo || 1
  const x = (i) => 2 + (i * (W - 4)) / (values.length - 1)
  const y = (v) => H - 3 - ((v - lo) * (H - 6)) / span
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="ovrmenu__spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Season trend, ${values[0]} to ${values.at(-1)}`}>
      <path d={d} fill="none" stroke="var(--tier)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="3" fill="var(--tier)" />
    </svg>
  )
}

// The big number. While the menu plays it runs from the floor to the value on the app's
// ease-out, over twice --dur-slow, after twice --dur-fast (so it runs under the flash, as the
// CSS in motion/ovr.css does). It has its own state so a frame re-renders this span and not
// the menu. It starts at the floor on the first paint, so the final number never flashes.
function Count({ rootRef, to, playing }) {
  const [n, setN] = useState(playing ? countUpValue(0, to) : null)
  useEffect(() => {
    if (!playing) return undefined
    const css = getComputedStyle(rootRef.current)
    const ms = durationMs(css.getPropertyValue('--dur-slow'), 360) * 2
    const delay = durationMs(css.getPropertyValue('--dur-fast'), 120) * 2
    const t0 = performance.now()
    let raf
    const tick = (t) => {
      const k = (t - t0 - delay) / ms
      setN(k >= 1 ? null : countUpValue(Math.max(k, 0), to))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [rootRef, to, playing])
  return <span className="ovrmenu__num" aria-hidden="true">{playing ? (n ?? to) : to}</span>
}

// The open OVR card (#1703): a dialog built like BallparkModal (.scrim, backdrop tap, close
// button, Escape, focus in and back). Mounts only on a tap, which is the gate for its motion
// (`play`, read from motionIsReduced at that tap). Switching a two-way player to his other
// rating stops the motion: that is a read, not an arrival. `ratings` is useOvr's answer.
export function OvrMenu({ id, ratings, initialGroup, personId, name, sub, play, onClose }) {
  const [state, setState] = useState({ group: initialGroup, play })
  const { group } = state
  const closeRef = useRef(null)
  const rootRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  // Keyed to the group it was read for: useAsync clears its data one render late.
  const { data } = useAsync(async () => ({ group, rows: await fetchOvrHistory(personId, group) }), [personId, group])
  const view = ovrView({ rating: ratings[group], group, history: data?.group === group ? data.rows : [] })
  const { minor, change } = view

  return (
    <ModalPortal>
      <div className="scrim ovrscrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div
          id={id}
          ref={rootRef}
          className={`ovrmenu${state.play ? ' ovrmenu--play' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${name}, OVR ${view.ovr}`}
          style={{ '--tier': `var(--ovr-${view.tier.key})`, '--ovr-rows': view.rows.length || 1 }}
        >
          <div className="ovrmenu__panel">
            <header className="ovrmenu__head">
              <div className="ovrmenu__who">
                <h2 className="ovrmenu__name">{name}</h2>
                {sub && <p className="ovrmenu__sub">{sub}</p>}
              </div>
              <IconButton ref={closeRef} className="ovrmenu__close" label="Close" onClick={onClose}>✕</IconButton>
            </header>

            {Object.keys(ratings).length > 1 && (
              <div className="ovrmenu__groups">
                {GROUPS.map(([key, label]) => (
                  <Pill key={key} role="control" fill="paper" pressed={group === key} onClick={() => setState({ group: key, play: false })}>
                    {label}
                  </Pill>
                ))}
              </div>
            )}

            <div className="ovrmenu__hero">
              <div className="ovrmenu__ovr">
                <Count rootRef={rootRef} to={view.ovr} playing={state.play} />
                <span className="ovrmenu__label">OVR</span>
              </div>
              <div className="ovrmenu__tier">
                <span className="ovrmenu__ribbon">{view.tier.name}{minor?.levelLabel && ` · ${minor.levelLabel}`}</span>
                {(change || view.spark) && (
                  <div className="ovrmenu__form">
                    {change && (
                      <>
                        <span>{change.days} days</span>
                        <span className={`ovrmenu__change ovrmenu__change--${change.dir}`}>
                          {change.dir === 'up' && '▲ '}
                          {change.dir === 'down' && '▼ '}
                          {change.text}
                        </span>
                      </>
                    )}
                    {view.spark && <Spark values={view.spark} />}
                  </div>
                )}
              </div>
              {minor && (
                <div className="ovrmenu__pot">
                  <span className="ovrmenu__potnum">{minor.pot ?? '—'}</span>
                  <span className="ovrmenu__label">POT</span>
                </div>
              )}
            </div>

            {minor ? (
              <>
                <p className="ovrmenu__sec">Path to the majors</p>
                <OvrPath minor={minor} />
              </>
            ) : (
              view.rows.length > 0 && (
                <>
                  <p className="ovrmenu__sec">Attributes</p>
                  <OvrBars rows={view.rows} />
                </>
              )
            )}

            <footer className="ovrmenu__foot">
              <span>Tally&apos;s own rating</span>
              {view.seasons && <span>{view.seasons}</span>}
            </footer>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
