import { useRef } from 'react'
import { Button } from '../../ui/control/Button.jsx'
import { PitcherCard } from '../../playbyplay/pitcherCard/PitcherCard.jsx'
import { useDialogFocus } from '../../../hooks/dialog/useDialogFocus.js'

// The lens's pitcher sheet (#724, ADR-0092): the full pitcher card, from the
// new-pitcher notice or the bar's "Pitching · Name ›". The app's own bottom
// sheet (.scrim/.sheet), from 92px under the window's top, with a fixed navy
// "Back to the box" at its foot.
//
// It holds PitcherCard as it is, and mounts only when the sheet opens: the
// card fetches its season line, last game and arsenal itself. Its label and
// `relief` are the innings viewer's rules (HalfInning.jsx), carried on `arm`
// (lib/scorecard/arm.js): "Now pitching" only for the fresh arm at his first
// batter. While it is open, the page's seal, Unwrap and Turn do nothing.
//
// Not portalled (ModalPortal): the scorecard page has no isolating parent,
// and a portal to <body> would leave #root's all-caps rule behind.
export function PitcherSheet({ feed, arm, onClose }) {
  const backRef = useRef(null)
  useDialogFocus(backRef, onClose)
  const { pitcher, team, relief, fresh } = arm
  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet sc-pitchsheet" role="dialog" aria-modal="true" aria-label="Pitcher card">
        <div className="sc-pitchsheet__body">
          <PitcherCard
            feed={feed}
            relief={relief}
            pitcher={pitcher}
            teamId={team.id}
            teamName={team.name}
            className="pitchernotice--pbp"
            label={fresh ? 'Now pitching' : 'Pitching'}
          />
        </div>
        <div className="sc-pitchsheet__foot">
          <Button ref={backRef} skin="ink" onClick={onClose}>
            Back to the box
          </Button>
        </div>
      </div>
    </div>
  )
}
