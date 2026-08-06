import { useState } from 'react'

// The post-sign-in merge receipt — shown once per (device, account), the first
// time this device's things become an account's things.
//
// WHY IT EXISTS. That moment is the one this whole subsystem needs to explain
// and the one it has always done silently. Invisible is how the spoiled-day
// backfill bug went unnoticed on the owner's own second device for weeks
// (ADR-0026, 2026-08-06): everything looked fine because nothing ever claimed
// to have happened. A receipt is cheap and it makes a silent merge legible.
//
// WHAT IT MAY SAY. Counts of the user's own things, and nothing else. Never a
// game, never a matchup, never a date's outcome, never a number that came out
// of a ballpark (PRD invariant P10). It renders no stamp art — no import of
// GameStamp.jsx, which the containment guard enforces for this whole directory.
//
// A line whose channel could not be reached is OMITTED rather than shown as
// zero: a zero is a claim about your collection, an omission is not.
//
// Never a modal, never blocking, never a notification.

const KEY_PREFIX = 'bbsbh:mergeReceipt:'

function seen(userId) {
  try {
    return Boolean(window.localStorage.getItem(KEY_PREFIX + userId))
  } catch {
    // Storage unreadable — show it, at worst once per visit. The failure a
    // one-shot flag protects against is nagging, not a spoiler.
    return false
  }
}

function markSeen(userId) {
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, String(Date.now()))
  } catch {
    // Private mode. Dismissal still applies for this session via state below.
  }
}

// `lines` is `[{ id, text }]`, already filtered by the caller — it is the only
// party that knows which channels answered.
export function MergeReceipt({ userId, lines = [] }) {
  // Read once, at mount. Re-reading on every render would fight the dismissal
  // below, and this flag never changes underneath us.
  const [dismissed, setDismissed] = useState(() => seen(userId))
  if (dismissed || !userId || lines.length === 0) return null

  return (
    <aside className="mergereceipt" aria-label="Your book is on this account now">
      <p className="mergereceipt__title">Your book is on this account now.</p>
      <ul className="mergereceipt__lines">
        {lines.map((line) => (
          <li key={line.id}>{line.text}</li>
        ))}
      </ul>
      <p className="mergereceipt__note caps-exempt">
        Nothing you had revealed changed. Everything here was already yours.
      </p>
      <button
        type="button"
        className="mergereceipt__dismiss"
        onClick={() => {
          markSeen(userId)
          setDismissed(true)
        }}
      >
        Got it
      </button>
    </aside>
  )
}
