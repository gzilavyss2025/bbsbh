import { useEffect, useState } from 'react'
import { fitTransform, visibleBox } from '../../../../lib/postseason/worldseries/scouting/markFit.js'
import { mastheadMarkFor } from '../../../../lib/headerTheme.js'
import { teamLogoUrl } from '../../../../lib/teams.js'
import { TeamLogo } from '../../../logo/TeamLogo.jsx'

// A club mark for the Roster card's club tabs, sized by what you can SEE: the mark's visible part
// fills the box, so the full-colour mark on the paper tab and the Identity Lab mark on the
// selected bar read at one size (marks carry different empty margins). A selected tab draws the
// club's bar mark (its own Identity Lab art, else the one-ink knockout), inked by --mark-filter.
// If the measure fails (a blocked read, a missing file), the plain TeamLogo draws instead.
const PROBE = 96

function measure(url, signal) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => resolve(null)
    img.onload = () => {
      try {
        const side = Math.max(img.naturalWidth, img.naturalHeight) || PROBE
        const k = PROBE / side
        const w = (img.naturalWidth || PROBE) * k
        const h = (img.naturalHeight || PROBE) * k
        const canvas = document.createElement('canvas')
        canvas.width = PROBE
        canvas.height = PROBE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        // Same placement as object-fit: contain in the box.
        ctx.drawImage(img, (PROBE - w) / 2, (PROBE - h) / 2, w, h)
        resolve(fitTransform(visibleBox(ctx.getImageData(0, 0, PROBE, PROBE).data, PROBE, PROBE)))
      } catch {
        resolve(null)
      }
    }
    signal.addEventListener('abort', () => resolve(null))
    img.src = url
  })
}

export function ClubMark({ teamId, name, selected, size = 26 }) {
  const barUrl = mastheadMarkFor(teamId, 'main').url ?? teamLogoUrl(teamId, 'mono')
  const paperUrl = teamLogoUrl(teamId, 'base')
  const url = selected ? barUrl : paperUrl
  // Both marks are measured on mount, so a tap that swaps them never shows a blank tab.
  const [fits, setFits] = useState({})
  useEffect(() => {
    const ctl = new AbortController()
    for (const u of [barUrl, paperUrl]) {
      if (u) measure(u, ctl.signal).then((transform) => !ctl.signal.aborted && setFits((f) => ({ ...f, [u]: transform })))
    }
    return () => ctl.abort()
  }, [barUrl, paperUrl])
  const fitted = fits[url]
  if (!fitted) {
    return (
      <TeamLogo
        teamId={teamId}
        name={name}
        size={size}
        variant={selected ? 'mono' : 'base'}
        overrideUrl={selected ? mastheadMarkFor(teamId, 'main').url : null}
        className={selected ? 'ww-roster__logo ww-roster__logo--bar' : 'ww-roster__logo'}
      />
    )
  }
  return (
    <span className="ww-roster__mark" style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={url}
        alt=""
        className={selected ? 'ww-roster__mark-img ww-roster__logo--bar' : 'ww-roster__mark-img'}
        style={{ transform: fitted }}
      />
    </span>
  )
}
