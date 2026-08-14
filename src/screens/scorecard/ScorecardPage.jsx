import { useMemo, useState } from 'react'
import { useRevealProgress } from '../../hooks/useRevealProgress.js'
import { effectiveReveal } from '../../hooks/revealProgressCore.js'
import { useScorecardNotes } from '../../hooks/useScorecardNotes.js'
import {
  selectInningCount,
  selectRegulationInnings,
} from '../../api/select.js'
import { scorecardFull, scorecardStep } from '../../api/scorecardGame.js'
import { Scorecard } from '../Scorecard.jsx'
import { ScorecardCellEditor } from '../../components/scoring/ScorecardCellEditor.jsx'
import { RefreshButton } from '../TeamInfo.jsx'

// The live scorecard — `/{date}/{matchup}/scorecard`, the Numbers Game "22"
// sheet filled exactly as far as YOU have revealed, at any point in the game.
// And not just filled: PLAYED. The next plate appearance sits face-down in
// its own grid cell (the kraft frontier seal); tapping it reveals one at-bat
// in place — the sheet's marks ink in, the out circle stamps — and when the
// half ends the turn hands to the other club's page of the book (the flip
// chip). Fog of war, uncovered box by box, in reading order.
//
// SPOILER FOOTING (the whole design):
//  • Every inked value comes from api/scorecardGame.js, whose builders clamp
//    to the `through` half-index this page passes — the same persisted
//    `revealedThrough` high-water mark the innings viewer ratchets
//    (useRevealProgress). A half you haven't revealed has no cards, no
//    P/TP/LOB line and no scoreboard cell in the DOM; the FINAL block and
//    decisions wait for a fully-revealed Final game. ADR-0009's pattern,
//    same as the Pitchers table.
//  • The frontier tap advances the SAME marks the innings viewer's stepping
//    persists (revealAtBat's entry-count cursor, ADR-0016; revealTo's commit
//    when the half is done) — one ratchet, two surfaces, never a
//    double-reveal. Whole-half facts (P/TP/LOB, the scoreboard cell, the
//    inning-end diagonal) ink on commit only, exactly as the innings viewer
//    holds its tally until a half commits.
//  • Under the Scores Unlocked pass / a consented day (ADR-0026), GameView
//    hands down `spoilersOff` and the RENDER clamp substitutes the game's
//    last half; there is nothing left to step, so the frontier seal
//    disappears and nothing this page renders can commit a reveal
//    (revealProgressCore's commitReveals contract).
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
  const { revealedThrough, revealTo, revealAtBat, atBatCountFor, unlocked } = useRevealProgress(
    feed,
    regulation,
    actualCount,
  )
  const { renderRevealedThrough } = effectiveReveal({
    scoresUnlocked: spoilersOff,
    revealedThrough,
    unlocked,
    actualCount,
  })

  const { notes, setCell, clearCell } = useScorecardNotes(feed?.gamePk)
  const [editing, setEditing] = useState(null) // the tapped cell's card

  // The reveal frontier. Under the pass renderRevealedThrough already covers
  // the whole game, so this resolves null and the seal never renders — which
  // is also what keeps this page from committing anything while spoilers are
  // off (commitReveals, ADR-0026).
  const stepInfo = useMemo(
    () => scorecardStep(feed, renderRevealedThrough, atBatCountFor),
    [feed, renderRevealedThrough, atBatCountFor],
  )

  const view = useMemo(
    () =>
      scorecardFull({ feed, managers, uniformBrief }, side, {
        through: renderRevealedThrough,
        step:
          stepInfo != null
            ? { halfIdx: renderRevealedThrough + 1, count: stepInfo.count }
            : null,
      }),
    [feed, managers, uniformBrief, side, renderRevealedThrough, stepInfo],
  )

  // The ink-in set: cards that appeared since the previous render of this
  // SAME side's grid, marked fresh so their pencil marks play the ink-in
  // press — but only once the reader has actually tapped (`armed`), so a
  // cold load renders settled ink, and only diffed against the same side, so
  // flipping the sheet never animates a page of reveals that happened long
  // ago. State adjusted during render (React's documented escape hatch, the
  // same shape GameView's lastInningSection uses): the render-phase set
  // re-renders before commit, so the committed DOM carries the fresh class
  // from its first frame and the animation runs exactly once.
  const [armed, setArmed] = useState(false)
  const gridIds = useMemo(() => {
    const ids = new Set()
    for (const slot of view?.grid?.slots ?? []) {
      for (const card of Object.values(slot.cells)) {
        if (card.atBatIndex != null) ids.add(card.atBatIndex)
      }
    }
    return ids
  }, [view])
  const [inkState, setInkState] = useState({ side: null, ids: null, fresh: null })
  if (inkState.ids !== gridIds || inkState.side !== side) {
    setInkState({
      side,
      ids: gridIds,
      fresh:
        armed && inkState.ids != null && inkState.side === side
          ? new Set([...gridIds].filter((id) => !inkState.ids.has(id)))
          : null,
    })
  }
  const fresh = inkState.ids === gridIds ? inkState.fresh : null

  // One tap = one plate appearance (plus its trailing notes), through the
  // same cursor the innings viewer steps; the last step of a FINISHED half
  // collapses into the ordinary whole-half commit, which is when the half's
  // P/TP/LOB, scoreboard cell and inning-end slash ink in — the turn-end
  // beat. A still-live half just parks the cursor at the feed's edge and
  // waits for Refresh to bring the next batter.
  const onFrontierTap = () => {
    if (!stepInfo || spoilersOff) return
    setArmed(true)
    const { inning, half, total, nextCount, halfOver } = stepInfo
    if (nextCount >= total && halfOver) revealTo(inning, half)
    else revealAtBat(inning, half, nextCount)
  }

  // The turn handoff: the next at-bat belongs to the OTHER club's page of
  // the book. Say so, and make the chip the flip.
  const needsFlip = stepInfo != null && stepInfo.side !== side
  const flipLabel = needsFlip
    ? `${stepInfo.half === 'top' ? 'Top' : 'Bottom'} ${stepInfo.inning} is next — flip the sheet`
    : null

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
        The sheet inks only what you’ve revealed. Tap the sealed box to score
        the next at-bat right here, or a filled box to pencil over its
        notation.
      </p>

      {needsFlip && (
        <button type="button" className="scflip" onClick={() => setSide(stepInfo.side)}>
          {flipLabel} <span aria-hidden="true">›</span>
        </button>
      )}

      <Scorecard
        side={side}
        view={view}
        notes={notes}
        onCellTap={(card) => setEditing(card)}
        onFrontierTap={onFrontierTap}
        fresh={fresh}
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
