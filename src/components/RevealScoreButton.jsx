import { useState } from 'react'

// Global "Reveal score" control with a confirmation gate (§7b). Uncovering
// everything at once is the one irreversible, fully-spoiling action, so it is
// guarded by an explicit sheet — never a single stray tap.
export function RevealScoreButton({ revealed, onReveal }) {
  const [asking, setAsking] = useState(false)

  if (revealed) {
    return <span className="revealscore revealscore--done">Revealed</span>
  }

  return (
    <>
      <button className="revealscore" onClick={() => setAsking(true)}>
        Reveal score
      </button>

      {asking && (
        <div
          className="scrim"
          onClick={(e) =>
            e.target.classList.contains('scrim') && setAsking(false)
          }
        >
          <div className="sheet" role="dialog" aria-modal="true">
            <h3 className="sheet__title">Reveal the whole game?</h3>
            <p className="sheet__body">
              This uncovers every inning’s totals and the final line at once.
              There’s no un-seeing it. Only do this if you’re done scoring.
            </p>
            <div className="sheet__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setAsking(false)}
              >
                Keep it sealed
              </button>
              <button
                className="btn btn--danger"
                onClick={() => {
                  onReveal()
                  setAsking(false)
                }}
              >
                Reveal everything
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
