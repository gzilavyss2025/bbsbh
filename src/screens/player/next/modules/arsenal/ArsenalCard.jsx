import { useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
import { ZONE, sparkD } from './flightView.js'
import { FlightScene } from './FlightScene.jsx'
import { GlyphPath, PitchGlyph } from './PitchGlyph.jsx'

const MID = (ZONE.y0 + ZONE.y1) / 2
const dash = (v, f) => (v == null ? '—' : f(v))
const xwobaText = (v) => v.toFixed(3).replace(/^0/, '')

// The Pitch arsenal card (#1892, board ArsenalReveal.dc.html): the mix bar, the side view of every pitch
// leaving one release point, where each lands (catcher's view), and a menu that opens one pitch.
export function ArsenalCard({ rows }) {
  const [solo, setSolo] = useState(null)
  const [run, setRun] = useState(0) // a new key replays the paths' draw-in
  const flyers = rows.filter((r) => r.path)
  const one = rows.find((r) => r.code === solo) ?? null
  // A pick, a second tap on the picked card (MenuRail sends null) and "All pitches" each replay the
  // side view, as the board does.
  const pick = (code) => {
    setSolo(code)
    setRun((n) => n + 1)
  }
  return (
    <div className="arsenal__card">
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
      </div>
      <MenuRail
        label="Pitch type"
        items={rows.map((r) => ({
          key: r.code,
          title: r.mark.name,
          mark: <PitchGlyph mark={r.mark} />,
          meta: dash(r.velo, (v) => `${v.toFixed(1)} mph`),
          figures: (
            <>
              <span className="arsenal__figs">{r.pct}%</span>
              {r.path && (
                <svg className="arsenal__spark" viewBox="0 0 64 28" aria-hidden="true">
                  <path className="arsenal__sparkline" d={sparkD(r.path)} />
                </svg>
              )}
            </>
          ),
        }))}
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
