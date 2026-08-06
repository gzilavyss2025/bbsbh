import { useId, useState } from 'react'
import { humanDate, asOfBounds, clampAsOfDate } from '../../lib/dates.js'
import { useNav } from '../../lib/nav.js'
import { linkQuery } from '../../lib/route.js'

// Renders atop every player / team / leaders page (all four already sit
// inside a `<LinkScope>`) and carries the `?d=&s=` as-of cutoff's whole
// lifecycle — the page is showing that club or player as they stood ENTERING
// the picked day, not as they stand now:
//
//   - the way IN: on a live page (`asOf` is null), a plain-text button opens
//     a date picker — the entry point ADR-0034's "the cutoff is opt-in now"
//     amendment named as a known gap. Nothing here pre-fills a date; picking
//     one is the only way this page ever becomes dated.
//   - the way to CHANGE: on a dated page, "Change date" reopens the same
//     picker, pre-filled with the date already in the URL (not a remembered
//     default — just showing what the address already says).
//   - the way OUT: "Show current" drops the cutoff entirely.
//
// Until 2026-08-06 this only did the last of the three, because `GameView`
// stamped `?d=` onto every link out of a game and there was nothing to opt
// IN to — see ADR-0034's "The cutoff is opt-in now".
//
// `sportId` is the route's own `?s=` hint, threaded straight through (never
// re-derived from fetched data) so applying a new date reproduces the
// address the visitor is already on, plus the changed day — same
// don't-invent-a-query-the-URL-never-had rule `TeamTabBar` follows.
export function AsOfBanner({ asOf, sportId = null }) {
  const navigate = useNav()
  const inputId = useId()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState('')
  const { min, max } = asOfBounds()

  const openEditor = () => {
    setPending(asOf || '')
    setEditing(true)
  }
  const cancelEditor = () => setEditing(false)
  const applyEditor = () => {
    const clamped = clampAsOfDate(pending)
    if (!clamped) return
    setEditing(false)
    navigate(`${window.location.pathname}${linkQuery({ d: clamped, s: sportId })}`)
  }
  // Drops the whole query, cutoff and level hint together — losing `s` costs
  // the fetch layer a shortcut, never an answer, since the page re-resolves
  // its own level from the player or club it loads.
  const goLive = () => {
    setEditing(false)
    navigate(window.location.pathname, { replace: true })
  }

  if (editing) {
    return (
      <div className="asof-banner asof-banner--editing" role="note">
        <label className="asof-banner__label" htmlFor={inputId}>
          As of
        </label>
        <input
          id={inputId}
          type="date"
          className="asof-banner__input"
          min={min}
          max={max}
          value={pending}
          onChange={(e) => setPending(e.target.value)}
        />
        <button type="button" className="asof-banner__btn" onClick={applyEditor} disabled={!pending}>
          Go
        </button>
        <button type="button" className="asof-banner__cancel" onClick={cancelEditor}>
          Cancel
        </button>
      </div>
    )
  }

  if (!asOf) {
    return (
      <div className="asof-banner asof-banner--live" role="note">
        <button type="button" className="asof-banner__cancel" onClick={openEditor}>
          View as of a date
        </button>
      </div>
    )
  }

  return (
    <div className="asof-banner" role="note">
      {/* "entering" is not a flourish — every loader cuts at `dayBefore(asOf)`,
          so these are the numbers this player or club carried INTO that day,
          with nothing from the day itself folded in. */}
      <span className="asof-banner__text">Stats entering {humanDate(asOf)}</span>
      <button type="button" className="asof-banner__cancel" onClick={openEditor}>
        Change date
      </button>
      <button type="button" className="asof-banner__btn" onClick={goLive}>
        Show current
      </button>
    </div>
  )
}
