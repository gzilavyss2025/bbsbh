import { useRef } from 'react'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { METRICS } from '../../lib/scout/metrics.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Choice } from '../../components/scout/Choice.jsx'

// THE SCOUT'S FILTER SHEET (#1490): Hand, Scope and Metric in one bottom sheet,
// opened from the chip under the matchup. They used to sit in two rows, above
// and below the maps. Each tap applies at once and rewrites the address, the
// same as every other choice on the page; Done only closes the sheet.
//
// View is not here: it changes the scene first, so it sits on the scene's
// bar. A switch hitter's "All" hands stays off (Gary, item 1): his two
// stances are two maps.
export const HANDS = [[null, 'All'], ['R', 'vs R'], ['L', 'vs L']]
export const SCOPES = [['reg', 'Regular'], ['post', 'Postseason'], ['all', 'All']]
const HAND_CHIP = { R: 'vs RHP', L: 'vs LHP' }
const SCOPE_CHIP = { reg: 'Regular', post: 'Postseason', all: 'All games' }

// The chip's label: the current choices, summed up.
export const filterSummary = ({ hand, scope, metric, showHitter }) =>
  [showHitter ? HAND_CHIP[hand] ?? 'Both hands' : null, SCOPE_CHIP[scope], showHitter ? METRICS[metric].label : null]
    .filter(Boolean)
    .join(' · ')

export function FilterSheet({ onClose, showHitter, hand, onHand, switchHitter, scope, onScope, metric, metrics, onMetric }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  return (
    <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet scout__sheet" role="dialog" aria-modal="true" aria-label="Filters">
        <h2 className="sheet__title">Filters</h2>
        <div className="scout__controls">
          {showHitter && (
            <Choice label="Hand" options={HANDS} value={hand} onChange={onHand} disabledKey={switchHitter ? null : undefined} />
          )}
          <Choice label="Scope" options={SCOPES} value={scope} onChange={onScope} />
          {showHitter && (
            <Choice label="Metric" options={metrics.map((k) => [k, METRICS[k].label])} value={metric} onChange={onMetric} />
          )}
        </div>
        <div className="sheet__actions">
          <Button ref={closeRef} skin="ink" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
