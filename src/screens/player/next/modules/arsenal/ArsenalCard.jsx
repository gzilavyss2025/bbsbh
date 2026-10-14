import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { useInViewOnce } from '../../../../../hooks/scroll/useInViewOnce.js'
import { viewKey } from '../../../../../lib/motion/inViewOnce.js'
import { ZONE, sparkD } from './flightView.js'
import { FlightScene } from './FlightScene.jsx'
import { GlyphPath, PitchGlyph } from './PitchGlyph.jsx'
import { beatsAt, countText, totalMs } from './timeline.js'

const MID = (ZONE.y0 + ZONE.y1) / 2
const dash = (v, f) => (v == null ? '—' : f(v))
const xwobaText = (v) => v.toFixed(3).replace(/^0/, '')
// The side view's clock: ms into the timeline, played by the animation frame, 50ms at most a frame (the
// board's cap). `null` means the end, so a new length never strands the last frame. `start` is 'play'
// (start at once), 'wait' (hold the first frame) or 'end'. A reader who asked for less motion stays on the end.
// `at` (the lab's frozen frames) pins t and wins over the clock.
function useArsenalClock(total, start, at = null) {
  const [t, setT] = useState(() => (start === 'end' || motionIsReduced() ? null : 0))
  const [playing, setPlaying] = useState(() => start === 'play' && !motionIsReduced())
  const pos = useRef(0)
  useEffect(() => {
    if (!playing) return undefined
    let raf
    let last = performance.now()
    const tick = (now) => {
      pos.current = Math.min(total, pos.current + Math.min(50, now - last))
      last = now
      setT(pos.current)
      if (pos.current >= total) {
        setT(null) // the end, so a later change of length never strands the last frame
        setPlaying(false)
      } else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, total])
  const seek = (v, play) => {
    pos.current = v ?? total
    setT(v)
    setPlaying(play)
  }
  const play = () => (motionIsReduced() ? seek(null, false) : seek(0, true))
  return { t: at ?? t ?? total, playing, play, seek }
}

// The Pitch arsenal card (#1892, board ArsenalReveal.dc.html): the mix bar, the side view of every pitch
// leaving one release point, where each lands (catcher's view), and a menu that opens one pitch.
export function ArsenalCard({ rows, id, at = null }) {
  // One entrance per page visit: the first time the card comes into view. A key already seen in this tab
  // (Back, a return) shows the last frame (docs/motion.md, "The one-shot gate").
  const [ref, phase] = useInViewOnce(viewKey(id, 'arsenal'))
  const [solo, setSolo] = useState(null)
  const flyers = rows.filter((r) => r.path)
  const one = rows.find((r) => r.code === solo) ?? null
  const pitches = useMemo(() => rows.map((r) => ({ code: r.code, ft: r.path?.T ?? null, rpm: r.spin })), [rows])
  const [S, setS] = useState(3) // 3: one-third of real speed, as the board plays; 6: one-sixth
  const total = totalMs(pitches, S)
  const clock = useArsenalClock(total, phase === 'rest' ? 'end' : 'wait', at)
  // 'play' comes once, from the observer, and stays. The clock starts in a rAF callback, not in the effect
  // body (react-hooks 7.1.1: set-state-in-effect).
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (phase === 'play') clock.play()
    })
    return () => cancelAnimationFrame(raf)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps
  const beats = beatsAt(clock.t, pitches, { S, solo: one?.path ? one.code : null })
  const byCode = new Map(beats.pitches.map((b) => [b.code, b]))
  // A pick, a second tap on the picked card (MenuRail sends null) and "All pitches" replay the timeline.
  const pick = (code) => {
    setSolo(code)
    clock.play()
  }
  const slower = () => {
    setS(S === 3 ? 6 : 3)
    clock.play()
  }
  return (
    <div className="arsenal__card" ref={ref}>
      <div className="arsenal__mixwrap" style={{ '--roll': beats.roll.toFixed(4) }}>
        <div className="arsenal__mix" role="img" aria-label={`Pitch mix: ${rows.map((r) => `${r.mark.name} ${Math.round(r.pct)}%`).join(', ')}`}>
          {rows.map((r) => (
            <span
              key={r.code}
              className={`arsenal__seg${r.mark.ring ? ' arsenal__seg--ring' : ''}`}
              style={{ flexGrow: r.pct, '--pitch': r.mark.color }}
            >
              <i className="arsenal__flash" aria-hidden="true" style={{ opacity: byCode.get(r.code).flash.toFixed(3) }} />
              <b>{r.code}</b>
              <span>{Math.round(r.pct)}%</span>
            </span>
          ))}
        </div>
        <i className="arsenal__rolledge" aria-hidden="true" style={{ opacity: beats.rollEdge ? 1 : 0 }} />
      </div>
      {flyers.length > 0 && (
        <div className="arsenal__side">
          <FlightScene
            camera="flat"
            w={336}
            h={180}
            items={flyers}
            s={Infinity}
            beats={byCode}
            ring={beats.ring}
            ticks={beats.ticks}
            label="Side view of the pitches leaving one release point and splitting before the plate"
          />
          <svg className="arsenal__inset" viewBox="0 0 80 82" role="img" aria-label="Catcher's view of where each pitch type lands">
            <text x="4" y="10" fontSize="5.6" letterSpacing="0.3">CATCHER VIEW</text>
            <rect className="arsenal__zonebox" x={40 - ZONE.x * 28} y={41 - (ZONE.y1 - MID) * 28} width={ZONE.x * 56} height={(ZONE.y1 - ZONE.y0) * 28} />
            {flyers.filter((r) => r.landing).map((r) => {
              const b = byCode.get(r.code)
              return (
                <g
                  key={r.code}
                  opacity={b.mark.o.toFixed(3)}
                  transform={`translate(${(40 + r.landing.x * 28).toFixed(1)} ${(41 - (r.landing.h - MID) * 28).toFixed(1)})`}
                >
                  <g transform={`scale(${b.mark.k.toFixed(3)})`}>
                    <GlyphPath mark={r.mark} r={3.4} />
                  </g>
                </g>
              )
            })}
          </svg>
        </div>
      )}
      <div className="arsenal__bar">
        {flyers.length > 0 && (
          <>
            <Button size="control" onClick={clock.play}>Replay</Button>
            <input
              type="range"
              className="arsenal__range"
              min="0"
              max={total}
              step="1"
              value={Math.round(clock.t)}
              onChange={(e) => clock.seek(Number(e.target.value), false)}
              aria-label="Scrub the pitch animation"
            />
            <Button size="control" onClick={slower} aria-label={`Playback speed: ${S === 3 ? 'one-third' : 'one-sixth'}`}>
              {S === 3 ? '⅓×' : '⅙×'}
            </Button>
          </>
        )}
      </div>
      <MenuRail
        label="Pitch type"
        items={rows.map((r) => {
          const b = byCode.get(r.code)
          const e = b.row.e
          return {
            key: r.code,
            title: r.mark.name,
            // The board's row entrance, set from the clock: a fade, a flip down from -80deg, a 10px rise and
            // a 3px blur. No transform or filter once it ends, so the card's own press is free to move it.
            className: e < 1 ? 'arsenal__entering' : undefined,
            style: {
              transformOrigin: '50% 0',
              opacity: (e * b.row.dim).toFixed(3),
              transform: e < 1 ? `perspective(700px) rotateX(${(-(1 - e) * 80).toFixed(2)}deg) translateY(${((1 - e) * 10).toFixed(2)}px)` : undefined,
              filter: e < 1 ? `blur(${((1 - e) * 3).toFixed(2)}px)` : undefined,
            },
            mark: (
              <>
                <i className="arsenal__sweep" aria-hidden="true" style={{ transform: `scaleX(${b.sweep.x.toFixed(3)})`, opacity: b.sweep.o.toFixed(3) }} />
                <span className="arsenal__pop" style={{ transform: `scale(${b.glyph.toFixed(3)})` }}>
                  <PitchGlyph mark={r.mark} />
                </span>
              </>
            ),
            meta: r.velo == null ? '—' : `${countText(r.velo, b.row.count, 1)} mph`,
            figures: (
              <>
                <span className="arsenal__figs">{countText(r.pct, b.row.count)}%</span>
                {r.path && (
                  <svg className="arsenal__spark" viewBox="0 0 64 28" aria-hidden="true">
                    <path
                      className="arsenal__sparkline"
                      d={sparkD(r.path)}
                      pathLength="1"
                      style={{ strokeDasharray: 1, strokeDashoffset: (1 - b.u).toFixed(4) }}
                    />
                  </svg>
                )}
              </>
            ),
          }
        })}
        picked={one?.code ?? null}
        onPick={pick}
        panel={(code) => {
          const r = rows.find((x) => x.code === code)
          return r ? <Detail r={r} /> : null
        }}
        backLabel="All pitches"
        railMeta
      />
    </div>
  )
}

