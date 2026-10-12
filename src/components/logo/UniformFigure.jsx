import { useRef, useState } from 'react'
import { IconButton } from '../ui/control/IconButton.jsx'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'

// Gameday's batter figure for tonight's uniform (#1852): the pants image under
// the jersey image, same canvas, in a box of fixed width and height so nothing
// shifts while they load. Spoiler-free static art
// (docs/uniforms-and-logos.md, "Batter figure images"). `crossOrigin` lets the
// service worker's CacheFirst rule store the response. `urls` is
// `batterFigureUrls`' result, which the caller has already checked for null.
const ASPECT = 1050 / 496 // the art's tall canvas

export function UniformFigure({ urls, label, size, onError }) {
  const img = (src, alt) => (
    <img
      className="ufig__img"
      src={src}
      alt={alt}
      loading="lazy"
      crossOrigin="anonymous"
      onError={onError}
    />
  )
  return (
    <span className="ufig" style={{ width: size, height: Math.round(size * ASPECT) }}>
      {img(urls.pants, '')}
      {img(urls.jersey, label)}
    </span>
  )
}

// A shirt outline, so the control reads as "the uniform" without drawing it.
function ShirtIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-1 2-7 2-8 0Z" />
    </svg>
  )
}

// The Uniform fact's shirt button: it opens the full-size figure in a sheet
// (the LogoModal pattern). The sheet is the only place the images load, so a
// failed image hides the figure there and leaves the uniform text: no broken
// icon. The sheet remounts on each open, so a failure never sticks.
export function UniformFigureButton({ urls, label }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton mark="md" skin="outline" label={`Show uniform: ${label}`} onClick={() => setOpen(true)}>
        <ShirtIcon />
      </IconButton>
      {open && (
        <ModalPortal>
          <UniformSheet urls={urls} label={label} onClose={() => setOpen(false)} />
        </ModalPortal>
      )}
    </>
  )
}

// Own component so `useDialogFocus` runs only while the sheet is mounted.
function UniformSheet({ urls, label, onClose }) {
  const closeRef = useRef(null)
  const [failed, setFailed] = useState(false)
  useDialogFocus(closeRef, onClose)
  return (
    <div
      className="scrim scrim--center"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="logomodal" role="dialog" aria-modal="true" aria-label="Tonight's uniform">
        <IconButton ref={closeRef} mark="md" className="logomodal__close" onClick={onClose} label="Close">
          ✕
        </IconButton>
        {!failed && <UniformFigure urls={urls} label={label} size={180} onError={() => setFailed(true)} />}
        <p className="fact__value ufig__text">{label}</p>
      </div>
    </div>
  )
}
