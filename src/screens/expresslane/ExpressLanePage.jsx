import { useCallback, useMemo, useState } from 'react'
import { EntryChooser } from './EntryChooser.jsx'
import { FilmPane } from './FilmPane.jsx'
import { ScoringDeck } from './ScoringDeck.jsx'
import { PitchExpand } from './PitchExpand.jsx'
import { useExpressLane } from '../../hooks/useExpressLane.js'
import { RollingLine } from '../../components/gamehud/RollingLine.jsx'
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
  const { revealedThrough, revealTo, revealAtBat, unlocked } = useRevealProgress(
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
    // Live, not the value the surface opened on: as the scorer finishes a half
    // the mark ratchets and the next one becomes reachable.
    maxHalfIdx: revealedThrough + 1,
    onReveal,
  })

  // Club identity, off the spoiler-free selector every lineup page already
  // uses. A club's name is not a score.
  const meta = useMemo(
    () => ({ away: selectTeamMeta(feed, 'away') ?? {}, home: selectTeamMeta(feed, 'home') ?? {} }),
    [feed],
  )
  const names = useMemo(
    () => ({ away: meta.away.name ?? 'Visitors', home: meta.home.name ?? 'Home' }),
    [meta],
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

  // NOTHING WAS PLAYED IN THIS HALF, which is how a finished game ends: the
  // surface opens on the first half not yet scored, and for a game scored to
  // its last out that half never happened. It used to render the ordinary deck
  // over an empty rail — a dead button under a film pane promising film that
  // was never coming. It says so instead, and offers the way back.
  if (lane.halfEmpty) {
    return (
      <div className="xl">
        <header className="xl__bar">
          <button type="button" className="xl__back" onClick={onLeave}>
            Leave
          </button>
          <span className="xl__half">{halfLabel(lane.inning, lane.half)}</span>
          <span className="xl__booth" />
        </header>
        <div className="xl__preroll">
          <p className="xl__prerollmsg">Nothing was played here.</p>
          <p className="xl__prerollsub">
            You have scored to the end of what this game has. Step back to look at a half again.
          </p>
          <button type="button" className="btn btn--ghost" onClick={lane.prevHalf}>
            Back a half-inning
          </button>
        </div>
      </div>
    )
  }

  // The pre-roll, and it is checked AFTER the empty half above rather than
  // before it. An empty half stages nothing, so it never reaches the pre-roll's
  // threshold — asking "is the film here yet" first left a finished game
  // waiting forever for film that was never coming.
  //
  // It is a wait with nothing to show yet, so it says so and shows no measure
  // of itself — the same indeterminate rule the in-game wait follows.
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
        {/* HALF NAVIGATION, always reachable rather than only at the end of a
            half. Backwards is never gated: every half behind the cursor is one
            already scored, and looking again is the point. Forwards is the same
            act as finishing a half — it advances the reveal mark, which is what
            unlocks the next one, extras one at a time (ADR-0008). */}
        <span className="xl__nav">
          <button
            type="button"
            className="xl__navbtn"
            onClick={lane.prevHalf}
            disabled={lane.halfIdx === 0}
            aria-label="Back a half-inning"
          >
            ‹
          </button>
          <span className="xl__half">{halfLabel(lane.inning, lane.half)}</span>
          <button
            type="button"
            className="xl__navbtn"
            onClick={lane.nextHalf}
            disabled={!lane.canGoForward}
            aria-label="Forward a half-inning"
          >
            ›
          </button>
        </span>
        <span className="xl__booth">{booth === 'home' ? names.home : names.away}</span>
      </header>

      {/* THE RUNNING LINE, and it is the same component the innings view puts
          at its top — not a version of it. Every run cell is a button that
          jumps to that half, so choosing where to go reads like reading a line
          score rather than hunting through a chip strip, and a scorer who works
          in the innings view already knows how it behaves.

          Reusing it also inherits its seal: a cell is READ only when its
          half-index is at or below `revealedThrough`, so nothing sealed is ever
          computed into the grid, and the extra-innings window scroll that
          ADR-0008 requires comes along for free.

          `runsInProgress` is deliberately NOT passed. In the innings view that
          prop builds the current half's cell as you step through it; here the
          reveal is atomic with the film, and a half being scored right now has
          a total the scorer is still deriving from the picture. It stays blank
          until the half commits.

          The arrows in the bar stay, for the reason the innings view keeps its
          own Back/Next beside this grid: once extras unlock, the visible window
          scrolls and a half can slide off the end of it. */}
      <RollingLine
        feed={feed}
        regulation={regulation}
        unlocked={unlocked}
        revealedThrough={revealedThrough}
        awayAbbr={meta.away.abbreviation}
        homeAbbr={meta.home.abbreviation}
        awayName={meta.away.clubName}
        homeName={meta.home.clubName}
        curIdx={lane.halfIdx}
        onSelect={lane.goToHalf}
      />

      {/* The film pane reads the gate for the row the cursor is ON — never the
          row ahead, and never a fallback to it. Before the first advance there
          is no row at all, and it says so rather than describing one. */}
      <FilmPane
        clipUrl={lane.clip.url}
        gate={lane.currentGate}
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
        {/* Back one play. Never gated, for the same reason the chips are not:
            it moves onto a row already scored. It is the fine-grained partner
            to the half arrows above — the app has no address finer than a
            half-inning, so within one, stepping is what navigation means. */}
        {lane.cursorRow && (
          <button
            type="button"
            className="btn btn--ghost xl__backplay"
            onClick={lane.stepBack}
            disabled={!lane.canStepBack}
          >
            Back one play
          </button>
        )}
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
