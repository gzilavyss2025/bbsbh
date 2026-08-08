import { useState } from 'react'

// "By date" — the one arrangement the Game Log makes for you, and the only
// control here that overwrites work the user did by hand.
//
// ADR-0036 is why it looks like this: the arrangement IS the artifact, so
// re-ordering is a confirmed action, never a sort order the book remembers and
// never anything that happens on load. Two directions, two buttons — a toggle
// would read as a state the book is in. The confirm names what it costs.
export function BookOrderControl({ count = 0, onReorder }) {
  // null, or the direction waiting on a yes.
  const [asking, setAsking] = useState(null)

  if (count < 2) return null

  if (asking) {
    return (
      <section className="logbook__order logbook__order--asking" aria-live="polite">
        <p className="logbook__placinglede">
          This re-places every stamp in this book — each one lifted off its page and
          pressed back down {asking === 'newest' ? 'newest' : 'oldest'} first, from page
          1. The order you put them in by hand does not come back.
        </p>
        <p className="logbook__orderscope">The tray and your other books stay as they are.</p>
        <div className="logbook__placingactions">
          <button
            type="button"
            className="btn btn--seal"
            onClick={() => {
              setAsking(null)
              onReorder?.(asking)
            }}
          >
            Re-place them
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setAsking(null)}>
            Leave it as it is
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="logbook__order" aria-label="Arrange this book by date">
      <p className="logbook__orderlede">By date</p>
      <div className="logbook__placingactions">
        <button type="button" className="btn btn--ghost" onClick={() => setAsking('oldest')}>
          Oldest first
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setAsking('newest')}>
          Newest first
        </button>
      </div>
    </section>
  )
}
