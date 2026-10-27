import { useEffect, useRef, useState } from 'react'
import '../../../styles/gameday-next/page.css'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'
import { blocksFor, menuFor } from '../../../lib/gameday/ladder.js'
import { BLOCK_LABEL, GamedayMenu } from './GamedayMenu.jsx'
import { GamedayPanel } from './panels/GamedayPanels.jsx'
import { useTier } from './useTier.js'

// The Gameday page (ADR-0043's 2026-10-27 amendment): a fixed no-scroll frame whose blocks the
// window's tier places (lib/gameday/ladder.js). `engine` is the old half page, mounted hidden so
// the reveal flow, the live snapshot and the step cursor keep running.
// Blocks a panel fills; a stage or hero slot with nothing to draw yet shows its name.
const PANELLED = new Set(['navigator', 'trail', 'battingOrder', 'reference', 'arm', 'eventLog'])

export function GamedayNextPage({ band, panels, stage, hero, engine, advance, pitch, onBoxScore, onScorecard, lineups, slateHref, notices = [], refresh }) {
  const tier = useTier()
  const [menu, setMenu] = useState(false)
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
  const [seen, setSeen] = useState({})
  if (rail && !seen[rail]) setSeen({ ...seen, [rail]: true })
  useEffect(() => {
    if (!rail) return undefined
    const onKey = (e) => e.key === 'Escape' && setRail(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rail])
  // A swipe is a mostly sideways drag of 48px or more that starts off the bar: toward the middle it
  // opens the rail on that side, toward its own edge it closes an open one.
  const swipe = useRef(null)
  const onPointerDown = (e) => { swipe.current = rails && !e.target.closest?.('.gdnext__bar') ? [e.clientX, e.clientY] : null }
  const onPointerUp = (e) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s[0], dy = e.clientY - s[1]
    if (Math.abs(dx) < 48 || Math.abs(dx) < 2 * Math.abs(dy)) return
    setRail((r) => (r ? ((r === 'left') === (dx < 0) ? null : r) : dx > 0 ? 'left' : 'right'))
  }
  // The drawer tiers swap the Reference block for the arm on the mound (the field is the drawer).
  const slots = blocksFor(tier).flatMap((b) => (b === 'band' || b === 'bar' || (drawer && b === 'eventLog') ? [] : drawer && b === 'reference' ? ['arm'] : [b]))
  return (
    <div className="gdnext" data-tier={tier} data-rails={rails || undefined} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {/* A delay or suspension, and a failed refresh, read as a strip under the band; the stage
          row gives up the room, so the frame still never scrolls. */}
      <div className="gdnext__band">
        {band}
        {notices.length > 0 && (
          <p className="gdnext__notice t-label t-label--bold" role="status">{notices.join(' · ')}</p>
        )}
      </div>
      {slots.map((b) => (
        <section key={b} className={`gdnext__slot gdnext__slot--${b}`} aria-label={BLOCK_LABEL[b]}>
          {b === 'stage' && stage ? stage : b === 'hero' && hero ? hero : (
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
        {/* aria-disabled, never `disabled`: a hold (the half closing, the step hold) must still
            take the tap that ends it early, and a disabled button gets no pointer events (ADR-0046). */}
        <Button skin="ink" className="gdnext__advance" aria-disabled={advance.disabled || undefined} onClick={() => !advance.disabled && advance.onClick()}>
          {advance.label} ›
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
          <Button size="control" className="gdnext__railtab gdnext__railtab--left" aria-expanded={rail === 'left'} aria-controls="gdnext-rail-left" onClick={() => setRail('left')}>Due up</Button>
          <Button size="control" className="gdnext__railtab gdnext__railtab--right" aria-expanded={rail === 'right'} aria-controls="gdnext-rail-right" onClick={() => setRail('right')}>Pitcher</Button>
          {rail && <button type="button" className="gdnext__scrim" aria-label="Close" onClick={() => setRail(null)} />}
          <aside id="gdnext-rail-left" className="gdnext__rail gdnext__rail--left" data-open={rail === 'left' || undefined} aria-label="Due up" inert={rail !== 'left'}>
            {seen.left && <div className="gdnext__slot gdnext__slot--battingOrder"><GamedayPanel block="battingOrder" ctx={panels} /></div>}
          </aside>
          <aside id="gdnext-rail-right" className="gdnext__rail gdnext__rail--right" data-open={rail === 'right' || undefined} aria-label="Now pitching" inert={rail !== 'right'}>
            {seen.right && <div className="gdnext__slot gdnext__slot--arm"><GamedayPanel block="arm" ctx={panels} /></div>}
          </aside>
        </>
      )}
      <div hidden>{engine}</div>
      {menu && (
        <GamedayMenu
          folded={rails ? menuFor(tier).filter((b) => b !== 'battingOrder') : menuFor(tier)}
          panels={panels}
          onClose={() => setMenu(false)}
          onBoxScore={onBoxScore}
          onScorecard={onScorecard}
          lineups={lineups}
          slateHref={slateHref}
          refresh={refresh}
        />
      )}
    </div>
  )
}
