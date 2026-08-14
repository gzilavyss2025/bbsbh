import { useMemo, useState } from 'react'
import { scorecardFull } from '../../api/scorecardGame.js'
import { useScorecardNotes } from '../../hooks/useScorecardNotes.js'
import { Scorecard } from '../Scorecard.jsx'
import { ScorecardCellEditor } from '../../components/scoring/ScorecardCellEditor.jsx'
import { SectionMasthead } from '../../components/ui/SectionMasthead.jsx'

// The completed scorecard at the foot of the box score: the whole game's
// notations on the #22 sheet — every plate appearance boxed, the P/TP/LOB
// row, the pitcher lines, the scoreboard with its FINAL block and decisions —
// with a Top/Bottom toggle for the two halves of the book.
//
// SPOILER FOOTING: this component is mounted ONLY from inside the box
// score's single SealBox reveal render (BoxScoreBody), which is the same
// gate every other score on that page sits behind (ADR-0001/0002). That is
// why `through: Infinity` is safe here — the whole game is already revealed
// on this surface, so the clamp has nothing left to hold back. Do not mount
// this anywhere else; the live, clamped sheet is ScorecardPage.
//
// The sheet stays EDITABLE here, deliberately: the end of the game is
// exactly when a scorer squares their book against the official account, so
// tapping a box opens the same notation editor the live page uses, writing
// to the same per-game store (lib/scorecardNotes.js).
export function BoxScorecard({ feed, managers, uniforms }) {
  const [side, setSide] = useState('top')
  const { notes, setCell, clearCell } = useScorecardNotes(feed?.gamePk)
  const [editing, setEditing] = useState(null)

  const view = useMemo(
    () =>
      scorecardFull({ feed, managers, uniformBrief: uniforms }, side, {
        through: Infinity,
      }),
    [feed, managers, uniforms, side],
  )

  if (!view) return null

  return (
    <section className="bs__section bs__scorecard">
      <SectionMasthead as="h3" title="Scorecard" />
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
      </div>
      <p className="hint">
        The whole game’s notations on the #22 sheet. Tap any box to pencil
        your own call over it — your marks stay on this device.
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
    </section>
  )
}
