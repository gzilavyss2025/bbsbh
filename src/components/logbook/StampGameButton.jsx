import { useState } from 'react'
import { useStamps } from '../../hooks/useStamps.js'
import { useNav } from '../../lib/nav.js'
import { MAX_NOTE_LENGTH, STAMP_MODES, seasonFromDate } from '../../lib/stamps.js'
import { logbookPath, logbookPlacePath } from '../../lib/route.js'
import { GameStamp } from './GameStamp.jsx'

// The mint affordance for a Logbook stamp (ADR-0035).
//
// ===========================================================================
// WHERE THIS LIVES, AND WHY THAT IS THE WHOLE SAFETY ARGUMENT
// ===========================================================================
// This component renders INSIDE the box score's SealBox reveal render function
// (src/screens/BoxScore.jsx) — not rendered-then-hidden, not gated by a boolean.
// ADR-0002 gives the guarantee for free: `children` is a render function invoked
// only once revealed, so nothing here reaches the DOM until the user has opened
// the box score. That placement is the CLIENT-side reveal gate, and it is why
// this component doesn't re-check one: you cannot reach the button without
// having revealed the game (or having turned on the Scores Unlocked pass, which
// is the other way a user legitimately comes to know the score — ADR-0026 — and
// which the server-side gate accepts for exactly the same reason).
//
// The authoritative gate is still the server's, on every mint. See ADR-0035.
//
// TWO THINGS NOT TO CHANGE about that host SealBox: it has no `onReveal` and it
// persists nothing. The stamp button is purely additive — it must not turn the
// box score into a surface that ratchets `revealedThrough`, because a box score
// opened under the Scores Unlocked pass would then silently mark the whole game
// as hand-revealed.
//
// Being at the TOP of the page rather than the foot of it changes none of that.
// The seal is a render-function boundary, not a position on the sheet: this is
// still called only from inside it (see BoxScore.jsx).
//
// ===========================================================================
// THE SHAPE: A STRIP ACROSS THE HEAD OF THE SHEET
// ===========================================================================
// This used to be a tall card at the very bottom of the box score, on the
// reasoning that a keepsake is not a headline. In practice that made the one
// thing on the page you can KEEP the one thing you had to go hunting for, past
// a full sheet of numbers. It is now a thin strip at the head of the page —
// the width of the sheet, about one stamp tall — so the stamp is an offer you
// decline by scrolling past rather than a reward you have to find. Where it
// lands is set by BoxScore.jsx plus the ordering rules in
// styles/48-stamp-strip.css: above the Highlights rule on a wide screen, and
// directly under the R/H/E/LOB totals on a phone.
//
// Staying thin is the constraint, not a preference. The strip is ONE row —
// mount, a line of copy, one action. Everything a minted stamp additionally
// offers (how you took the game in, the note, the way into the book, the way
// to take it back) sits behind the Details disclosure, because none of it is
// what you came to the top of the page for. New affordances go in there; the
// row does not grow.
//
// `game` is the reveal-only facts blob from revealStampFacts (api/linescore.js).
export function StampGameButton({ game }) {
  const navigate = useNav()
  const { stampFor, stamp, unstamp, seasonIsFull } = useStamps()
  const [noteDraft, setNoteDraft] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  if (!game?.gamePk || !game.date) return null

  const existing = stampFor(game.gamePk)
  const season = seasonFromDate(game.date)
  // A live game's score is still moving; a stamp is permanent. The server
  // refuses a non-Final mint outright (409), so the affordance says why rather
  // than offering a button that can only fail.
  const isFinal = game.status === 'Final'
  // `isFinal` is part of this and not just a sibling test: a full book is only
  // worth saying once it is the ONLY thing standing between you and a stamp.
  // While the game is still going the lede has a truer reason to give, and the
  // one below reads the two in that order.
  const full = isFinal && !existing && season != null && seasonIsFull(season)
  // Two states have nothing to offer — the game isn't final yet, and the
  // season's book is full. The row drops its action column rather than
  // reserving an empty one.
  const hasAction = isFinal && !full
  const detailsId = `stampdetails-${game.gamePk}`

  const save = (patch) => {
    stamp(game.gamePk, {
      mode: patch.mode ?? existing?.mode,
      note: patch.note ?? existing?.note ?? '',
      date: game.date,
    })
  }

  return (
    <section className="stampstrip" aria-label="Game Log">
      <div className={`stampstrip__row${hasAction ? '' : ' stampstrip__row--quiet'}`}>
        {/* The stamp sits in a mount — an album hinge, empty until one is
            pressed into it. Un-minted it is a dashed well holding a pale
            preview of what you'd keep; minted, the well goes solid and the
            stamp comes up to the winning club's ink (lib/stampInk.js). */}
        <div className={`stampstrip__mount${existing ? '' : ' stampstrip__mount--empty'}`}>
          <GameStamp game={game} instanceId={`bs-${game.gamePk}`} />
        </div>

        <div className="stampstrip__say">
          <span className="stampstrip__eyebrow">Game Log</span>
          {full ? (
            <p className="stampstrip__lede stampstrip__lede--full">
              Your {season} Game Log is full. Remove a stamp to make room.
            </p>
          ) : (
            <p className="stampstrip__lede">
              {!isFinal
                ? 'A stamp is minted once the game is final — the score on it never changes.'
                : existing
                  ? existing.placement
                    ? `Stamped, and on page ${existing.placement.page} of your book.`
                    : 'Stamped. It’s waiting to be placed in your book.'
                  : 'You opened this one. Keep it — a stamp files this game in your Game Log.'}
            </p>
          )}
        </div>

        {hasAction && (
          <div className="stampstrip__do">
            {existing ? (
              <>
                {/* The hand-off into the placement flow. Minting and PLACING
                    are deliberately two steps: the mint happens here, inside
                    the seal, where the safety argument lives, and the book —
                    a whole page of other games' stamps — never has to render
                    inside a game screen. An unplaced stamp is not a lost one;
                    it waits in the book's tray until you put it somewhere. */}
                <button
                  type="button"
                  className="btn btn--ink"
                  onClick={() => navigate(logbookPlacePath(game.gamePk))}
                >
                  {existing.placement ? 'Move it in your book' : 'Place it in your book'}
                </button>
                <button
                  type="button"
                  className="stampstrip__disclose"
                  aria-expanded={detailsOpen}
                  aria-controls={detailsId}
                  onClick={() => setDetailsOpen((o) => !o)}
                >
                  Details
                  <span className="stampstrip__chevron" aria-hidden="true">
                    {detailsOpen ? '▾' : '▸'}
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn--seal"
                onClick={() => save({ mode: 'watched', note: '' })}
              >
                Stamp this game
              </button>
            )}
          </div>
        )}
      </div>

      {existing && detailsOpen && (
        <div className="stampstrip__details" id={detailsId}>
          <div className="stampstrip__modes" role="group" aria-label="How you took this game in">
            {STAMP_MODES.map((mode) => (
              <button
                type="button"
                key={mode}
                className={existing.mode === mode ? 'is-active' : ''}
                aria-pressed={existing.mode === mode}
                onClick={() => save({ mode })}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Committed on blur rather than per keystroke: every save bumps
              `updatedAt`, which is what StampsCloudSync diffs on, so a
              per-keystroke write would publish a request per character. */}
          <label className="stampstrip__note">
            <span className="stampstrip__notelabel">Note</span>
            <input
              type="text"
              maxLength={MAX_NOTE_LENGTH}
              placeholder="Dad’s first game here"
              value={noteDraft ?? existing.note ?? ''}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => {
                if (noteDraft != null && noteDraft !== existing.note) save({ note: noteDraft })
                setNoteDraft(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
          </label>

          <div className="stampstrip__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate(logbookPath(season))}
            >
              Open Game Log
            </button>
            <button
              type="button"
              className="stampstrip__remove"
              onClick={() => {
                setNoteDraft(null)
                setDetailsOpen(false)
                unstamp(game.gamePk)
              }}
            >
              Remove stamp
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
