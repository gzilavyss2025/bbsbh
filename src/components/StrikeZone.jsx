import { useEffect, useRef, useState } from 'react'
import { TeamLogo } from './TeamLogo.jsx'

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

// Extra strip added to one side of the diagram for the batter's-box
// silhouette (see BatterSilhouette below) — added to the viewBox, not carved
// out of it, so the plate/pitch-dot plot keeps its usual scale. Keep in sync
// with the .strikezone--withbatter / .strikezone--modal.strikezone--withbatter
// widths in index.css, which are this same viewBox growth scaled by the
// diagram's own CSS width.
const BATTER_W = 60
// BatterSilhouette's source art (see its own comment) is drawn in a
// 112.63×195.63 box; scale it to BATTER_W wide and vertically center it on
// roughly the same band the old stick figure occupied.
const BATTER_ART_W = 112.63
const BATTER_SCALE = BATTER_W / BATTER_ART_W
const BATTER_TOP = 87

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

// The batter's-box silhouette: a batter at the plate, bat cocked over the
// shoulder, drawn canonically facing right (as if standing in a strip to the
// LEFT of the plate) and mirrored for the opposite box. Which side is which
// is decided by the caller (see the batSide handling in StrikeZone below).
// Public-domain art ("baseball2" by shokunin, part of a 2010 Ubuntu-palette
// sports-silhouette set — https://openclipart.org/detail/76927/baseball2-by-shokunin),
// traced at 112.63×195.63; the path below is that art's `d` unchanged, still
// in its original coordinate space, so the outer transforms below (BATTER_SCALE
// + BATTER_TOP, then the mirror) are what map it into the diagram.
function BatterSilhouette({ x, mirror }) {
  return (
    <g
      className="strikezone__batter"
      transform={mirror ? `translate(${x + BATTER_W}, 0) scale(-1, 1)` : `translate(${x}, 0)`}
    >
      <g transform={`translate(0, ${BATTER_TOP}) scale(${BATTER_SCALE})`}>
        <g transform="translate(-435.52, -310.31)">
          <path
            className="strikezone__battersil"
            d="m461.53 331.6-1.0214 5.9239 3.4726 1.2256 1.0214 2.8598-1.8385 2.0427s-2.6556 3.0641-2.4513 4.494c0.20427 1.4299 3.0641 16.546 3.0641 16.546l1.4299 5.9239 3.2684 2.0427 4.6983 4.6983 2.6556 6.5367 2.6555 8.988s-0.81709 2.0427 0.40854 2.8598c1.2256 0.81709-12.256 20.019-12.256 20.019l-6.5367 8.5795-9.6008 13.482s-1.4299 4.2897-1.0214 5.1068c0.40854 0.81709 2.4513 7.3538 2.4513 7.3538l0.81709 15.525 1.4299 22.266-13.073 11.031s-6.3325 1.4299-5.5154 2.8598 5.1068 2.6556 6.9453 2.4513c1.8385-0.20428 18.18-2.4513 18.18-2.4513l4.2897-0.20428s5.5154-0.40854 5.5154-1.2256c0-0.81709-0.61282-6.5367-0.61282-6.5367s-3.8812-5.5154-3.8812-6.3325c0-0.81709-1.2256-12.052-0.61282-13.482 0.61282-1.4299 1.0214-5.7196 1.0214-5.7196s2.0427-0.81709 1.8385-1.6342c-0.20427-0.8171-0.20427-4.0855-0.61282-4.9026-0.40854-0.81709-1.0214-7.5581-1.0214-8.3752 0-0.81709 0.20427-3.6769 0.20427-4.494 0-0.81709 4.9026-7.1496 5.5154-7.9666 0.61282-0.81709 8.988-8.7837 8.988-8.7837l8.3752-7.5581 2.8598-1.4299-0.40855 9.3966-0.61282 9.3966s-0.40855 8.5795-0.40855 9.8051 1.2256 6.1282 2.6556 6.3325c1.4299 0.20427 17.567 10.826 17.567 10.826l6.741 5.9239 12.256 12.869-1.4299 6.741-6.9453 8.7837s-3.6769 2.0427-1.6342 2.4513c2.0427 0.40854 11.848-0.61282 12.665-0.8171 0.81709-0.20427 8.5795-1.0214 8.5795-1.0214s4.0855-4.9026 4.6983-6.3325c0.61282-1.4299 1.8385-7.1496 1.8385-7.1496s-3.2684-3.0641-4.494-4.0855-6.1282-5.3111-6.741-6.1282c-0.61282-0.81709-2.6555-4.9026-3.4726-5.7196-0.81709-0.81709-4.9026-6.9453-4.9026-6.9453l-4.2897-7.1496-13.278-12.869 5.1068-21.653 3.6769-10.622 1.8385-11.031 0.81709-10.418-3.0641-4.6983s-0.20427-3.8812-0.40855-4.6983c-0.20427-0.81709-0.40854-3.6769-0.40854-3.6769s5.7196 2.247 6.5367 3.0641c0.81709 0.8171 6.9453 0.8171 6.9453 0.8171l0.61282-3.4726-1.8384-7.1496-2.8598-6.3325-2.4513-2.247 0.40855-2.4513-4.2897-2.6556-2.247-3.8812-1.6342-1.0214 0.20428-4.2897-2.0427-3.8812 6.9453-16.546 1.0214-3.8812-2.8598-3.0641-3.4726 0.61282-2.0427 1.8384s-1.2256 5.1068-1.4299 5.9239c-0.20427 0.81709-1.6342 13.073-1.6342 13.073l-5.9239-2.0427-8.1709-2.8598-7.3538-2.247-3.6769-1.8385s0-1.4299 0.61282-2.247c0.61281-0.81709 2.4513-4.0855 2.6555-4.9026 0.20428-0.8171-0.61282-6.5367-0.61282-6.5367s-2.4513-7.7624-3.2684-8.1709c-0.81709-0.40855-6.741-3.4726-8.7837-3.6769-2.0427-0.20427-8.3752-1.0214-10.418 0.20427-2.0427 1.2256-4.9026 2.8598-5.3111 3.8812-0.40855 1.0214-2.4513 3.0641-2.4513 3.8812 0 0.81709 0.20427 2.247 0.20427 2.247l-4.0855 1.6342-4.494 1.4299-1.4299 0.40855s2.0427 2.0427 3.6769 3.2684c1.6342 1.2256 5.7196 2.0427 5.7196 2.0427l2.247 1.8385z"
          />
        </g>
      </g>
    </g>
  )
}

