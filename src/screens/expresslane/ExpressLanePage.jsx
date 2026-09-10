import { useCallback, useEffect, useMemo, useState } from 'react'
import { EntryChooser } from './EntryChooser.jsx'
import { FilmPane } from './FilmPane.jsx'
import { ScoringDeck } from './ScoringDeck.jsx'
import { PitchExpand } from './PitchExpand.jsx'
import { useExpressLane } from '../../hooks/useExpressLane.js'
import { RollingLine } from '../../components/gamehud/RollingLine.jsx'
import { useRevealProgress } from '../../hooks/useRevealProgress.js'
import { selectInningCount, selectRegulationInnings, selectTeamMeta } from '../../api/select.js'
import { expressHalfOf, stepToSection } from '../../lib/route.js'
import { DEFAULT_STAGING_PLAN } from '../../lib/expresslane/staging.js'
import { halfIndex } from '../../api/select.js'

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

// THE DEV-ONLY FILM SWITCH — `?nofilm`, and it is dev-only in the build rather
// than by convention.
//
// `import.meta.env.DEV` is a compile-time constant, so in a production build
// this whole branch is removed and the flag cannot be typed into a real
// reader's URL bar. That matters more here than for the other dev routes: the
// film gate is this feature's entire thesis — a scorer who can read "grounds
// out, second baseman to first" has no reason to wait for the picture — and a
// shipped way around it would erode the design within a week of use.
//
// What it does is make every row read as PAPERWORK (useExpressLane strips the
// playIds), which is a state the gate already has and already handles. Nothing
// downloads, nothing waits, and the whole surface — the deck, the chips, the
// runners' diamonds, the reveal marks, the half handoffs — can be walked end to
// end in seconds instead of an hour.
function nofilmRequested() {
  if (!import.meta.env.DEV) return false
  try {
    return new URLSearchParams(window.location.search).has('nofilm')
  } catch {
    return false
  }
}

