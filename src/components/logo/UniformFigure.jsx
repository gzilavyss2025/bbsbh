import { useRef, useState } from 'react'
import { batterFigureUrls } from '../../api/uniforms.js'
import { Button } from '../ui/control/Button.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'

// Gameday's batter figure for tonight's uniform (#1852): the pants image under
// the jersey image, same canvas, in a box of fixed width and height so the page
// does not shift while they load. Spoiler-free static art
// (docs/uniforms-and-logos.md, "Batter figure images"). `crossOrigin` lets the
// service worker's CacheFirst rule store the response.
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

// The Uniform fact's thumbnail: a ghost Button that opens the full-size figure
// in a sheet (the LogoModal pattern). Renders nothing when the side has no
// complete figure (pregame, MiLB, half posted), and hides itself, sheet
// included, when either image fails to load — no broken-image icon.
export function UniformFigureButton({ assets, label }) {
  const urls = batterFigureUrls(assets)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!urls || failed) return null
  const fail = () => setFailed(true)
  return (
    <>
      <Button skin="ghost" className="fact__tap" aria-label="Show uniform" onClick={() => setOpen(true)}>
        <UniformFigure urls={urls} label="" size={44} onError={fail} />
      </Button>
      {open && (
        <ModalPortal>
          <UniformSheet onClose={() => setOpen(false)}>
            <UniformFigure urls={urls} label={label} size={180} onError={fail} />
            <p className="ufig__text">{label}</p>
          </UniformSheet>
        </ModalPortal>
      )}
    </>
  )
}

// Own component so `useDialogFocus` runs only while the sheet is mounted.
function UniformSheet({ onClose, children }) {
  const closeRef = useRef(null)
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
        {children}
      </div>
    </div>
  )
}
