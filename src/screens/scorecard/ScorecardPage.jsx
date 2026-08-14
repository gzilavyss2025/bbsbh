import { useMemo, useState } from 'react'
import { useRevealProgress } from '../../hooks/useRevealProgress.js'
import { effectiveReveal } from '../../hooks/revealProgressCore.js'
import { useScorecardNotes } from '../../hooks/useScorecardNotes.js'
import {
  selectInningCount,
  selectRegulationInnings,
} from '../../api/select.js'
import { scorecardFull } from '../../api/scorecardGame.js'
import { Scorecard } from '../Scorecard.jsx'
import { ScorecardCellEditor } from '../../components/scoring/ScorecardCellEditor.jsx'
import { RefreshButton } from '../TeamInfo.jsx'

// The live scorecard — `/{date}/{matchup}/scorecard`, the Numbers Game "22"
// sheet filled exactly as far as YOU have revealed, at any point in the game.
//
// SPOILER FOOTING (the whole design):
//  • Every inked value comes from api/scorecardGame.js, whose builders clamp
//    to the `through` half-index this page passes — the same persisted
//    `revealedThrough` high-water mark the innings viewer ratchets
//    (useRevealProgress). A half you haven't revealed has no cards, no
//    P/TP/LOB line and no scoreboard cell in the DOM; the FINAL block and
//    decisions wait for a fully-revealed Final game. ADR-0009's pattern,
//    same as the Pitchers table.
//  • This page READS the mark and never advances it — there is no SealBox
//    here and no revealTo call, so browsing the sheet can't ratchet anything.
//  • Under the Scores Unlocked pass / a consented day (ADR-0026), GameView
//    hands down `spoilersOff` and the RENDER clamp substitutes the game's
//    last half, exactly as the innings viewer substitutes its render mark —
//    the persisted mark stays untouched.
//  • Extras never spoil (ADR-0008): the clamp also decides how many inning
//    columns exist, so a marathon reveals its columns one at a time.
//
// The sheet is EDITABLE: tapping a filled box opens the notation editor and
// the override is stored per-cell on this device (lib/scorecardNotes.js) —
// the pencil-over-ink layer, never a change to anything derived.
export function ScorecardPage({ feed, managers, uniformBrief, spoilersOff, onReload, loading, lastUpdated }) {
  const [side, setSide] = useState('top')
  const regulation = selectRegulationInnings(feed)
  const actualCount = selectInningCount(feed)
  const { revealedThrough, unlocked } = useRevealProgress(feed, regulation, actualCount)
  const { renderRevealedThrough } = effectiveReveal({
    scoresUnlocked: spoilersOff,
    revealedThrough,
    unlocked,
    actualCount,
  })

  const { notes, setCell, clearCell } = useScorecardNotes(feed?.gamePk)
  const [editing, setEditing] = useState(null) // the tapped cell's card

  const view = useMemo(
    () =>
      scorecardFull({ feed, managers, uniformBrief }, side, {
        through: renderRevealedThrough,
      }),
    [feed, managers, uniformBrief, side, renderRevealedThrough],
  )

  return (
    <div className="scorecard-page">
      <div className="scpage__bar">
        <div className="scpage__ctl" role="group" aria-label="Half of inning">
          <button
            type="button"
            className={`btn ${side === 'top' ? '' : 'btn--ghost'}`}
            aria-pressed={side === 'top'}
            onClick={() => setSide('top')}
          >
            Top
          </button>
          <button
            type="button"
            className={`btn ${side === 'bottom' ? '' : 'btn--ghost'}`}
            aria-pressed={side === 'bottom'}
            onClick={() => setSide('bottom')}
          >
            Bottom
          </button>
        </div>
        <RefreshButton onReload={onReload} loading={loading} lastUpdated={lastUpdated} />
      </div>
      <p className="hint">
        The sheet inks only what you’ve revealed in the innings view. Tap a
        filled box to pencil over its notation.
      </p>

      <Scorecard
        side={side}
        view={view}
        notes={notes}
        onCellTap={(card) => setEditing(card)}
      />

      {editing && (
        <ScorecardCellEditor
          card={editing}
          note={notes.cells?.[String(editing.atBatIndex)] ?? null}
          onSave={(patch) => setCell(editing.atBatIndex, patch)}
          onClear={() => clearCell(editing.atBatIndex)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