export function ExpressLanePage({ feed, gamePk, section, onSection, onLeave }) {
  // Result mode is the default because it is the one that works at the film's
  // own pace; every pitch is a deliberate pick, made with its cost on the
  // button.
  const [mode, setMode] = useState('result')
  // WHEN the film arrives, as against WHAT arrives. `ahead` is the default
  // because it is the one that suits scoring a game: a short head start, then
  // the queue works a half-inning in front of you. See STAGING_PLANS.
  const [plan, setPlan] = useState(DEFAULT_STAGING_PLAN)
  const [filmless] = useState(nofilmRequested)
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

  // WHERE TO OPEN. A URL that names a half wins — `express-top5` is a real
  // address, and someone who followed one meant to land there. Otherwise open
  // on the first half the scorer has NOT finished, the sanctioned
  // `revealedThrough + 1` (ADR-0003/0010). Extras are reached one at a time by
  // the same walk, so nothing here has to know whether the game went long.
  //
  // An addressed half is still CLAMPED to that frontier below, so a link cannot
  // be a way past the seal: following `express-bottom9` on a game scored to the
  // third opens the third.
  const [startHalfIdx] = useState(() => {
    const addressed = expressHalfOf(section)
    const wanted = addressed ? halfIndex(addressed.inning, addressed.half) : revealedThrough + 1
    return Math.max(0, Math.min(wanted, revealedThrough + 1))
  })

  // Advancing IS the reveal act. Within a half it ratchets the at-bat mark;
  // finishing one ratchets the half mark, which is what unlocks the next.
  //
  // The two are EXCLUSIVE. `revealTo` clears the at-bat cursor as it commits —
  // whatever was mid-step has just been fully committed — so writing both on
  // the closing play would set a count and then throw it away.
  //
  // The hook names the half rather than numbering it, for the reason its own
  // note at `advance` gives: these two functions take `(inning, half)`, a
  // half-index passed in that slot reads as an inning number, and the reveal
  // mark that comes out is a different half from the one that was scored.
  const onReveal = useCallback(
    ({ inning, half, cap, halfDone }) => {
      if (halfDone) revealTo(inning, half)
      else if (cap != null) revealAtBat(inning, half, cap)
    },
    [revealAtBat, revealTo],
  )

  const lane = useExpressLane({
    feed,
    gamePk,
    mode,
    plan,
    regulation,
    filmless,
    startHalfIdx,
    // Live, not the value the surface opened on: as the scorer finishes a half
    // the mark ratchets and the next one becomes reachable.
    maxHalfIdx: revealedThrough + 1,
    onReveal,
  })

  // The URL follows the cursor, so the half you are on is always the half you
  // could send someone. Same shape the innings viewer keeps (`top5`), same slot
  // in the address, so the two read alike.
  useEffect(() => {
    if (!started || !onSection) return
    const want = stepToSection(7, lane.inning, lane.half)
    if (want !== section) onSection(want, { replace: true })
  }, [started, onSection, lane.inning, lane.half, section])

  // Club identity, off the spoiler-free selector every lineup page already
  // uses. A club's name is not a score. The running line reads it for its two
  // row labels, and nothing else on this surface does.
  const meta = useMemo(
    () => ({ away: selectTeamMeta(feed, 'away') ?? {}, home: selectTeamMeta(feed, 'home') ?? {} }),
    [feed],
  )

  if (!started) {
    return (
      <div className="xl">
        <EntryChooser
          mode={mode}
          onMode={setMode}
          plan={plan}
          onPlan={setPlan}
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
  //
  // IT IS NOT A ROOM WITH ONE DOOR. Both ways a job blocks — a full disk and a
  // host that has stopped answering — are terminal: `pump` breaks and does not
  // come back on its own. Either can happen DURING the pre-roll, and this
  // screen used to render the waiting message alone: no bar, no Leave, and no
  // word of what had gone wrong. A scorer whose disk filled sat under "Getting
  // the first few plays." with the browser's back button as the only way out.
  //
  // So the bar comes with it, and a block says which one it was in the same
  // words FilmPane uses further down the page, with the same retry.
  if (!lane.preroll.ready && !lane.cursorRow) {
    return (
      <div className="xl">
        <header className="xl__bar">
          <button type="button" className="xl__back" onClick={onLeave}>
            Leave
          </button>
          <span className="xl__half">{halfLabel(lane.inning, lane.half)}</span>
          <span className="xl__booth" />
        </header>
        {lane.job.blockedReason ? (
          <div className="xl__preroll">
            <p className="xl__prerollmsg">
              {lane.job.blockedReason === 'quota'
                ? 'This device is out of room for film.'
                : lane.job.blockedReason === 'host'
                  ? 'MLB has stopped serving clips to this device for now.'
                  : 'The film stopped arriving.'}
            </p>
            <p className="xl__prerollsub">
              {lane.job.blockedReason === 'quota'
                ? 'Free some space, then pick it back up.'
                : lane.job.blockedReason === 'host'
                  ? 'Give it a few minutes, then try again.'
                  : 'Try again, or come back to this game later.'}
            </p>
            <button type="button" className="btn btn--ghost" onClick={lane.retry}>
              Try again
            </button>
          </div>
        ) : (
          <div className="xl__preroll">
            <span className="xl__prerollmark" aria-hidden="true" />
            {/* Two waits, and they are different enough to need different
                words: a minute and a half, and half an hour. Neither shows a
                measure of itself — a count of clips against a game-wide total
                would state the game's length (ADR-0008), and a bar over the
                bytes would say the play ahead is a long one (ADR-0046). */}
            <p className="xl__prerollmsg">
              {lane.preroll.openWhen === 'drained'
                ? 'Getting the whole game.'
                : 'Getting the first few plays.'}
            </p>
            <p className="xl__prerollsub">
              {lane.preroll.openWhen === 'drained'
                ? 'About half an hour, at the speed MLB sends film. Leave this open and come back to it — nothing is lost if you close it, and what has arrived stays on this device.'
                : 'The film arrives about as fast as MLB will send it, which is slower than it sounds.'}
            </p>
          </div>
        )}
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
        {/* The right-hand balancer for the Leave button, and deliberately
            empty. It used to name the booth; there is no booth to name, since
            Tier 2 resolves one clip per play whichever broadcast called it. */}
        <span className="xl__booth" />
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
      {/* THE AUTOMATIC RUNNER IS A MARKER HERE, NOT A DOOR. He took no plate
          appearance, so there is no play of his to go back to and no rail row
          his chip could land on — see reachedPlateAppearances. He is drawn, so
          the strip matches the boxes on the deck, and he is drawn as a `span`
          so nothing offers a tap that would do nothing. Everything else keys on
          `chip.id` rather than on a plate-appearance number, which a placement
          does not have. */}
      {lane.chips.length > 1 && (
        <nav className="xl__chips" aria-label="Plate appearances so far this half">
          {lane.chips.map((chip) => {
            const on =
              chip.atBatIndex != null && chip.atBatIndex === lane.deck.batter?.atBatIndex
            const cls = `xl__chip ${on ? 'is-on' : ''} ${chip.scored ? 'xl__chip--scored' : ''}`
            const inner = (
              <>
                <span className="xl__chipname">{chip.last}</span>
                <span className="xl__chipcode">{chip.code}</span>
              </>
            )
            if (chip.kind === 'placed') {
              return (
                <span key={chip.id} className={`${cls} xl__chip--placed`}>
                  {inner}
                </span>
              )
            }
            return (
              <button
                key={chip.id}
                type="button"
                className={cls}
                onClick={() => {
                  const row = lane.rows.find((r) => r.atBatIndex === chip.atBatIndex && r.isTerminal)
                  if (row) lane.goTo(row.key)
                }}
              >
                {inner}
              </button>
            )
          })}
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
          /* Gated on the same frontier the forward arrow is. Reaching the end
             of a half commits it, so this is live by the time it is drawn — but
             a button that silently does nothing is the shape the half-index bug
             took, and a disabled one says so instead. */
          <button
            type="button"
            className="btn btn--reveal xl__go"
            onClick={lane.nextHalf}
            disabled={!lane.canGoForward}
          >
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
