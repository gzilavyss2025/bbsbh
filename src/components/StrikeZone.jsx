import { useEffect, useRef } from 'react'

// Per-plate-appearance strike-zone diagram: every pitch of the at-bat plotted
// where it crossed the plate (pX/pZ, feet, catcher's-eye view) against THIS
// batter's own zone (strikeZoneTop/Bottom). Dots are numbered in pitch order
// and colored by the same five categories as the pitch ladder (pitchDotCategory
// → cat), so the two read as one system.
//
// This is reveal-only by construction: it reads `pitchDetails` off a
// computeHalfInningFeed at-bat card, which is only built inside a SealBox reveal
// render — so the diagram never reaches the DOM before the half is revealed.
// At MiLB parks with no tracking pX/pZ are absent; StrikeZone renders nothing
// (guard with hasPitchLocations before laying out a slot for it).

// Plot geometry, in the same "feet" domain the feed reports. The plate is
// 17in = 1.417ft wide, so the rulebook zone's vertical edges sit at ±0.708ft;
// the domain is a touch wider so pitches just off the plate still land inside.
const W = 190
const H = 238
const PAD = 6
const DOM_X = [-1.55, 1.55]
const DOM_Z = [0.4, 4.6]
const EDGE = 0.708 // half plate width, ft

const sx = (px) => PAD + ((px - DOM_X[0]) / (DOM_X[1] - DOM_X[0])) * (W - 2 * PAD)
// SVG y grows downward, so height flips: the top of the zone maps to a small y.
const sy = (pz) => PAD + ((DOM_Z[1] - pz) / (DOM_Z[1] - DOM_Z[0])) * (H - 2 * PAD)

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// A pitch is plottable only with a full plate location + a zone to scale it in.
const plottable = (p) =>
  typeof p.px === 'number' &&
  typeof p.pz === 'number' &&
  typeof p.szTop === 'number' &&
  typeof p.szBottom === 'number'

