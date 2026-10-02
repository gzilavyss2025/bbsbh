import { useMemo, useRef, useState } from 'react'
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
import { Button } from '../../components/ui/control/Button.jsx'
import { useStampUnseal } from '../../hooks/useStamps.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { PHONE_LENS_QUERY, lensOn } from '../../lib/scorecard/geometry.js'
import { LensBack, LensBar } from '../../components/scoring/lens/LensBar.jsx'
import { useLensBar } from '../../components/scoring/lens/useLensBar.js'
import { tapLocked } from '../../lib/scorecard/bar.js'
import { armWords, enteringDefense, frontierArmChange } from '../../lib/scorecard/arm.js'
import { halfLabel } from '../../lib/scorecard/situation.js'
import { ArmNotice, EnteringCard } from '../../components/scoring/lens/LensCards.jsx'
import { PitcherSheet } from '../../components/scoring/lens/PitcherSheet.jsx'

// The live scorecard — `/{date}/{matchup}/scorecard`, the Numbers Game "22"
// sheet filled exactly as far as YOU have revealed, at any point in the game.
// And not just filled: PLAYED. The next plate appearance sits face-down in
// its own grid cell (the kraft frontier seal); tapping it reveals one at-bat
// in place — the sheet's marks ink in, the out circle stamps — and when the
// half ends the turn hands to the other club's page of the book, on the
// sheet's own leads-off-next diagonal rather than a banner over it. Fog of
// war, uncovered box by box, in reading order.
//
// SPOILER FOOTING (the whole design):
//  • Every inked value comes from api/scorecardGame.js, whose builders clamp
//    to the `through` half-index this page passes — the same persisted
//    `revealedThrough` high-water mark the innings viewer ratchets
//    (useRevealProgress). A half you haven't revealed has no cards, no
//    P/WH/FO line and no scoreboard cell in the DOM; the FINAL block and
//    decisions wait for a fully-revealed Final game. ADR-0009's pattern,
//    same as the Pitchers table.
//  • The frontier tap advances the SAME marks the innings viewer's stepping
//    persists (revealAtBat's entry-count cursor, ADR-0016; revealTo's commit
//    when the half is done) — one ratchet, two surfaces, never a
//    double-reveal. Whole-half facts (P/WH/FO, the scoreboard cell, the
//    inning-end rule and its leads-off-next diagonal) ink on commit only,
//    exactly as the innings viewer holds its tally until a half commits.
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
  // THE THIRD OPENER (ADR-0048): the reader's own stamp on this game. A stamp is
  // minted only from inside a revealed box score of a FINAL game and records "I
  // was there", so re-sealing a game they stamped protects them from nothing.
  //
  // Read HERE rather than handed down beside `spoilersOff`, because the two are
  // different KINDS of fact. `spoilersOff` is a property of the DAY and needs
  // GameView's `officialDate` to resolve; a stamp is a property of this one
  // gamePk, which this screen already holds. Keeping them apart also keeps the
  // day-pass chrome honest — a stamped game must never make the banner announce
  // an unlocked day (see effectiveReveal, which takes them as two inputs).
  //
  // Why a latch rather than `isStamped` straight: useStampUnseal's own header.
  const stamped = useStampUnseal(feed?.gamePk)

  const { renderRevealedThrough, commitReveals } = effectiveReveal({
    scoresUnlocked: spoilersOff,
    stamped,
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
  // P/WH/FO, scoreboard cell and inning-end slash ink in — the turn-end
  // beat. A still-live half just parks the cursor at the feed's edge and
  // waits for Refresh to bring the next batter.
  const onFrontierTap = () => {
    // ASK `effectiveReveal`, do not re-derive the answer. `commitReveals` is
    // false under EVERY force-reveal source — the day pass (ADR-0026) and a
    // stamp (ADR-0048) today — for one reason that covers both: the sheet is
    // already inked to the end, so there is no frontier left to tap, and
    // committing would ratchet a mark the reader never earned by hand. Spelling
    // that list out again here meant a third source would have to remember to
    // update this line, which is the drift ADR-0026 asks each new source about.
    if (!stepInfo || !commitReveals) return
    setArmed(true)
    const { inning, half, total, nextCount, halfOver } = stepInfo
    if (nextCount >= total && halfOver) revealTo(inning, half)
    else revealAtBat(inning, half, nextCount)
  }

  // The turn handoff: the next at-bat belongs to the OTHER club's page of
  // the book. It rides the sheet, not a banner over it — the leads-off-next
  // diagonal of the half that JUST ended becomes the button that flips.
  // That's the mark your eye is already on when a half closes, so the "keep
  // going" affordance sits where the scoring does.
  //
  // Which diagonal: the half before `stepInfo`'s, which is on THIS side by
  // construction (halves alternate, and `needsFlip` says the next one isn't
  // ours). Naming the inning rather than "the newest" is what keeps every
  // OLDER diagonal plain notation. An inning of 0 (the bottom sheet before
  // top 1 has closed) matches no end mark, so nothing renders — and neither
  // does anything under the Scores Unlocked pass, where `stepInfo` is null.
  //
  // A half that died mid-count on the bases (an inning-ending caught
  // stealing) hands off too: its location is the empty box directly under the
  // carry-over "CS →" rather than the next-due batter's own, which that card
  // has already spent (see scorecardPlays' leadoffMarks). The button is on
  // the sheet either way; the Top/Bottom control above stays the manual way
  // over.
  // THE PHONE LENS (ADR-0092): on a phone, with a frontier to hold and taps that
  // commit, the sheet opens zoomed under a fixed frame over the next sealed box.
  // [Sheet] leaves it for this visit only (state, never stored); under Scores
  // Unlocked or a stamp there is no frontier, so the lens is off (G7).
  // In the lens, `side` follows the frontier (G20): entering the lens turns to
  // the frontier's page, the flip handoff turns it after that, and the manual
  // Top/Bottom control waits in the whole-sheet view.
  const phone = useMediaQuery(PHONE_LENS_QUERY)
  const [wholeSheet, setWholeSheet] = useState(false)
  const lens = lensOn({ phone, stepInfo, commitReveals }) ? (wholeSheet ? 'whole' : 'lens') : null
  const [lensWas, setLensWas] = useState(null)
  if (lensWas !== lens) {
    setLensWas(lens)
    if (lens === 'lens' && side !== stepInfo.side) setSide(stepInfo.side)
  }

  const needsFlip = stepInfo != null && stepInfo.side !== side
  const flip = needsFlip
    ? {
        inning: stepInfo.half === 'bottom' ? stepInfo.inning : stepInfo.inning - 1,
        label: `${stepInfo.half === 'top' ? 'Top' : 'Bottom'} ${stepInfo.inning}`,
        onFlip: () => setSide(stepInfo.side),
      }
    : null

  // THE BAR'S WORDS AND STATE (lib/scorecard/bar.js). "Loading" is only the
  // wait for a first feed: a poll or a Refresh keeps what is on screen, so the
  // bar does not flicker to a disabled button every minute.
  const inLens = lens === 'lens'
  const bar = useLensBar({
    on: inLens,
    view,
    side,
    stepInfo,
    flip,
    loading: loading && lastUpdated == null,
  })

  // THE ARM AT THE FRONTIER (lib/scorecard/arm.js has the timing rule). It
  // reads the feed, so it is caller-gated: it gets the REAL mark (G9). One card
  // docks under the frame: the new-pitcher notice while the arm is fresh, else
  // the Entering card until the half's first tap. Neither at a handoff, where
  // the frame is still on the old page, nor while loading.
  const arm = useMemo(
    () => (inLens ? frontierArmChange(feed, revealedThrough, stepInfo) : null),
    [inLens, feed, revealedThrough, stepInfo],
  )
  const [sheetArm, setSheetArm] = useState(null) // the arm the open pitcher sheet holds
  const docks = bar?.state === 'sealed' || bar?.state === 'edge'
  const dock = !docks ? null : arm?.fresh ? (
    <ArmNotice feed={feed} arm={arm} onOpen={() => setSheetArm(arm)} />
  ) : stepInfo.count === 0 ? (
    <EnteringCard
      title={`Entering ${halfLabel(stepInfo)}`}
      pitcherLine={armWords(arm).line}
      defense={enteringDefense(feed, revealedThrough, stepInfo.inning, stepInfo.half)}
    />
  ) : null

  // THE TAP LOCK (G6, ADR-0046). The seal, the bar's Unwrap and its Turn share
  // one 700 ms window after every reveal and every turn. The window is a
  // constant: it never reads what the tap did. While the cell editor or the
  // pitcher sheet is open, none of the three does anything.
  const lastTap = useRef(null)
  const locked = (fn) => () => {
    if (editing || sheetArm || tapLocked(Date.now(), lastTap.current)) return
    lastTap.current = Date.now()
    fn()
  }
  const tapFrontier = inLens ? locked(onFrontierTap) : onFrontierTap
  const turn = flip && (inLens ? { ...flip, onFlip: locked(flip.onFlip) } : flip)

  return (
    <div className={`scorecard-page ${lens === 'lens' ? 'scorecard-page--lens' : ''}`}>
      <div className="scpage__bar">
        {lens !== 'lens' && (
          <div className="scpage__ctl" role="group" aria-label="Half of inning">
            <Button size="control" pressed={side === 'top'} onClick={() => setSide('top')}>
              Top
            </Button>
            <Button size="control" pressed={side === 'bottom'} onClick={() => setSide('bottom')}>
              Bottom
            </Button>
          </div>
        )}
        <RefreshButton onReload={onReload} loading={loading} lastUpdated={lastUpdated} />
      </div>
      {lens !== 'lens' && (
        <p className="hint">
          The sheet inks only what you’ve revealed. Tap the sealed box to score
          the next at-bat right here, or a filled box to pencil over its
          notation.
        </p>
      )}

      <Scorecard
        side={side}
        view={view}
        notes={notes}
        onCellTap={(card) => setEditing(card)}
        onFrontierTap={tapFrontier}
        fresh={fresh}
        flip={turn}
        lens={lens}
        edge={bar?.state === 'edge'}
        lastOpened={bar?.lastOpened ?? null}
        dock={dock}
      />
      {bar && (
        <LensBar
          bar={bar}
          checkedAt={lastUpdated}
          refreshing={loading}
          onSheet={() => setWholeSheet(true)}
          onUnwrap={tapFrontier}
          onTurn={turn?.onFlip}
          onRefresh={onReload}
          pitcher={arm ? armWords(arm).surname : null}
          onPitcher={() => setSheetArm(arm)}
        />
      )}
      {inLens && sheetArm && <PitcherSheet feed={feed} arm={sheetArm} onClose={() => setSheetArm(null)} />}
      {lens === 'whole' && <LensBack onBack={() => setWholeSheet(false)} />}

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
