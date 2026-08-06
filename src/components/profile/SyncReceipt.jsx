import { useState } from 'react'
import { claimsForChannel } from '../../lib/account/syncClaims.js'
import { SYNC_CHANNELS, lastSyncedAt } from '../../lib/account/syncStatus.js'

// The sync receipt — a carbon-copy slip: one ruled row per thing an account
// carries, each naming THE THING rather than the mechanism, and each saying
// where it currently lives.
//
// Rendered FROM `SYNCED_ITEMS` (src/lib/account/syncClaims.js), never from a
// hand-written list. That array is the claims ledger and test/sync-claims.test.js
// asserts every entry names a sync module that exists — so a row can only appear
// here once the wire behind it has actually shipped. Copy that outruns the
// implementation is a promise the app breaks quietly, months later, on somebody
// else's second device; this is the guard against writing one.
//
// **Nothing in this receipt is a score, a game, or a club's result.** It is five
// short labels and a clock. There is no room in a channel record
// (`{ phase, at, syncedAt, reason }`) for anything else, by construction.
//
// WHY THIS EXISTS AT ALL. Every sync component in this app swallows its own
// errors and leaves localStorage authoritative. That is correct — it is the
// offline-first contract — and it is also exactly how ADR-0022's total
// production failure hid for weeks. The catches stay; they just stop being
// silent, and this is where a user can finally see the answer.

// Relative only, and deliberately coarse. An absolute timestamp invites the
// reader to diagnose, and there is nothing here for them to fix — every channel
// re-pulls on focus already (which is also why a per-channel "sync now" button
// was considered and cut: a button that usually does nothing teaches people the
// feature is unreliable).
function relativeTime(at, now) {
  if (!Number.isInteger(at) || at <= 0) return null
  const secs = Math.max(0, Math.round((now - at) / 1000))
  if (secs < 90) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 12) return `${hours} hr ago`
  if (hours < 36) return 'earlier today'
  return 'a while ago'
}

// One row's sentence, from that channel's phase. `local` and `off` are not
// failures and must never read as one — "On this device." is the plain, true,
// un-alarming statement of where the thing is, and it is the sentence the whole
// signed-out experience is built on (PRD §1.1).
function stateFor(channel, now) {
  const phase = channel?.phase ?? 'off'
  if (phase === 'synced') {
    const rel = relativeTime(channel.syncedAt, now)
    return {
      tone: 'synced',
      text: rel ? `Carried across your devices. Last checked ${rel}.` : 'Carried across your devices.',
    }
  }
  if (phase === 'pulling') return { tone: 'pulling', text: 'Checking with your account…' }
  if (phase === 'unavailable') {
    return { tone: 'unavailable', text: 'Sync is not available on this deployment.' }
  }
  if (phase === 'error') {
    const rel = relativeTime(channel.syncedAt, now)
    return {
      tone: 'error',
      // The one moment "last checked" is worth reading — which is why
      // syncStatus.js keeps `syncedAt` separate from `at`.
      text: rel
        ? `Your account could not be reached. Last carried ${rel}.`
        : 'Your account could not be reached.',
    }
  }
  return { tone: 'local', text: 'On this device.' }
}

export function SyncReceipt({ status }) {
  // Read once, in a lazy initializer — `Date.now()` in the render body is an
  // impure call and the purity lint rule is right to refuse it. Freezing the
  // clock at mount is also the better answer here: these phrases are
  // deliberately coarse ("just now", "2 min ago"), a settings page is not
  // left open for hours, and a ticking clock would repaint the receipt for no
  // information gained. A sync that lands after mount reads "just now", which
  // is what `Math.max(0, …)` in relativeTime is for.
  const [now] = useState(() => Date.now())
  // The one absolute-ish fact worth a line of its own: when ANY channel last
  // succeeded. Kept here rather than in the section above so there is exactly
  // one relative-time formatter on this page.
  const last = relativeTime(lastSyncedAt(status), now)
  return (
    <>
      <ul className="syncreceipt">
        {SYNC_CHANNELS.map((channel) => {
          const claims = claimsForChannel(channel)
          if (claims.length === 0) return null
          const state = stateFor(status?.[channel], now)
          // One row per CHANNEL, not per claim. `reveal` backs two claims
          // ("Reveal progress" and "Pick up your pencil"), and mapping the
          // ledger directly rendered them as two rows showing byte-identical
          // state — a receipt is one line per thing that syncs, and those two
          // are one thing. PRD §5.2 specifies four rows.
          return (
            <li key={channel} className="syncreceipt__row" data-tone={state.tone}>
              <span className="syncreceipt__mark" aria-hidden="true" />
              <span className="syncreceipt__body">
                <span className="syncreceipt__label">{claims[0].label}</span>
                <span className="syncreceipt__state caps-exempt">{state.text}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {last && (
        <p className="syncreceipt__last caps-exempt">
          Last carried across your devices {last}.
        </p>
      )}
    </>
  )
}
