import { useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { ZONE, dropCurve } from './flightView.js'
import { FlightScene } from './FlightScene.jsx'
import { GlyphPath, PitchGlyph } from './PitchGlyph.jsx'

const MID = (ZONE.y0 + ZONE.y1) / 2
const dash = (v, f) => (v == null ? '—' : f(v))
const xwobaText = (v) => v.toFixed(3).replace(/^0/, '')

// The drop under a straight line from release to landing, as a 64 x 28 sparkline (1 px an inch).
const sparkD = (path) => dropCurve(path).map((v, i, a) => `${i ? 'L' : 'M'}${2 + (60 * i) / (a.length - 1)} ${(14 - v * 12).toFixed(1)}`).join('')

// The Pitch arsenal card (#1892, board ArsenalReveal.dc.html): the mix bar, the side view of every pitch
// leaving one release point, where each lands (catcher's view), and a menu that opens one pitch.
export function ArsenalCard({ rows }) {
  const [solo, setSolo] = useState(null)
  const [run, setRun] = useState(0) // a new key replays the paths' draw-in
  const flyers = rows.filter((r) => r.path)
  const one = rows.find((r) => r.code === solo) ?? null
  return (
    <div className={`arsenal__card${one ? ' arsenal__card--solo' : ''}`}>
      <div className="arsenal__mix" role="img" aria-label={`Pitch mix: ${rows.map((r) => `${r.mark.name} ${Math.round(r.pct)}%`).join(', ')}`}>
        {rows.map((r) => (
          <span
            key={r.code}
            className={`arsenal__seg${r.mark.ring ? ' arsenal__seg--ring' : ''}`}
            style={{ flexGrow: r.pct, '--pitch': r.mark.color }}
          >
            <b>{r.code}</b>
            <span>{Math.round(r.pct)}%</span>
          </span>
        ))}
      </div>
      {flyers.length > 0 && (
        <div className="arsenal__side" key={run}>
          <FlightScene
            camera="flat"
            w={336}
            h={180}
            items={flyers}
            s={Infinity}
            solo={one?.path ? one.code : null}
            label="Side view of the pitches leaving one release point and splitting before the plate"
          />
          <svg className="arsenal__inset" viewBox="0 0 80 82" role="img" aria-label="Catcher's view of where each pitch type lands">
            <text x="4" y="10" fontSize="5.6" letterSpacing="0.3">CATCHER VIEW</text>
            <rect className="arsenal__zonebox" x={40 - ZONE.x * 28} y={41 - (ZONE.y1 - MID) * 28} width={ZONE.x * 56} height={(ZONE.y1 - ZONE.y0) * 28} />
            {flyers.filter((r) => r.landing).map((r) => (
              <g
                key={r.code}
                opacity={one && one.code !== r.code ? 0.3 : 1}
                transform={`translate(${(40 + r.landing.x * 28).toFixed(1)} ${(41 - (r.landing.h - MID) * 28).toFixed(1)})`}
              >
                <GlyphPath mark={r.mark} r={3.4} />
              </g>
            ))}
          </svg>
        </div>
      )}
      <div className="arsenal__bar">
        {flyers.length > 0 && <Button size="control" onClick={() => setRun(run + 1)}>Replay</Button>}
        {one && <Button size="control" onClick={() => setSolo(null)}>← All pitches</Button>}
      </div>
      <div className={`arsenal__menu${one ? ' arsenal__menu--rail' : ''}`} role="group" aria-label="Pitch type">
        {rows.map((r) => (
          <Button
            key={r.code}
            className="arsenal__pick"
            pressed={one?.code === r.code}
            onClick={() => setSolo(one?.code === r.code ? null : r.code)}
          >
            <span className="arsenal__name"><PitchGlyph mark={r.mark} /><b>{r.mark.name}</b></span>
            <span className="arsenal__figs">{dash(r.velo, (v) => `${v.toFixed(1)} mph`)} · {r.pct}%</span>
            {r.path && (
              <svg className="arsenal__spark" viewBox="0 0 64 28" aria-hidden="true">
                <path className="arsenal__sparkline" d={sparkD(r.path)} />
              </svg>
            )}
          </Button>
        ))}
      </div>
      {one && <Detail r={one} />}
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
