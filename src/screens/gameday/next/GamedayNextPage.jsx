import { useState } from 'react'
import '../../../styles/gameday-next/page.css'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'
import { blocksFor, foldedFor } from '../../../lib/gameday/ladder.js'
import { BLOCK_LABEL, GamedayMenu } from './GamedayMenu.jsx'
import { GamedayPanel } from './panels/GamedayPanels.jsx'
import { useTier } from './useTier.js'

// Gameday's new shell (#2568 slices 2, 3), behind `?look=new`: a fixed no-scroll frame whose
// blocks the window's tier places (lib/gameday/ladder.js). The band and the bar are real; the
// stage, hero and panels are labelled slots the next prompts fill (docs/gameday-build.md).
// `engine` is today's half page, mounted hidden so the reveal flow, the live snapshot and the
// step cursor keep running until those slots take over.
// Blocks a panel fills; the rest keep their label until their prompts.
const PANELLED = new Set(['navigator', 'trail', 'pitches', 'battingOrder', 'reference', 'eventLog'])

export function GamedayNextPage({ band, panels, stage, hero, engine, advance, onBoxScore, onScorecard, refresh }) {
  const tier = useTier()
  const [menu, setMenu] = useState(false)
  const slots = blocksFor(tier).filter((b) => b !== 'band' && b !== 'bar')
  return (
    <div className="gdnext" data-tier={tier}>
      <div className="gdnext__band">{band}</div>
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
        {/* ponytail: static until the pitch mode lands (prompt 11) */}
        <div className="gdnext__switch" role="group" aria-label="Step by">
          <Button size="control" pressed>At-bat</Button>
          <Button size="control" pressed={false} disabled>Pitch</Button>
        </div>
        <Button skin="ink" className="gdnext__advance" disabled={advance.disabled} onClick={advance.onClick}>
          {advance.label} ›
        </Button>
      </div>
      <div hidden>{engine}</div>
      {menu && (
        <GamedayMenu
          folded={foldedFor(tier)}
          panels={panels}
          onClose={() => setMenu(false)}
          onBoxScore={onBoxScore}
          onScorecard={onScorecard}
          refresh={refresh}
        />
      )}
    </div>
  )
}
