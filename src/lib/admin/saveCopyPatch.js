// Save a FEW copy fields without disturbing the rest — the read-merge-write the
// inline editors need, and the one thing about /api/copy that is easy to get
// catastrophically wrong.
//
// THE TRAP. POST /api/copy takes the FULL desired override map, not a patch. It
// diffs the body against what is stored and `hdel`s every key the body omits.
// That is correct for the admin panel, which holds every field on screen and
// therefore always sends all of them. It is a loaded gun for an editor that
// holds six ballpark fields: posting just those six would delete every Scores
// Unlocked and Stamp In override, and all 29 other parks, in one click — and
// the app would keep working perfectly, rendering shipped defaults, so nothing
// would look broken until somebody noticed their wording was gone.
//
// So a partial save must re-read the current map, layer its own fields on top,
// and send the whole thing back. That is what this does, and it is why the
// merge lives in one exported function with a test on it rather than inline in
// a component.
//
// The read is `no-store` DELIBERATELY. The public GET is CDN-cached for 60
// seconds, and merging into a cached map would resurrect fields somebody
// deleted a moment ago — a stale read here does not cause a stale write, it
// causes a WRONG one.
//
// This is last-write-wins across tabs, like the admin panel it sits beside.
// With one site owner that is the right trade; a compare-and-set would add a
// failure mode to a form that is used a few times a month.

import { sanitizeOverrides } from '../../copy/registry.js'

// Layer `patch` over `current`. A patch value of '' means CLEAR THIS FIELD, so
// it is dropped from the result rather than stored — matching sanitizeOverrides,
// which already treats an empty string as "no override, use the default". A key
// absent from the patch is left exactly as it was; that is the whole point.
export function mergeOverrides(current, patch) {
  const merged = { ...sanitizeOverrides(current) }
  for (const [id, value] of Object.entries(patch || {})) {
    if (typeof value === 'string' && value.trim()) merged[id] = value.trim()
    else delete merged[id]
  }
  return sanitizeOverrides(merged)
}

// Read, merge, write. Resolves to the stored map the server echoed back — hand
// it to `applyOverrides` from useCopy() so the page shows the change at once
// instead of waiting out the CDN cache.
//
// Throws with a message worth showing a human. The three failures that actually
// happen are a signed-out session (403), a deploy with no copy store (501), and
// the network being gone, and each reads differently to whoever is standing in
// front of it.
export async function saveCopyPatch(getToken, patch) {
  const read = await fetch('/api/copy', { cache: 'no-store' })
  if (!read.ok) throw new Error('could not read the current copy — nothing was changed')
  const current = (await read.json())?.copy

  const token = await getToken()
  if (!token) throw new Error('you are signed out — sign in again to save')

  const res = await fetch('/api/copy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ copy: mergeOverrides(current, patch) }),
  })
  if (res.status === 403) throw new Error('this account is not on the admin list')
  if (res.status === 501) throw new Error('the copy store is not configured on this deploy')
  if (!res.ok) throw new Error('the save did not go through — nothing was changed')
  return sanitizeOverrides((await res.json())?.copy)
}
