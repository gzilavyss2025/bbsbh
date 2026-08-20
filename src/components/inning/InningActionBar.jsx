import { ordinal } from '../../lib/format.js'

// The innings viewer's floating bar — the same fixed blue bar the lineup pages
// page forward with, and the same destination-named + trailing-› convention
// their nextLabel buttons use ("Home team ›", "Innings ›") — no "Next:" prefix,
// no arrow glyph.
//
// Its own component rather than 130 lines inside InningViewer.jsx, which is at
// its own size budget (ADR-0038's "prefer putting new code elsewhere"). Purely
// presentational and deliberately so: every decision the bar makes — which half
// is next, whether this one is sealed, whether the book is closed — is resolved
// upstream and arrives as a prop or a handler, so nothing here can grow a
// second opinion about the reveal mark. The markup is moved verbatim, classes
// included: `24-floating-nav-and-hud.css`'s dead-space hit areas and
// `e2e/reveal-hit-area.spec.js`'s assertions about them measure this exact
// geometry.
//
// IT CARRIES THE ONLY REFRESH, AT EVERY WIDTH — passed in as `refresh` rather
// than built here, since the control belongs to the screen that owns the
// reload. Refresh left `.inningchrome` entirely and nothing hides
// `.refreshbtn--float` at any width, so this bar is where you reach for it
// during a live game, phone and desktop alike. That is also why
// `.pagenav--innings`'s hit-area rules measure around a Refresh row that is
// always there, and why focus mode's one-row bar shrinks it to icon scale
// rather than dropping it (styles/focus/stage.css). The caller passes null once
// the game is over, when there is nothing left to fetch — a control that cannot
// change anything should not be on the one row a thumb is working. The
// dead-space claims answer for themselves there: the -76px reach is behind
// `:has(.refreshbtn--float)`, with a bare -20px for exactly that case.
//
// THREE STATES, plus a hold:
//
//  • A SEALED HALF offers two reveal choices (ADR-0016) — step one at-bat, or
//    the whole half at once.
//  • OTHERWISE the plain advance: the next-half label once one unlocks, or the
//    last action at the furthest revealed inning. Never "Top 10th ›", which
//    would leak the game going to extras before the reader gets there.
//  • UNDER THE SCORES UNLOCKED PASS at the live frontier (ADR-0026), a calm
//    status instead of either.
//
// A SEALED HALF THAT IS STILL BEING PLAYED SPLITS THE FIRST OF THOSE (ADR-0054).
// `halfLive` says the game is in this exact half right now, and it takes "Rest
// of half" off the bar — there is no rest of the half yet, and the tap would
// commit a half on the strength of however many batters happen to have reached
// the feed, which is the whole defect ADR-0054 exists to fix. "Next at-bat"
// stands alone and full width. Then `atHalfEdge` — every fetched entry already
// stepped through — replaces even that with the same calm live status the pass's
// frontier gets, because a tap there would move nothing. Neither is a fourth
// state so much as the sealed state told the truth about a half in motion; both
// end on their own as the next plate appearance reaches the feed, or as the
// third out turns the half into an ordinary finished one.
//
// A half that just finished used to be a FOURTH state, pairing the advance with
// a "Summary" button. That is still gone: the numbers a scorer wants when a
// half closes arrive on their own (HalfTally.jsx in the console band, and the
// closing rule on the stage), so the end of a half has exactly one thing to say
// here and it is "carry on". The whole-half view came back as a quiet
// paper-pill link under the trail instead (FocusControls.jsx).
//
// WHAT THE CLOSE DID ADD IS TIMING, NOT A FOURTH STATE (ADR-0046). For the
// ~700ms the closing rule takes to draw, `closing` is true and the forward
// action is HELD, so the bar does not go live under a thumb mid-draw. Any tap
// or key ends that sequence early (useFocusMode's interrupt), so the hold never
// costs more than one tap, and it is skipped outright under reduced motion.
// `aria-disabled` rather than `disabled` is on purpose: a truly disabled button
// emits no pointer events in most browsers, so a thumb landing on it would
// neither advance NOR cut the sequence short — and that is the one tap that
// must always do something.
export function InningActionBar({
  focused,
  closing,
  turning,
  refresh,
  atLiveEdge,
  liveEdgeLabel,
  currentSealed,
  halfLive,
  atHalfEdge,
  effInning,
  effHalf,
  onRevealNextAtBat,
  onRevealWholeHalf,
  nextIdx,
  nextLabel,
  onForward,
  bookClosed,
  onBoxScore,
}) {
  const halfWord = effHalf === 'top' ? 'top' : 'bottom'
  return (
    <div className={`pagenav pagenav--innings${focused ? ' pagenav--focus' : ''}`}>
      {refresh}
      {atLiveEdge ? (
        <div className="liveedge" role="status" aria-live="polite">
          <span className="liveedge__dot" aria-hidden="true" />
          <span className="liveedge__label">{liveEdgeLabel}</span>
        </div>
      ) : currentSealed && atHalfEdge ? (
        /* Caught up INSIDE a half still being played (ADR-0054) — the same
           calm status the pass's own frontier gets, and deliberately the same
           markup, because it is the same fact: the reader has reached the game.
           `aria-live="polite"` announces it once when the last tap lands you
           here, and the ordinary Refresh above is what brings the next batter. */
        <div className="liveedge" role="status" aria-live="polite">
          <span className="liveedge__dot" aria-hidden="true" />
          <span className="liveedge__label">Caught up — waiting on the next batter</span>
        </div>
      ) : currentSealed && halfLive ? (
        /* One choice, not two: see `halfLive` in the header. Full width rather
           than a lone half-width button in a split, so the thumb keeps the
           target it has when the half finishes and the pair returns. */
        <button
          type="button"
          className="btn btn--reveal"
          onClick={onRevealNextAtBat}
          aria-label={`Reveal the next at-bat in the ${halfWord} of the ${ordinal(effInning)} inning`}
        >
          Next at-bat
        </button>
      ) : currentSealed ? (
        <div className="revealsplit">
          <button
            type="button"
            className="btn btn--reveal revealsplit__btn"
            onClick={onRevealNextAtBat}
            aria-label={`Reveal the next at-bat in the ${halfWord} of the ${ordinal(effInning)} inning`}
          >
            Next at-bat
          </button>
          {/* NOT THE SAME WEIGHT AS THE BUTTON BESIDE IT. These were two
              identical kraft seals, equal width and equal pull, and they do
              opposite things: the left one advances the loop the reader is here
              for, one at-bat at a time, forty times a half-hour. This one ENDS
              it — it is the skip. A skip button drawn as loud as the play button
              is a thumb waiting to make a mistake it cannot undo, since
              revealing is one-directional (ADR-0002).

              Demoted, not moved and not shrunk: same row, same width, same tap
              target — only the kraft texture comes off (see
              `.revealsplit__btn--quiet`, styles/focus/stage.css). The hit areas
              in 24-floating-nav-and-hud.css measure geometry, which is
              untouched, so e2e/reveal-hit-area.spec.js holds. */}
          <button
            type="button"
            className="btn btn--reveal revealsplit__btn revealsplit__btn--quiet"
            onClick={onRevealWholeHalf}
            aria-label={`Reveal the rest of half — the ${halfWord} of the ${ordinal(effInning)} inning`}
          >
            Rest of half
          </button>
        </div>
      ) : nextIdx != null ? (
        <button
          className="btn btn--next"
          onClick={() => !closing && onForward(nextIdx)}
          aria-disabled={turning || closing || undefined}
        >
          {nextLabel} ›
        </button>
      ) : (
        /* THE LAST ACTION IS AN ACT, NOT A DESTINATION, once the book is closed
           (ADR-0046 — `bookClosed` is the reader's own mark reaching the last
           half actually played, never `selectIsFinal`; see beats.js). Every
           other forward control here is named for where it lands, because at
           every other moment the reader is going somewhere to carry on. This one
           ends a game they kept by hand, and "Box score" is a filing-cabinet
           name for that. Same destination and the same handler either way; only
           the sentence changes. It lands where the Game Log's stamp strip is the
           first row at the head of the revealed sheet (ADR-0035's third
           amendment) — still behind that page's own seal, which must not gain an
           onReveal (see BoxScore.jsx). */
        <button
          className="btn btn--next"
          onClick={() => !closing && onBoxScore()}
          aria-disabled={closing || undefined}
        >
          {bookClosed ? 'Close the book' : 'Box score'} ›
        </button>
      )}
    </div>
  )
}