// A batter stands in the box on the side of the plate closer to the base he
// runs out of the box toward: right-handed batters box on the third-base
// side, left-handed on the first-base side. In this catcher's-eye view (px
// positive = first-base side, matching the plate-crossing coordinates
// plotted below), that puts an 'R' batter's box to the left of the plate and
// an 'L' batter's box to the right.
export function StrikeZone({ pitchDetails, batSide, className = '' }) {
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

  // The silhouette is extra canvas, not carved out of the existing plot, so
  // the plate and pitch dots keep their usual scale — the whole zone plot
  // just shifts over to make room when the batter's box sits to its left.
  const showBatter = batSide === 'L' || batSide === 'R'
  const zoneOffsetX = batSide === 'R' ? BATTER_W : 0
  const totalW = showBatter ? W + BATTER_W : W

  return (
    <svg
      className={`strikezone ${className}${showBatter ? ' strikezone--withbatter' : ''}`}
      viewBox={`0 0 ${totalW} ${H}`}
      role="img"
      aria-label={`Strike zone: ${shown.length} pitch${shown.length === 1 ? '' : 'es'} plotted${
        showBatter ? `, ${batSide === 'L' ? 'left' : 'right'}-handed batter's box shown` : ''
      }`}
    >
      <g transform={`translate(${zoneOffsetX}, 0)`}>
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
      </g>
      {showBatter && <BatterSilhouette x={batSide === 'R' ? 0 : W + zoneOffsetX} mirror={batSide === 'R'} />}
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
            {p.mph != null ? `${p.mph} MPH, ` : ''}
            {p.callDesc}
            {p.challenge && <ChallengeMark challenge={p.challenge} />}
          </span>
        </li>
      ))}
    </ol>
  )
}

// The ABS challenge marker on a challenged pitch's row (see api/challenges.js's
// challengeForPlay) — the challenging club's own mark, then a plain solid dot
// for whether THAT CLUB's challenge succeeded. Deliberately never "good for
// the batter/pitcher": the color only ever answers one question — did the
// club whose mark is right next to it get the call it wanted — so it can't
// mean opposite things on a strike-to-ball overturn vs. a ball-to-strike one.
// Sits right after the call word, not out by the mph figure, so it reads as
// part of what this pitch was called. Solid fill only, no glyph inside — the
// ABS Challenges card's own pips (.abs__pip) never carry one either, so this
// stays one dot vocabulary for the whole app rather than a second.
function ChallengeMark({ challenge }) {
  const label = `${challenge.playerName ? `${challenge.playerName}'s` : 'A'} challenge ${
    challenge.outcome === 'success' ? 'succeeded' : 'failed'
  }`
  return (
    <span className="pitchlist__challenge" title={label}>
      <TeamLogo
        teamId={challenge.teamId}
        name={challenge.playerName}
        size={13}
        className="pitchlist__challengelogo"
      />
      <span
        className={`pitchlist__challengedot pitchlist__challengedot--${
          challenge.outcome === 'success' ? 'win' : 'loss'
        }`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
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

// The pitch-color key as an on-demand button + modal, sat in the half's header
// beside the "X bats • Y pitches" line. The five-color key used to sit inline
// above every revealed half; it's a static reference, so it moves behind a
// small "Pitch colors" button (a row of the five swatches as its icon) that
// opens the legend in a modal — the same dismiss contract as StrikeZoneModal.
// The key carries no game data, so the button is spoiler-free and can sit above
// the seal.
const PITCH_CATS = [
  { cat: 'ball', label: 'Ball' },
  { cat: 'called', label: 'Called' },
  { cat: 'whiff', label: 'Whiff' },
  { cat: 'foul', label: 'Foul' },
  { cat: 'inplay', label: 'In play' },
]

export function PitchColorsKey({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`pitchkeybtn ${className}`}
        onClick={() => setOpen(true)}
        aria-label="Show the pitch-color key"
      >
        <span className="pitchkeybtn__dots" aria-hidden="true">
          {PITCH_CATS.map((c) => (
            <i key={c.cat} className={`strikezone__sw strikezone__sw--${c.cat}`} />
          ))}
        </span>
        Pitch colors
      </button>
      {open && <PitchColorsModal onClose={() => setOpen(false)} />}
    </>
  )
}

function PitchColorsModal({ onClose }) {
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

  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="pcmodal" role="dialog" aria-modal="true" aria-label="Pitch color key">
        <div className="pcmodal__head">
          <span className="pcmodal__ttl">Pitch colors</span>
          <button ref={closeRef} className="szmodal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="pcmodal__hint">
          How every pitch dot — in the sequence ladder and each strike-zone plot — is colored.
        </p>
        <ul className="pcmodal__list">
          {PITCH_CATS.map((c) => (
            <li className="pcmodal__row" key={c.cat}>
              <i className={`strikezone__sw strikezone__sw--${c.cat}`} />
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// The phone presentation: the zone is too big to sit inline in a compact card,
// so a glyph button opens it in a modal. Same dismiss contract as LogoModal
// (backdrop tap / close button / Escape) and the same focus hand-off. All the
// content it shows is reveal-only pitch detail already in the revealed card, so
// the modal carries nothing the seal hasn't released.
export function StrikeZoneModal({ pitchDetails, batSide, batter, pitcher, onClose }) {
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
          <StrikeZone pitchDetails={pitchDetails} batSide={batSide} className="strikezone--modal" />
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
