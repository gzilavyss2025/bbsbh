import { useCallback, useMemo, useState } from 'react'
import { EntryChooser } from './EntryChooser.jsx'
import { FilmPane } from './FilmPane.jsx'
import { ScoringDeck } from './ScoringDeck.jsx'
import { PitchExpand } from './PitchExpand.jsx'
import { useExpressLane } from '../../hooks/useExpressLane.js'
import { useRevealProgress } from '../../hooks/useRevealProgress.js'
import { selectInningCount, selectRegulationInnings, selectTeamMeta } from '../../api/select.js'

// EXPRESS LANE — CONCEPT A, THE SPLIT DECK.
//
// Film across the top, the scoring deck beneath it, the foot strip of plate-
// appearance chips under that, and the primary action at the very foot where
// a thumb reaches it. iPhone portrait is the case this layout has to earn, so
// it is the one it is written for; iPad widens into two columns (Concept B,
// which survives as the tablet layout) and desktop simply takes the tablet
// shape with more air. Nothing scales one layout up.
//
// The band order is the scorer's order, top to bottom: watch it, write it,
// move on. The deck sits between the film and the thumb because that is what
// the eye does between the two.
//
// WHAT THIS PAGE DOES NOT DO is as load-bearing as what it does:
//   · it never draws a game-wide count or bar of any kind (ADR-0008),
//   · it never draws a determinate wait (ADR-0046),
//   · it never draws a poster as a placeholder — the scorebug is in the
//     pixels,
//   · and it never lets the cursor past the film. The gate lives in
//     lib/expresslane/staging.js and is enforced in the runner, not here; this
//     page only reads what it says and greys the button.
//
// The reveal is ATOMIC. The deck is capped at the cursor, so the play and its
// film arrive together or not at all — a scorer who could read "grounds out,
// second baseman to first" would have no reason to wait for the picture, and
// the gate would be decoration.

function halfLabel(inning, half) {
  const ordinal =
    inning === 1 ? '1st' : inning === 2 ? '2nd' : inning === 3 ? '3rd' : `${inning}th`
  return `${half === 'bottom' ? 'Bottom' : 'Top'} ${ordinal}`
}

export function ExpressLanePage({ feed, gamePk, onLeave }) {
  const [booth, setBooth] = useState('home')
  const [started, setStarted] = useState(false)
  const [expanded, setExpanded] = useState(null)

  // The app's own reveal mark, read and driven from here. Express Lane is not
  // a second scoring frontier beside the innings viewer's — it is the same
  // one, walked a different way, so a game scored here opens where it was left
  // in the innings viewer and on every other device (reveal.js, ADR-0022).
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])
  const { revealedThrough, revealTo, revealAtBat } = useRevealProgress(
    feed,
    regulation,
    actualCount,
  )

  // Open on the first half the scorer has NOT finished — the sanctioned
  // `revealedThrough + 1` (ADR-0003/0010). Extras are reached one at a time by
  // the same walk, so nothing here has to know whether the game went long.
  const [startHalfIdx] = useState(() => revealedThrough + 1)

  // Advancing IS the reveal act. Within a half it ratchets the at-bat mark;
  // finishing one ratchets the half mark, which is what unlocks the next.
  const onReveal = useCallback(
    (halfIdx, reached, halfDone) => {
      revealAtBat(halfIdx, reached)
      if (halfDone) revealTo(halfIdx)
    },
    [revealAtBat, revealTo],
  )

  const lane = useExpressLane({
    feed,
    gamePk,
    mode: 'result',
    booth,
    startHalfIdx,
    onReveal,
  })

  // Club identity, off the spoiler-free selector every lineup page already
  // uses. A club's name is not a score.
  const names = useMemo(
    () => ({
      away: selectTeamMeta(feed, 'away')?.name ?? 'Visitors',
      home: selectTeamMeta(feed, 'home')?.name ?? 'Home',
    }),
    [feed],
  )

  if (!started) {
    return (
      <div className="xl">
        <EntryChooser
          awayName={names.away}
          homeName={names.home}
          booth={booth}
          onBooth={setBooth}
          onStart={() => setStarted(true)}
        />
      </div>
    )
  }

  // The pre-roll. It is a wait with nothing to show yet, so it says so and
  // shows no measure of itself — the same indeterminate rule the in-game wait
  // follows, for the same reason.
  if (!lane.preroll.ready && !lane.cursorRow) {
    return (
      <div className="xl">
        <div className="xl__preroll">
          <span className="xl__prerollmark" aria-hidden="true" />
          <p className="xl__prerollmsg">Getting the first few plays.</p>
          <p className="xl__prerollsub">
            The film arrives about as fast as MLB will send it, which is slower than it sounds.
          </p>
        </div>
      </div>
    )
  }

  const gate = lane.gate
  const waiting = Boolean(gate?.blocked) && !lane.job.blockedReason
  const canAdvance = Boolean(lane.nextRow) && !gate?.blocked

  return (
    <div className="xl">
      <header className="xl__bar">
        <button type="button" className="xl__back" onClick={onLeave}>
          Leave
        </button>
        {/* The half and the outs. No score, no plate-appearance count, no
            position in the game — position within the current half is all any
            indicator on this surface may show. */}
        <span className="xl__half">{halfLabel(lane.inning, lane.half)}</span>
        <span className="xl__booth">{booth === 'home' ? names.home : names.away}</span>
      </header>

      <FilmPane
        clipUrl={lane.clip.url}
        gate={lane.currentGate ?? gate}
        blockedReason={lane.job.blockedReason}
        onSkipFilm={lane.skipFilm}
        onRetry={lane.retry}
      />

      <ScoringDeck
        batter={lane.deck.batter}
        pending={lane.deck.pending}
        runners={lane.deck.runners}
        waiting={waiting}
        onExpand={lane.deck.batter ? () => setExpanded(lane.deck.batter) : null}
      />

      {/* The foot strip: the plate appearances already scored, newest last.
          Reached ones ONLY — chips for plate appearances still ahead would say
          how many batters are left to bat this half. It is the way back to a
          play that was not read the first time, which is the thing Concept C
          could not do and the reason it was dropped. */}
      {lane.chips.length > 1 && (
        <nav className="xl__chips" aria-label="Plate appearances so far this half">
          {lane.chips.map((chip) => (
            <button
              key={chip.atBatIndex}
              type="button"
              className={`xl__chip ${
                chip.atBatIndex === lane.deck.batter?.atBatIndex ? 'is-on' : ''
              } ${chip.scored ? 'xl__chip--scored' : ''}`}
              onClick={() => {
                const row = lane.rows.find((r) => r.atBatIndex === chip.atBatIndex && r.isTerminal)
                if (row) lane.goTo(row.key)
              }}
            >
              <span className="xl__chipname">{chip.last}</span>
              <span className="xl__chipcode">{chip.code}</span>
            </button>
          ))}
        </nav>
      )}

      <footer className="xl__foot">
        {lane.atHalfEnd ? (
          <button type="button" className="btn btn--reveal xl__go" onClick={lane.nextHalf}>
            Next half-inning
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--reveal xl__go"
            onClick={lane.advance}
            disabled={!canAdvance}
          >
            {!lane.cursorRow
              ? 'Score the first play'
              : gate?.blocked
                ? 'Waiting for the film'
                : 'Next play'}
          </button>
        )}
      </footer>

      {expanded && (
        <PitchExpand card={expanded} rows={lane.allRows} onClose={() => setExpanded(null)} />
      )}
    </div>
  )
}
