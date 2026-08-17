import { useSyncExternalStore } from 'react'
import { identityVersion, subscribeIdentity } from './overlay.js'

// Re-render a React tree when the identity overlay changes.
//
// The overlay is module state read by pure resolvers, not React state, so
// nothing re-renders on its own when a save lands or the hydrating fetch
// answers. This is the one line that connects the two, and `useSyncExternalStore`
// is the right shape for it: an integer snapshot, so React bails out when the
// version has not moved, and no tearing between the tables and the tree.
//
// MOUNTED AT THE ROOT (src/App.jsx), on purpose. Identity paints everywhere —
// the slate's cards, the in-game masthead, a Logbook stamp — so a subscription
// scoped to the team hub would leave the rest of an already-rendered app showing
// untuned art until it happened to remount. It costs one re-render per overlay
// change, and there are exactly two in a normal session: the hydrating fetch,
// and a save.
//
// A React file in src/lib. That is not new — `nav.jsx` is the precedent — and it
// is better than the alternative of putting the subscription somewhere far from
// the store whose contract it depends on.
export function useIdentityVersion() {
  return useSyncExternalStore(subscribeIdentity, identityVersion, identityVersion)
}
