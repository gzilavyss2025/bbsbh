import { useRef, useState } from 'react'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { Door } from '../ui/control/Door.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'

// THROWAWAY MOCKUP for issue #1852 — hard-coded to gamePk 823735. Never merge.
const BASE = 'https://prod-gameday.mlbstatic.com/responsive-gameday-assets/1.3.0/images/batters/2026'
const ART = { away: [138, 2], home: [158, 5] }
const q = () => new URLSearchParams(window.location.search)
export const mockDirection = () => q().get('fig') || ''
const mockHand = () => (q().get('hand') === 'left' ? 'left' : 'right')

export function Figure({ side, className = '' }) {
  const [id, n] = ART[side]
  const hand = mockHand()
  const u = (k) => `${BASE}/${hand}/${id}_${k}_${n}_2026.png`
  return (
    <span className={`bfig ${className}`.trim()} aria-hidden="true">
      <img className="bfig__layer" src={u('pants')} alt="" />
      <img className="bfig__layer" src={u('jersey')} alt="" />
    </span>
  )
}

const dash = <span className="fact__na">—</span>

// (a) small figure beside the Uniform text, in its own cell
export function UniformFactA({ side, uniform }) {
  return (
    <div className="fact fact--fig">
      <Cluster gap="base" align="center" className="fact__figrow">
        <div>
          <dt className="fact__label">Uniform</dt>
          <dd className="fact__value">{uniform || dash}</dd>
        </div>
        <Figure side={side} className="bfig--a" />
      </Cluster>
    </div>
  )
}

// (b) the Uniform value is a door that opens a sheet with the full figure
export function UniformFactB({ side, uniform }) {
  const [open, setOpen] = useState(() => q().get('sheet') === '1')
  const closeRef = useRef(null)
  return (
    <div className="fact">
      <dt className="fact__label">Uniform</dt>
      <dd className="fact__value">
        {uniform ? (
          <Door onClick={() => setOpen(true)} aria-label={`${uniform} — see the batter figure`}>
            {uniform}
          </Door>
        ) : (
          dash
        )}
      </dd>
      {open && (
        <ModalPortal>
          <FigureSheet side={side} uniform={uniform} onClose={() => setOpen(false)} closeRef={closeRef} />
        </ModalPortal>
      )}
    </div>
  )
}

function FigureSheet({ side, uniform, onClose, closeRef }) {
  useDialogFocus(closeRef, onClose)
  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="logomodal bfig-sheet" role="dialog" aria-modal="true" aria-label="Tonight’s uniform">
        <IconButton ref={closeRef} mark="md" className="logomodal__close" onClick={onClose} label="Close">
          ✕
        </IconButton>
        <Figure side={side} className="bfig--b" />
        <p className="bfig-sheet__cap">{uniform}</p>
      </div>
    </div>
  )
}

// (d) the Uniform fact takes a full-width row of its own: figure on the left,
// the words beside it. Broadcast moves up next to Manager (the small move).
export function UniformFactD({ side, uniform }) {
  return (
    <div className="fact fact--wide fact--fig">
      <Cluster gap="base" align="center" className="fact__figrow">
        <Figure side={side} className="bfig--d" />
        <div>
          <dt className="fact__label">Uniform</dt>
          <dd className="fact__value">{uniform || dash}</dd>
        </div>
      </Cluster>
    </div>
  )
}

// (c) the figure stands in the club-name bar
export function HeadFigure({ side }) {
  return <Figure side={side} className="bfig--c" />
}
