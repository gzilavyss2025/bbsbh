// Getting the overlay into a running app: a synchronous localStorage read before
// the first paint, then a revalidating fetch. The same two-step CopyProvider
// uses, for the same reason and one sharper one.
//
// WHY THE CACHE IS NOT OPTIONAL HERE. A late copy override is a wording lag — a
// sentence changes a second after the page settles and nobody notices. A late
// IDENTITY override is a club's mark visibly jumping: the untuned tile paints,
// then rescales and shifts when the fetch lands. So the cached map is applied
// synchronously, before `createRoot`, and a returning visitor paints tuned art
// on the first frame. A first-time visitor still gets the one repaint, which is
// the honest floor — there is nothing to paint from until the answer arrives.
//
// Everything here degrades to "no overrides": no store on this deploy, no
// network, private mode with storage disabled, or a corrupted cache all end at
// the shipped JSON, which is the app this repo has always been able to be.

import { setIdentityOverrides } from './overlay.js'
import { sanitizeIdentityOverrides } from './fields.js'
import { localStore } from '../account/localStore.js'

// A cache from a build whose field catalog has since changed throws in parse and
// reads as "nothing cached" (parse(null)); the shipped JSON stands.
const cache = localStore(
  'bbsbh:identityOverrides',
  (raw) => (raw ? sanitizeIdentityOverrides(JSON.parse(raw)) : null),
  JSON.stringify,
)

// Apply whatever this browser saw last. Call it BEFORE the first render —
// main.jsx does, above `mount()`.
export function hydrateIdentityFromCache() {
  const cached = cache.read()
  if (cached) setIdentityOverrides(cached)
}

export const cacheIdentityOverrides = cache.write

// Revalidate against the API and adopt the answer. Deliberately swallows
// everything: an unconfigured deploy answers 501 and an offline one answers
// nothing, and both are supported states rather than errors — the same contract
// every other narrow backend exception here keeps.
export async function refreshIdentityOverrides() {
  try {
    const res = await fetch('/api/identity')
    if (!res.ok) return
    const data = await res.json()
    const clean = sanitizeIdentityOverrides(data?.identity)
    setIdentityOverrides(clean)
    cacheIdentityOverrides(clean)
  } catch {
    // Offline, or no identity store on this deploy. The cached (or shipped)
    // values already in the overlay stand.
  }
}
