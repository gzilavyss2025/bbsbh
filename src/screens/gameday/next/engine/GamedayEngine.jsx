import { useEffect, useMemo } from 'react'
import { SealBox } from '../../../../components/SealBox.jsx'
import { EVENT_CODES } from '../../../../components/playbyplay/cardCopy.js'
import { composeLive, enteringPitchesFor } from '../../../../api/gameday/engine/engineLive.js'
import { halfReport } from '../../../../api/gameday/engine/halfReport.js'
import { computePitcherLines } from '../../../../api/pitchers.js'
import { halfIndex, selectHalfStartingPitcher } from '../../../../api/select.js'

// Gameday's engine (#2747): it draws nothing. It reports what the old half page reported up to
// InningViewer (the step cursor, runs and hits, the trail, the scorebug's live snapshot, the half
// commit), through the same callbacks. This is the ONLY engine seal: one SealBox, whose reveal
// function mounts EngineReport (src/CLAUDE.md).
//
// Parent: the entering baseline. It reads only spoiler-free selectors (the half's starter, the pitches
// he had thrown going in, the due-up batter), gated on `revealed || isNextToReveal` (ADR-0010).
// Child: everything that reads the half's plays, so halfReport runs only once the SealBox shows it
// (ADR-0001). A child's effects run before its parent's in one commit, so once stepping starts the
// live report wins over the baseline; the parent also stops reporting then.
//
// Props: `inning`/`half` are the half on screen, `idx` its index (the tag InningViewer's reports need),
// `stepCount` the stored count already moved to the sub-step (engineCountFor), `windowed`/`focusStep` the
// focus view, `halfInProgress` ADR-0055. `commitReveal(inning, half)` ratchets the mark.
export function GamedayEngine({ feed, inning, half, idx, revealedThrough, stepCount, halfInProgress, windowed, focusStep, commitReveal, reportStepInfo, reportRunsSoFar, reportLiveState, reportSteps }) {
  const battingSide = half === 'top' ? 'away' : 'home'
  const revealed = idx <= revealedThrough
  const isNextToReveal = idx === revealedThrough + 1
  const hasContent = revealed || isNextToReveal
  const stepping = !revealed && stepCount > 0
  const startedRevealing = revealed || stepCount > 0

  const nowPitching = selectHalfStartingPitcher(feed, inning, half, revealedThrough)
  const enteringPitchLines = useMemo(() => computePitcherLines(feed, halfIndex(inning, half) - 1), [feed, inning, half])
  const enteringPitches = enteringPitchesFor(enteringPitchLines, nowPitching)
  const base = { feed, inning, half, battingSide, revealedThrough, windowed, nowPitching, enteringPitches }

  useEffect(() => {
    if (startedRevealing) return
    reportLiveState(idx, hasContent ? composeLive(null, base) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedRevealing, hasContent, feed, inning, half, revealedThrough, nowPitching, enteringPitches, battingSide])

  // `hidden`: an open SealBox draws its own `.statgrid` div, which would be a grid row of the shell.
  return (
    <div hidden>
      <SealBox forceRevealed={startedRevealing} coverless>
        {() => (
          <EngineReport
            {...{ feed, inning, half, idx, battingSide, base, halfInProgress, windowed, focusStep, commitReveal, reportStepInfo, reportRunsSoFar, reportLiveState, reportSteps }}
            stepCap={stepping ? stepCount : null}
          />
        )}
      </SealBox>
    </div>
  )
}

// Reveal-only: rendered only from the SealBox's reveal function above.
function EngineReport({ feed, inning, half, idx, battingSide, base, stepCap, halfInProgress, windowed, focusStep, commitReveal, reportStepInfo, reportRunsSoFar, reportLiveState, reportSteps }) {
  const stepping = stepCap != null
  // Memoized on the INPUTS, all values: `entries` is rebuilt whenever one changes and is never a
  // dependency (a fresh array each render looped 264 renders per tap).
  const {
    entries, effectiveCap, exhausted, nextCap, isLastStep, lastAtBatIndex, atHalfEdge,
    runs: runsSoFar, hits: hitsSoFar, steps: revealedSteps, items: trailItems, liveCap, live,
  } = useMemo(
    () => halfReport(feed, inning, half, battingSide, stepCap, { halfInProgress, windowed, focusStep, codeOf: (t) => EVENT_CODES[t] }),
    [feed, inning, half, battingSide, stepCap, halfInProgress, windowed, focusStep],
  )
  const snapshot = composeLive(live, base)

  // The step cursor, or the half's commit once stepping runs out (once per half, ADR-0016).
  useEffect(() => {
    if (!stepping || entries.length === 0) return
    if (exhausted) commitReveal(inning, half)
    else reportStepInfo(idx, { nextCap, isLastStep, lastAtBatIndex, atHalfEdge })
  }, [stepping, exhausted, effectiveCap, entries.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // The trail's chips (useFocusMode). `feed` rides along: a Refresh can rewrite an entry under an unchanged count.
  useEffect(() => {
    reportSteps(revealedSteps, trailItems)
  }, [revealedSteps, feed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Runs and hits so far in the stepped-through part of the half. Counts, never `entries`.
  useEffect(() => {
    if (!stepping) return
    reportRunsSoFar(idx, runsSoFar, hitsSoFar)
  }, [stepping, runsSoFar, hitsSoFar]) // eslint-disable-line react-hooks/exhaustive-deps

  // The scorebug's snapshot, not gated on `stepping` (a committed half needs its final one).
  useEffect(() => {
    reportLiveState(idx, snapshot)
  }, [feed, inning, half, battingSide, effectiveCap, liveCap]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
