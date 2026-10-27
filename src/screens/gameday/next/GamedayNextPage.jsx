import { useState } from 'react'
import '../../../styles/gameday-next/page.css'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'
import { blocksFor, foldedFor } from '../../../lib/gameday/ladder.js'
import { BLOCK_LABEL, GamedayMenu } from './GamedayMenu.jsx'
import { GamedayPanel } from './panels/GamedayPanels.jsx'
import { useTier } from './useTier.js'

// The Gameday page (ADR-0043's 2026-10-27 amendment): a fixed no-scroll frame whose blocks the
// window's tier places (lib/gameday/ladder.js). `engine` is the old half page, mounted hidden so
// the reveal flow, the live snapshot and the step cursor keep running.
// Blocks a panel fills; a stage or hero slot with nothing to draw yet shows its name.
const PANELLED = new Set(['navigator', 'trail', 'pitches', 'battingOrder', 'reference', 'eventLog'])

export function GamedayNextPage({ band, panels, stage, checkpoint, hero, engine, advance, pitch, onBoxScore, onScorecard, lineups, slateHref, notices = [], refresh }) {
  const tier = useTier()
  const [menu, setMenu] = useState(false)
  const slots = blocksFor(tier).filter((b) => b !== 'band' && b !== 'bar')
  return (
    <div className="gdnext" data-tier={tier}>
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
          {b === 'stage' && (checkpoint || stage) ? checkpoint || stage : b === 'hero' && hero ? hero : (
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
        {/* aria-disabled, never `disabled`: a hold (the half closing, the step hold) must still
            take the tap that ends it early, and a disabled button gets no pointer events (ADR-0046). */}
        <Button skin="ink" className="gdnext__advance" aria-disabled={advance.disabled || undefined} onClick={() => !advance.disabled && advance.onClick()}>
          {advance.label} ›
        </Button>
        {/* The live edge, said once and politely (ADR-0055). Always mounted so the change is read. */}
        <p className="sr-only" role="status" aria-live="polite">{advance.caughtUp ? 'Caught up — waiting on the next batter' : ''}</p>
      </div>
      <div hidden>{engine}</div>
      {menu && (
        <GamedayMenu
          folded={foldedFor(tier)}
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
