import { BoxSheet, WinProbSheet } from './panels/GamedaySheets.jsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import '../../../styles/gameday-next/page.css'
import { SiteHeader } from '../../../components/chrome/SiteHeader.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'
import { blocksFor, menuFor } from '../../../lib/gameday/ladder.js'
import { BLOCK_LABEL, GamedayMenu } from './GamedayMenu.jsx'
import { GamedayPanel } from './panels/GamedayPanels.jsx'
import { useTier } from './useTier.js'
import { ScrollCue } from './ScrollCue.jsx'

// The Gameday page (ADR-0043's 2026-10-27 amendment): a fixed no-scroll frame whose blocks the
// window's tier places (lib/gameday/ladder.js). `engine` is the old half page, mounted hidden so
// the reveal flow, the live snapshot and the step cursor keep running.
// Blocks a panel fills; a stage or hero slot with nothing to draw yet shows its name.
const PANELLED = new Set(['navigator', 'trail', 'battingOrder', 'reference', 'arm', 'eventLog'])

// A rail tab rides its edge where the reader last left it (Gary, 2026-10-28): press and hold, then
// drag it up or down between the band and the bar; a plain tap still opens the rail. The spot is a
// share of the frame's height, kept per side.
const HOLD_MS = 350
const tabKey = (side) => `bbsbh:gdrailtab:${side}`
function readTabTop(side) {
  try {
    const v = Number(localStorage.getItem(tabKey(side)))
    return v > 0 && v < 100 ? v : null
  } catch { return null }
}
function useTabDrag(side) {
  const [top, setTop] = useState(() => readTabTop(side))
  const [lifted, setLifted] = useState(false)
  const drag = useRef(null)
  const dragged = useRef(false)
  const end = (e) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    clearTimeout(d.timer)
    if (!d.lifted) return
    e.stopPropagation()
    setLifted(false)
    dragged.current = true
    try { localStorage.setItem(tabKey(side), String(d.pct)) } catch { /* private mode: the spot lasts the visit */ }
  }
  const handlers = {
    onPointerDown: (e) => {
      // A press starts fresh: a drag whose release brought no click must not eat this tap.
      dragged.current = false
      const el = e.currentTarget
      const d = { id: e.pointerId, x: e.clientX, y: e.clientY, lifted: false }
      d.timer = setTimeout(() => {
        const frame = el.offsetParent
        const band = frame?.querySelector('.gdnext__band'), bar = frame?.querySelector('.gdnext__bar')
        if (!frame || !band || !bar) return
        d.lifted = true
        d.h = frame.clientHeight
        d.start = el.offsetTop
        d.min = band.offsetTop + band.offsetHeight
        d.max = bar.offsetTop - el.offsetHeight
        d.pct = (d.start / d.h) * 100
        try { el.setPointerCapture(d.id) } catch { /* the drag still follows while over the tab */ }
        setLifted(true)
      }, HOLD_MS)
      drag.current = d
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d) return
      if (!d.lifted) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { clearTimeout(d.timer); drag.current = null }
        return
      }
      d.pct = (Math.min(d.max, Math.max(d.min, d.start + e.clientY - d.y)) / d.h) * 100
      setTop(d.pct)
    },
    onPointerUp: end,
    onPointerCancel: end,
    onContextMenu: (e) => e.preventDefault(),
  }
  // The click that ends a drag opens nothing.
  const tapped = () => {
    if (!dragged.current) return true
    dragged.current = false
    return false
  }
  return { style: top != null ? { top: `${top}%` } : undefined, lifted, handlers, tapped }
}

// The trail keeps its newest chip in view (Gary, 2026-10-28; the wide tiers' strip too, 2026-10-29): each
// new at-bat scrolls it to the end, and the reader scrolls back to see what came before.
function HeroTrail({ children, className = 'gdnext__herotrail' }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof MutationObserver === 'undefined') return undefined
    // Only a new chip moves it: a re-render inside an existing chip leaves a reader's scroll-back alone.
    const chips = () => el.querySelectorAll('.gdp__chip').length
    let seen = chips()
    el.scrollLeft = el.scrollWidth
    const mo = new MutationObserver(() => {
      const n = chips()
      if (n > seen) el.scrollLeft = el.scrollWidth
      seen = n
    })
    mo.observe(el, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
  return <div ref={ref} className={className}>{children}</div>
}

