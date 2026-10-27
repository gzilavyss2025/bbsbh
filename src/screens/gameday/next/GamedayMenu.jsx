import '../../../styles/lineup-next/sheet.css'
import { SheetFrame } from '../../lineup/next/sheets/SheetFrame.jsx'
import { GamedayPanel } from './panels/GamedayPanels.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'
import { useRouteLink } from '../../../lib/nav.js'

// The block names a reader sees (the menu and the empty slots).
export const BLOCK_LABEL = {
  navigator: 'Line score', trail: 'Trail', pitches: 'Pitches', battingOrder: 'Batting order',
  reference: 'Reference', arm: 'On the mound', eventLog: 'Event log', stage: 'Stage', hero: 'At-bat',
}

// The menu sheet: the blocks this tier folds (names only until their prompts build them), then
// the pages that leave Gameday: both lineups, the scorecard, the box score and the slate for the
// game's date (the page is a fixed frame, so these are its way out). Opening it loads nothing: a
// folded block fetches when it shows.
export function GamedayMenu({ folded, panels, onClose, onBoxScore, onScorecard, lineups, slateHref, refresh }) {
  const link = useRouteLink()
  return (
    <SheetFrame title="Menu" onClose={onClose}>
      <ul className="gdnext__folded">
        {folded.map((b) => <li key={b}>{BLOCK_LABEL[b]}<GamedayPanel block={b} ctx={panels} /></li>)}
      </ul>
      <Door onClick={() => lineups.onLineup('away')}>{lineups.away} lineup</Door>
      <Door onClick={() => lineups.onLineup('home')}>{lineups.home} lineup</Door>
      <Door onClick={onScorecard}>Scorecard</Door>
      <Door onClick={onBoxScore}>Box score</Door>
      <Door {...link(slateHref)}>Slate</Door>
      {refresh}
    </SheetFrame>
  )
}