function Detail({ r }) {
  return (
    <div className="arsenal__detail">
      <p className="arsenal__title"><PitchGlyph mark={r.mark} size={30} />{r.mark.name}</p>
      <div className="arsenal__stats">
        <span><b>{dash(r.velo, (v) => v.toFixed(1))}</b><i>Avg mph</i></span>
        <span><b>{r.pct}%</b><i>Usage</i></span>
        <span><b>{dash(r.spin, (v) => v.toLocaleString('en-US'))}</b><i>Spin, rpm</i></span>
        <span><b>{dash(r.flight, (v) => `${v.toFixed(2)} s`)}</b><i>Flight time</i></span>
        <span><b>{dash(r.whiffPct, (v) => `${v}%`)}</b><i>Whiff per swing</i></span>
        <span><b>{dash(r.xwoba, xwobaText)}</b><i>xwOBA against</i></span>
      </div>
      {r.path && (
        <div className="arsenal__drop">
          <i>Drop against a straight line</i>
          <svg viewBox="0 0 64 28" preserveAspectRatio="none" aria-hidden="true">
            <path className="arsenal__sparkbase" d="M2 14H62" />
            <path className="arsenal__sparkline" d={sparkD(r.path)} />
          </svg>
        </div>
      )}
    </div>
  )
}