export function GamedayNextPage({ sectionNav, band, panels, stage, hero, engine, advance, pitch, onBoxScore, lineups, notices = [], refresh, pregame, wideCheckpoint = false, trailPanels = null }) {
  const tier = useTier()
  const [menu, setMenu] = useState(false)
  const [sheet, setSheet] = useState(null)
  // The defense (the Reference block) is a drawer from the right where the window is wide enough
  // for one; the narrower tiers fold it into the Menu as before.
  const drawer = tier === 'L' || tier === 'D'
  const [defense, setDefense] = useState(false)
  // The drawer fetches nothing until it is first opened, then stays mounted so it can slide out.
  const [opened, setOpened] = useState(false)
  if (defense && !opened) setOpened(true)
  useEffect(() => {
    if (!defense) return undefined
    const onKey = (e) => e.key === 'Escape' && setDefense(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [defense])
  // The narrow tiers (P, T) keep the wide tiers' two side columns as rails (Gary, 2026-10-27): the Due up
  // slides in from the left and the arm on the mound from the right, by a tab on the edge or a sideways
  // swipe. Each rail fetches nothing until it is first opened, like the drawer.
  const rails = !drawer
  const [rail, setRail] = useState(null)
  // A rail open when the window widens past T closes, so it never comes back on its own.
  if (rail && !rails) setRail(null)
  const [seen, setSeen] = useState({})
  if (rail && !seen[rail]) setSeen({ ...seen, [rail]: true })
  // Escape closes the rail unless the Menu sits over it (the Menu's own Escape closes only the Menu).
  useEffect(() => {
    if (!rail || menu) return undefined
    const onKey = (e) => e.key === 'Escape' && setRail(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rail, menu])
  // Focus goes into a rail as it opens and back to its tab when it closes, so a keyboard or screen
  // reader keeps its place.
  const tabLeft = useRef(null), tabRight = useRef(null), railLeft = useRef(null), railRight = useRef(null)
  const lastRail = useRef(null)
  const dragLeft = useTabDrag('left'), dragRight = useTabDrag('right')
  useEffect(() => {
    const tabRef = { left: tabLeft, right: tabRight }, railRef = { left: railLeft, right: railRight }
    if (rail) {
      lastRail.current = rail
      railRef[rail].current?.focus()
      return
    }
    const side = lastRail.current
    lastRail.current = null
    if (side && (document.activeElement === document.body || railRef[side].current?.contains(document.activeElement))) tabRef[side].current?.focus()
  }, [rail])
  // The rails start under the band and its status strip, whatever height the strip takes.
  const bandRef = useRef(null)
  const [railTop, setRailTop] = useState(null)
  useLayoutEffect(() => {
    const el = bandRef.current
    if (!rails || !el || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => setRailTop(el.offsetTop + el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.previousElementSibling) ro.observe(el.previousElementSibling)
    return () => ro.disconnect()
  }, [rails])
  // A swipe is a mostly sideways drag of 48px or more that starts off the bar, with the Menu shut:
  // toward the middle it opens the rail on that side, toward its own edge it closes an open one.
  const swipe = useRef(null)
  const onPointerDown = (e) => { swipe.current = rails && !menu && !e.target.closest?.('.gdnext__bar') ? [e.clientX, e.clientY] : null }
  const onPointerUp = (e) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s[0], dy = e.clientY - s[1]
    if (Math.abs(dx) < 48 || Math.abs(dx) < 2 * Math.abs(dy)) return
    setRail((r) => (r ? ((r === 'left') === (dx < 0) ? null : r) : dx > 0 ? 'left' : 'right'))
  }
  // `pregame` (before the first pitch): the stage introduces the game's starting pitcher (Gary,
  // 2026-10-28), the pitcher pane's card, which holds no score. The first tap brings the field back.
  // The drawer tiers already show the arm in its own slot, so they keep the field.
  // The drawer tiers swap the Reference block for the arm on the mound (the field is the drawer).
  const slots = blocksFor(tier).flatMap((b) => (b === 'band' || b === 'bar' || (drawer && b === 'eventLog') ? [] : drawer && b === 'reference' ? ['arm'] : [b]))
  return (
    <div className="gdnext" data-tier={tier} data-rails={rails || undefined} data-checkpoint={wideCheckpoint || undefined} style={railTop != null ? { '--gd-rail-top': `${railTop}px` } : undefined} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {rails && <header className="gdnext__chrome"><SiteHeader />{sectionNav}</header>}
      {/* A delay or suspension, and a failed refresh, read as a strip under the band; the stage
          row gives up the room, so the frame still never scrolls. */}
      <div className="gdnext__band" ref={bandRef}>
        {band}
        {notices.length > 0 && (
          <p className="gdnext__notice t-label t-label--bold" role="status">{notices.join(' · ')}</p>
        )}
      </div>
      {slots.map((b) => (
        <section key={b} className={`gdnext__slot gdnext__slot--${b}`} aria-label={BLOCK_LABEL[b]}>
          {b === 'stage' && pregame && !drawer ? <GamedayPanel block="arm" ctx={panels} /> : b === 'stage' && stage ? stage : b === 'hero' && hero && tier === 'P' ? (
            // On the phone the hero's open floor carries the trail, so a tap moves between at-bats (Gary, 2026-10-28).
            <>{hero}<HeroTrail><GamedayPanel block="trail" ctx={trailPanels ?? panels} /></HeroTrail></>
          ) : b === 'hero' && hero ? hero : b === 'trail' ? (
            <HeroTrail className="gdnext__trailscroll"><GamedayPanel block="trail" ctx={trailPanels ?? panels} /></HeroTrail>
          ) : (
            <>
              <GamedayPanel block={b} ctx={panels} />
              {!PANELLED.has(b) && <span className="gdnext__slotname">{BLOCK_LABEL[b]}</span>}
            </>
          )}
        </section>
      ))}
      <div className="gdnext__bar">
        <Door layout="block" className="gdnext__menu" onClick={() => setMenu(true)} aria-haspopup="dialog">Menu</Door>
        {/* The step switch (ADR-0123): it reveals nothing, it sets what the next tap steps. */}
        <div className="gdnext__switch" role="group" aria-label="Step by">
          <Button size="control" pressed={!pitch.on} onClick={() => pitch.set(false)}>At-bat</Button>
          <Button size="control" pressed={pitch.on} onClick={() => pitch.set(true)}>Pitch</Button>
        </div>
        {drawer && (
          <Button size="control" className="gdnext__defbtn" pressed={defense} aria-expanded={defense} aria-controls="gdnext-defense" onClick={() => setDefense((d) => !d)}>Defense</Button>
        )}
        {/* The Box and Win % sheets (Gary, 2026-10-29): the game as of the reader's step, over the page. */}
        {drawer && <Button size="control" className="gdnext__sheetbtn" aria-haspopup="dialog" onClick={() => setSheet('box')}>Box</Button>}
        {drawer && <Button size="control" className="gdnext__sheetbtn" aria-haspopup="dialog" onClick={() => setSheet('wp')}>Win %</Button>}
        {/* aria-disabled, never `disabled`: a hold (the half closing, the step hold) must still
            take the tap that ends it early, and a disabled button gets no pointer events (ADR-0046). */}
        <Button skin="ink" className="gdnext__advance" aria-disabled={advance.disabled || undefined} onClick={() => !advance.disabled && advance.onClick()}>
          {advance.refresh ? <>{advance.label} <span aria-hidden="true">↻</span></> : `${advance.label} ›`}
        </Button>
        {/* The live edge, said once and politely (ADR-0055). Always mounted so the change is read. */}
        <p className="sr-only" role="status" aria-live="polite">{advance.caughtUp ? 'Caught up — waiting on the next batter' : ''}</p>
      </div>
      {drawer && (
        <aside id="gdnext-defense" className="gdnext__drawer" data-open={defense || undefined} aria-label="Defense" inert={!defense}>
          {opened && <GamedayPanel block="reference" ctx={panels} />}
        </aside>
      )}
      {rails && (
        <>
          <Button ref={tabLeft} size="control" className="gdnext__railtab gdnext__railtab--left" style={dragLeft.style} data-lifted={dragLeft.lifted || undefined} {...dragLeft.handlers} aria-expanded={rail === 'left'} aria-controls="gdnext-rail-left" onClick={() => dragLeft.tapped() && setRail('left')}>Due up</Button>
          <Button ref={tabRight} size="control" className="gdnext__railtab gdnext__railtab--right" style={dragRight.style} data-lifted={dragRight.lifted || undefined} {...dragRight.handlers} aria-expanded={rail === 'right'} aria-controls="gdnext-rail-right" onClick={() => dragRight.tapped() && setRail('right')}>Pitcher</Button>
          {rail && <button type="button" className="gdnext__scrim" aria-label="Close" onClick={() => setRail(null)} />}
          <aside ref={railLeft} tabIndex={-1} id="gdnext-rail-left" className="gdnext__rail gdnext__rail--left" data-open={rail === 'left' || undefined} aria-label="Due up" inert={rail !== 'left'}>
            {seen.left && <div className="gdnext__slot gdnext__slot--battingOrder"><ScrollCue label="More batters below" className="gdnext__railscroll"><GamedayPanel block="battingOrder" ctx={panels} /></ScrollCue></div>}
          </aside>
          <aside ref={railRight} tabIndex={-1} id="gdnext-rail-right" className="gdnext__rail gdnext__rail--right" data-open={rail === 'right' || undefined} aria-label="Pitcher" inert={rail !== 'right'}>
            {seen.right && <div className="gdnext__slot gdnext__slot--arm"><ScrollCue label="More of the pitcher below" className="gdnext__railscroll"><GamedayPanel block="arm" ctx={panels} /></ScrollCue></div>}
          </aside>
        </>
      )}
      <div hidden>{engine}</div>
      {sheet === 'box' && <BoxSheet ctx={panels} onClose={() => setSheet(null)} onFull={onBoxScore ? () => { setSheet(null); onBoxScore() } : null} />}
      {sheet === 'wp' && <WinProbSheet ctx={panels} onClose={() => setSheet(null)} />}
      {menu && (
        <GamedayMenu
          // The rails carry the batting order and the hero's floor the trail (Gary, 2026-10-28), so the Menu drops both there.
          folded={rails ? menuFor(tier).filter((b) => b !== 'battingOrder' && !(tier === 'P' && b === 'trail')) : menuFor(tier)}
          panels={panels}
          onClose={() => setMenu(false)}
          onBoxScore={onBoxScore}
          lineups={lineups}
          refresh={refresh}
        />
      )}
    </div>
  )
}