export function StrikeZone({ pitchDetails, className = '' }) {
  const shown = (pitchDetails ?? []).filter(plottable)
  if (shown.length === 0) return null

  // The zone box wobbles a few tenths per pitch; median gives a steady frame.
  const zt = median(shown.map((p) => p.szTop))
  const zb = median(shown.map((p) => p.szBottom))
  const zx = sx(-EDGE)
  const zr = sx(EDGE)
  const zyT = sy(zt)
  const zyB = sy(zb)
  const zw = zr - zx
  const zh = zyB - zyT
  // A small home-plate pentagon under the zone anchors the catcher's-eye view.
  const py = sy(0.6)
  const cx = (zx + zr) / 2
  const half = zw / 2

  return (
    <svg
      className={`strikezone ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Strike zone: ${shown.length} pitch${shown.length === 1 ? '' : 'es'} plotted`}
    >
      <rect className="strikezone__frame" x={zx} y={zyT} width={zw} height={zh} />
      <line className="strikezone__third" x1={zx + zw / 3} y1={zyT} x2={zx + zw / 3} y2={zyB} />
      <line className="strikezone__third" x1={zx + (2 * zw) / 3} y1={zyT} x2={zx + (2 * zw) / 3} y2={zyB} />
      <line className="strikezone__third" x1={zx} y1={zyT + zh / 3} x2={zr} y2={zyT + zh / 3} />
      <line className="strikezone__third" x1={zx} y1={zyT + (2 * zh) / 3} x2={zr} y2={zyT + (2 * zh) / 3} />
      <polygon
        className="strikezone__plate"
        points={`${cx - half},${py - 8} ${cx + half},${py - 8} ${cx + half},${py - 2} ${cx},${py + 6} ${cx - half},${py - 2}`}
      />
      {shown.map((p) => {
        const x = sx(p.px)
        const y = sy(p.pz)
        return (
          <g key={p.no}>
            <circle className={`strikezone__dot strikezone__dot--${p.cat}`} cx={x} cy={y} r={8.5}>
              <title>
                Pitch {p.no}
                {p.mph != null ? `: ${p.mph} MPH` : ''}
                {p.type ? ` ${p.type}` : ''}
                {p.callDesc ? `, ${p.callDesc}` : ''}
              </title>
            </circle>
            <text className={`strikezone__num strikezone__num--${p.cat}`} x={x} y={y + 0.3}>
              {p.no}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// The numbered pitch-by-pitch list beside the diagram: pitch no (as a colored
// dot matching the zone), pitch type, velo, and how it ended. Shown on the
// desktop right cell and in the modal. Renders every pitch, plottable or not.
export function PitchList({ pitchDetails }) {
  const pitches = pitchDetails ?? []
  if (pitches.length === 0) return null
  return (
    <ol className="pitchlist">
      {pitches.map((p) => (
        <li className="pitchlist__row" key={p.no}>
          <span className={`pitchlist__num pitchlist__num--${p.cat}`}>{p.no}</span>
          <span className="pitchlist__type">{p.type || '—'}</span>
          <span className="pitchlist__meta">
            {p.mph != null ? `${p.mph} ` : ''}
            {p.callDesc}
          </span>
        </li>
      ))}
    </ol>
  )
}

// The legend for the five pitch-dot categories, shared by the modal and the
// desktop pane so the colors are always labeled where the zone appears.
export function StrikeZoneLegend() {
  return (
    <div className="strikezone__legend" aria-hidden="true">
      <span className="strikezone__li"><i className="strikezone__sw strikezone__sw--ball" />Ball</span>
      <span className="strikezone__li"><i className="strikezone__sw strikezone__sw--called" />Called</span>
      <span className="strikezone__li"><i className="strikezone__sw strikezone__sw--whiff" />Whiff</span>
      <span className="strikezone__li"><i className="strikezone__sw strikezone__sw--foul" />Foul</span>
      <span className="strikezone__li"><i className="strikezone__sw strikezone__sw--inplay" />In play</span>
    </div>
  )
}

// The phone presentation: the zone is too big to sit inline in a compact card,
// so a glyph button opens it in a modal. Same dismiss contract as LogoModal
// (backdrop tap / close button / Escape) and the same focus hand-off. All the
// content it shows is reveal-only pitch detail already in the revealed card, so
// the modal carries nothing the seal hasn't released.
export function StrikeZoneModal({ pitchDetails, batter, pitcher, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const name = `${batter?.last ?? ''}${batter?.first ? `, ${batter.first}` : ''}`.trim()
  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="szmodal" role="dialog" aria-modal="true" aria-label={`Pitch zone for ${name || 'this at-bat'}`}>
        <div className="szmodal__head">
          <div className="szmodal__ttl">
            <span className="szmodal__eyebrow">Pitch zone</span>
            <span className="szmodal__name">{name || 'At-bat'}</span>
            {pitcher ? <span className="szmodal__vs">vs {pitcher}</span> : null}
          </div>
          <button ref={closeRef} className="szmodal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="szmodal__body">
          <StrikeZone pitchDetails={pitchDetails} className="strikezone--modal" />
          <PitchList pitchDetails={pitchDetails} />
        </div>
        <StrikeZoneLegend />
      </div>
    </div>
  )
}

// The strike-zone glyph for the mobile card's icon button: the batter's zone as
// a 3×3 box with two pitch dots. Uses currentColor so it inherits ink on the
// card and seal-ink on the amber button.
export function StrikeZoneGlyph({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3.5" width="14" height="17" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <line x1="9.7" y1="3.5" x2="9.7" y2="20.5" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <line x1="14.3" y1="3.5" x2="14.3" y2="20.5" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <line x1="5" y1="9.2" x2="19" y2="9.2" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <line x1="5" y1="14.8" x2="19" y2="14.8" stroke="currentColor" strokeWidth="1" opacity="0.7" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="8" cy="17" r="1.4" fill="currentColor" />
    </svg>
  )
}
