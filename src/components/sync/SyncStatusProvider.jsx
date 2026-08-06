import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { initialSyncState, reduceSync } from '../../lib/account/syncStatus.js'

// The React seam over src/lib/account/syncStatus.js — where the four headless
// sync components report what they are actually doing, and where My Tally's
// sync receipt reads it back.
//
// Mounted UNCONDITIONALLY in App.jsx. It touches no Clerk API of its own (the
// `enabled` flag is passed in), so unlike every other component in this
// directory it is safe on a deploy with no ClerkProvider — which matters,
// because the receipt has to be able to say "this deploy has no account
// feature" rather than rendering nothing at all.
//
// ---------------------------------------------------------------------------
// WHY AN EXTERNAL STORE AND NOT useState
// ---------------------------------------------------------------------------
// A provider holding useState re-renders its entire subtree on every state
// change — and this provider's subtree is the whole app. Sync events fire on
// every sign-in, every window focus, and every published change, none of which
// have any business repainting a game screen.
//
// So the state lives in a closure with a subscriber set, the provider itself
// never re-renders on a report, and only components that actually read the
// status (via useSyncStatusState) subscribe. `reduceSync` returning the SAME
// object when nothing changed is what makes that cheap: an unchanged phase
// re-reported on every focus notifies nobody.
function createSyncStore(enabled) {
  let state = initialSyncState(enabled)
  const listeners = new Set()
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    report(channel, phase, meta = {}) {
      const next = reduceSync(state, { channel, phase, at: Date.now(), ...meta })
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
  }
}

// An inert store for the case where no provider is mounted — a test rendering
// one component in isolation, or a future entry point that forgets. Reporting
// into it is a no-op and reading it says "off", which is the safest thing to
// claim about a mechanism that isn't running. Same degrade-quietly posture as
// the rest of this subsystem; nothing here is load-bearing enough to throw over.
const INERT = createSyncStore(false)

const SyncStatusContext = createContext(INERT)

export function SyncStatusProvider({ enabled = false, children }) {
  // Created once per mount. `enabled` is a build-time constant
  // (isClerkEnabled), so it never changes at runtime and the store never needs
  // rebuilding — but keying the memo on it keeps that honest rather than
  // assumed.
  const store = useMemo(() => createSyncStore(enabled), [enabled])
  return <SyncStatusContext.Provider value={store}>{children}</SyncStatusContext.Provider>
}

// The reporting half. Stable for the life of the provider, so a sync component
// can put it in an effect's dependency list without re-running the effect.
export function useSyncReport() {
  return useContext(SyncStatusContext).report
}

// The reading half. Only components that call this re-render when a channel
// changes.
export function useSyncStatusState() {
  const store = useContext(SyncStatusContext)
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
