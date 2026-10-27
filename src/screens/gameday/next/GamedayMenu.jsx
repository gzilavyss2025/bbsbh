import '../../../styles/lineup-next/sheet.css'
import { SheetFrame } from '../../lineup/next/sheets/SheetFrame.jsx'
import { GamedayPanel } from './panels/GamedayPanels.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'

// The block names a reader sees (the menu and the empty slots).
export const BLOCK_LABEL = {
  navigator: 'Line score', trail: 'Trail', pitches: 'Pitches', battingOrder: 'Batting order',
  reference: 'Reference', eventLog: 'Event log', stage: 'Stage', hero: 'At-bat',
}

// The menu sheet: the blocks this tier folds (names only until their prompts build them), then
// the pages that leave Gameday. Opening it loads nothing: a folded block fetches when it shows.
export function GamedayMenu({ folded, panels, onClose, onBoxScore, onScorecard, refresh }) {
  return (
    <SheetFrame title="Menu" onClose={onClose}>
      <ul className="gdnext__folded">
        {folded.map((b) => <li key={b}>{BLOCK_LABEL[b]}<GamedayPanel block={b} ctx={panels} /></li>)}
      </ul>
      <Door onClick={onScorecard}>Scorecard</Door>
      <Door onClick={onBoxScore}>Box score</Door>
      {refresh}
    </SheetFrame>
  )
}
