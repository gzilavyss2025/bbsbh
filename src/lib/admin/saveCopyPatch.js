// Save a FEW copy fields without disturbing the rest — what the inline editors
// need, and the one thing about /api/copy that is easy to get catastrophically
// wrong.
//
// THE TRAP. `POST /api/copy` with a `copy` body takes the FULL desired override
// map, not a patch: it diffs the body against what is stored and `hdel`s every
// key the body omits. That is correct for the /admin panel, which holds every
// field on screen and therefore always sends all of them. It is a loaded gun
// for an editor holding six ballpark fields — posting just those six would
// delete every Scores Unlocked and Stamp In override and all 29 other parks in
// one click, and the app would keep working perfectly, rendering shipped
// defaults, so nothing would look broken until somebody noticed.
//
// WHY THIS NO LONGER READS FIRST — the bug that rewrote this file. The obvious
// answer to the trap is a read-merge-write: GET the current map, layer these
// fields on top, POST the whole thing back. That is what this did, and it
// cannot be made correct from a browser. `GET /api/copy` is CDN-cached
// (`s-maxage=60, stale-while-revalidate=600`), and `cache: 'no-store'` on a
// fetch governs the BROWSER's cache, not the shared edge. Production served
// this read `X-Vercel-Cache: STALE, Age: 238` — a map nearly four minutes old.
// Every field missing from that stale map was then deleted by the POST as a
// `staleKey`, so a second save inside the window silently erased the first. It
// cost a run of ballpark photos, each of which uploaded fine and then vanished
// on the next park's save.
//
// So the merge moved to the server, where the read is Redis itself and happens
// inside the same request that writes. This function now sends ONLY the fields
// it means to change. It is smaller than the thing it replaces, and that is the
// point: the race is gone because the client no longer needs a coherent read of
// shared state through a cache it does not control. The merge rule itself lives
// in `mergeOverrides` (src/copy/registry.js), used by both ends.
//
// Still last-write-wins per FIELD, which with one site owner is the right
// trade — two tabs editing the same park's photo will not both win. What can no
// longer happen is two tabs editing DIFFERENT parks and one erasing the other.

import { sanitizeOverrides } from '../../copy/registry.js'

// `patch` is `{ fieldId: value }` for the fields being changed. A value of ''
// clears that field; a field not named is left exactly as it is. Resolves to
// the full stored map the server echoed back — hand it to `applyOverrides` from
// useCopy() so the page shows the change at once instead of waiting out the CDN
// cache on the public GET.
//
// Throws with a message worth showing a human. The three failures that actually
// happen are a signed-out session (403), a deploy with no copy store (501), and
// the network being gone, and each reads differently to whoever is standing in
// front of it.
export async function saveCopyPatch(getToken, patch) {
  const token = await getToken()
  if (!token) throw new Error('you are signed out — sign in again to save')

  const res = await fetch('/api/copy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ patch }),
  })
  if (res.status === 403) throw new Error('this account is not on the admin list')
  if (res.status === 501) throw new Error('the copy store is not configured on this deploy')
  if (!res.ok) throw new Error('the save did not go through — nothing was changed')
  return sanitizeOverrides((await res.json())?.copy)
}
