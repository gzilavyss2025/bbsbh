import { useState } from 'react'
import { useStamps } from '../../hooks/useStamps.js'
import { useNav } from '../../lib/nav.js'
import { MAX_NOTE_LENGTH, STAMP_MODES, seasonFromDate } from '../../lib/stamps.js'
import { logbookPath, logbookPlacePath } from '../../lib/route.js'
import { SectionMasthead } from '../ui/SectionMasthead.jsx'
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
// `game` is the reveal-only facts blob from revealStampFacts (api/linescore.js).
export function StampGameButton({ game }) {
  const navigate = useNav()
  const { stampFor, stamp, unstamp, seasonIsFull } = useStamps()
  const [noteDraft, setNoteDraft] = useState(null)

  if (!game?.gamePk || !game.date) return null

  const existing = stampFor(game.gamePk)
  const season = seasonFromDate(game.date)
  // A live game's score is still moving; a stamp is permanent. The server
  // refuses a non-Final mint outright (409), so the affordance says why rather
  // than offering a button that can only fail.
  const isFinal = game.status === 'Final'
  const full = !existing && season != null && seasonIsFull(season)

  const save = (patch) => {
    stamp(game.gamePk, {
      mode: patch.mode ?? existing?.mode,
      note: patch.note ?? existing?.note ?? '',
      date: game.date,
    })
  }

  return (
    <section className="stampcard">
      <SectionMasthead as="h3" title="Logbook" />

      <div className={`stampcard__body${existing ? '' : ' stampcard__body--unstamped'}`}>
        <div className="stampcard__art">
          <GameStamp game={game} instanceId={`bs-${game.gamePk}`} />
        </div>

        <div className="stampcard__side">
          {!isFinal && (
            <p className="stampcard__lede">
              A stamp is minted once the game is final — the score on it never changes.
            </p>
          )}

          {isFinal && !existing && (
            <>
              <p className="stampcard__lede">
                You opened this one. Keep it — a stamp files this game in your Logbook.
              </p>
              {full ? (
                <p className="hint hint--error">
                  Your {season} Logbook is full. Remove a stamp to make room.
                </p>
              ) : (
                <button
                  type="button"
                  className="btn stampcard__mint"
                  onClick={() => save({ mode: 'watched', note: '' })}
                >
                  Stamp this game
                </button>
              )}
            </>
          )}

          {isFinal && existing && (
            <>
              <p className="stampcard__lede">
                {existing.placement
                  ? `Stamped, and on page ${existing.placement.page} of your book.`
                  : 'Stamped. It’s waiting to be placed in your book.'}
              </p>

              <div className="stampcard__modes" role="group" aria-label="How you took this game in">
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
              <label className="stampcard__note">
                <span className="stampcard__notelabel">Note</span>
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

              <div className="stampcard__actions">
                {/* The hand-off into the placement flow. Minting and PLACING
                    are deliberately two steps: the mint happens here, inside
                    the seal, where the safety argument lives, and the book —
                    a whole page of other games' stamps — never has to render
                    inside a game screen. An unplaced stamp is not a lost one;
                    it waits in the book's tray until you put it somewhere. */}
                <button
                  type="button"
                  className="btn stampcard__place"
                  onClick={() => navigate(logbookPlacePath(game.gamePk))}
                >
                  {existing.placement ? 'Move it in your book' : 'Place it in your book'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => navigate(logbookPath(season))}
                >
                  Open Logbook
                </button>
                <button
                  type="button"
                  className="stampcard__remove"
                  onClick={() => {
                    setNoteDraft(null)
                    unstamp(game.gamePk)
                  }}
                >
                  Remove stamp
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
