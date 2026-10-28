import '../../../styles/lineup-next/sheet.css'
import { SheetFrame } from '../../lineup/next/sheets/SheetFrame.jsx'
import { GamedayPanel } from './panels/GamedayPanels.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'

// The block names a reader sees (the menu and the empty slots).
export const BLOCK_LABEL = {
  navigator: 'Line score', trail: 'Trail', battingOrder: 'Batting order',
  reference: 'Reference', arm: 'On the mound', eventLog: 'Event log', stage: 'Stage', hero: 'At-bat',
  pitchingLines: 'Pitching lines',
}

// The menu sheet: the blocks this tier folds (names only until their prompts build them), then
// the pages that leave Gameday: both lineups and the box score (the page is a fixed frame, so these
// are its way out; Gary dropped the scorecard and the slate, 2026-10-28). Opening it loads nothing: a
// folded block fetches when it shows.
// Blocks that read as themselves in the Menu, with no heading over them (Gary, 2026-10-28).
const UNTITLED = new Set(['navigator', 'trail', 'reference', 'eventLog'])

export function GamedayMenu({ folded, panels, onClose, onBoxScore, lineups, refresh }) {
  return (
    <SheetFrame title="Menu" onClose={onClose}>
      <ul className="gdnext__folded">
        {folded.map((b) => <li key={b}>{!UNTITLED.has(b) && BLOCK_LABEL[b]}<GamedayPanel block={b} ctx={panels} /></li>)}
        {/* Every tier: the scorebook's pitching page, copied from here mid-game (Gary, 2026-10-28). */}
        <li><GamedayPanel block="pitchingLines" ctx={panels} /></li>
      </ul>
      {/* The ways out, one row of short boxed doors (Gary, 2026-10-28): a club's abbreviation is its lineup. */}
      <nav className="gdnext__exits" aria-label="Leave Gameday">
        <Door layout="block" className="gdnext__exit" aria-label={`${lineups.away} lineup`} onClick={() => lineups.onLineup('away')}>{lineups.away}</Door>
        <Door layout="block" className="gdnext__exit" aria-label={`${lineups.home} lineup`} onClick={() => lineups.onLineup('home')}>{lineups.home}</Door>
        <Door layout="block" className="gdnext__exit" onClick={onBoxScore}>Box score</Door>
      </nav>
      {refresh}
    </SheetFrame>
  )
}
