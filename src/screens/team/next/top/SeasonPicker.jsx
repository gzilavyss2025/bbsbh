import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { franchiseFor } from '../../../../api/franchiseHistory.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useDialogFocus } from '../../../../hooks/dialog/useDialogFocus.js'
import { IconButton } from '../../../../components/ui/control/IconButton.jsx'
import { useNav } from '../../../../lib/nav.js'
import { teamPath, teamTabPath } from '../../../../lib/route.js'
import { yearAsOf } from '../../../../lib/dates.js'
import { seasonEras } from './seasonEras.js'
import '../../../../styles/team-next/season-sheet.css'

// The hero's year chip and its season sheet (#2599; wireframe approved by Gary 2026-10-23, option
// A). The chip is a door: it opens the sheet. A year opens that season (`?y=`), the current season
// is the bare page (the way back). MLB only; the caller keeps the plain tag for anyone else. At the
// wide step the sheet is a popover under the chip (team-next/top.css). The sheet is portalled into
// #root: the hero is a stamped card whose stamp-in transform would trap a fixed scrim, and #root
// keeps the ALL-CAPS rule (src/components/chrome/CLAUDE.md).
export function SeasonPicker({ team, season, current, label }) {
  const [anchor, setAnchor] = useState(null)
  const close = useCallback(() => setAnchor(null), [])
  const open = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setAnchor({ top: r.bottom, right: window.innerWidth - r.right })
  }
  return (
    <>
      <button type="button" className="door tnext__yearchip" aria-haspopup="dialog" aria-expanded={anchor != null}
        aria-label={`Choose a season, now ${season}`} onClick={open}>
        <span>{season}</span>
        <svg className="tnext__yearcaret" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
        <span className="tnext__yearlevel">· {label}</span>
      </button>
      {anchor && createPortal(<SeasonSheet team={team} season={season} current={current} anchor={anchor} onClose={close} />, document.getElementById('root') ?? document.body)}
    </>
  )
}

function SeasonSheet({ team, season, current, anchor, onClose }) {
  const navigate = useNav()
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const eras = seasonEras(useAsync(() => franchiseFor(team.id), [team.id]).data?.spans, current)
  const count = eras.reduce((n, e) => n + e.years.length, 0)
  const go = (path) => {
    onClose()
    navigate(path)
  }
  const pick = (y) => go(y === current ? teamPath(team.id, { name: team.name }) : teamPath(team.id, { name: team.name, d: yearAsOf(String(y)) }))
  return (
    <div className="scrim tnext__yearscrim" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ '--pop-top': `${anchor.top}px`, '--pop-right': `${anchor.right}px` }}>
      <div className="sheet tnext__yearsheet" role="dialog" aria-modal="true" aria-labelledby="tnext-yearsheet-title">
        <div className="tnext__yearsheet-head">
          <div>
            <p className="tnext__yearsheet-sub">{count ? `${team.name} · ${count} seasons` : team.name}</p>
            <h2 id="tnext-yearsheet-title" className="sheet__title">Pick a season</h2>
          </div>
          <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
        </div>
        <div className="tnext__yearsheet-body">
          {eras.map((era) => (
            <section key={era.from} className="tnext__era" aria-label={`${era.name} · ${era.league}`}>
              <p className="tnext__era-head">
                <span>{era.name} · {era.league}</span>
                <span className="tnext__era-span">{era.from === era.to ? era.from : `${era.from} to ${era.to}`}</span>
              </p>
              <div className="tnext__years">
                {era.years.map((y) => (
                  <button key={y} type="button" onClick={() => pick(y)} aria-current={y === season ? 'page' : undefined}
                    className={`tnext__year${y === current ? ' tnext__year--now' : ''}${y === season ? ' is-active' : ''}`}>
                    {y}
                    {y === current && <span className="tnext__year-now">Now</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="tnext__yearsheet-foot">
          <button type="button" className="door tnext__yearsheet-door" onClick={() => go(teamTabPath(team.id, 'franchise', { name: team.name }))}>
            <span>All seasons · franchise page</span>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </div>
  )
}
