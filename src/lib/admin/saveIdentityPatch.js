// Save a few club-identity fields without disturbing the rest — the sibling of
// saveCopyPatch.js, and it inherits that file's hard-won rule.
//
// THE RULE: SEND ONLY WHAT THIS EDIT MEANS TO CHANGE, AND LET THE SERVER MERGE.
// The obvious alternative is a read-merge-write from the browser — GET the
// current map, layer these fields on, send the whole thing back — and it cannot
// be made correct. `GET /api/identity` is CDN-cached (`s-maxage=60,
// stale-while-revalidate=600`), and `cache: 'no-store'` on a fetch governs the
// BROWSER's cache, not the shared edge. Production served the copy store's
// equivalent read `X-Vercel-Cache: STALE, Age: 238`, and every field missing
// from that stale map was then deleted; two saves inside the window meant the
// second silently erased the first. It cost a run of ballpark photos. The merge
// therefore lives in the endpoint, where the read is Redis itself and happens
// inside the request that writes — ADR-0025's amendment.
//
// So `/api/identity` accepts a PATCH BODY AND NOTHING ELSE. There is no "full
// map" form here even though /api/copy has one: /admin holds every copy field on
// screen and can honestly claim to know the complete state, while a drawer for
// one club never can. Accepting a full map would have made one club's drawer
// able to erase all thirty.
//
// Still last-write-wins per FIELD, which with one site owner is the right trade.

import { sanitizeIdentityOverrides } from '../identity/fields.js'

// `patch` is `{ fieldId: value }` for the fields being changed. A value of ''
// clears that field; a field not named is left exactly as it is. Resolves to the
// full stored map the server echoed back — hand it to `setIdentityOverrides` so
// the page shows the change at once instead of waiting out the CDN cache on the
// public GET.
//
// Throws with a message worth showing a human. Four failures actually happen: a
// signed-out session (403), a deploy with no identity store (501), a save the
// endpoint refused on its merits (422 — a header triad under WCAG AA, or a value
// the shared store validator rejected), and the network being gone. The 422 is
// the one whose text is worth relaying verbatim; it names the club, the bar and
// the ratio.
export async function saveIdentityPatch(getToken, patch) {
  const token = await getToken()
  if (!token) throw new Error('you are signed out — sign in again to save')

  const res = await fetch('/api/identity', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ patch }),
  })
  if (res.status === 403) throw new Error('this account is not on the admin list')
  if (res.status === 501) throw new Error('the identity store is not configured on this deploy')
  if (res.status === 422) {
    const reason = await res
      .json()
      .then((body) => body?.error)
      .catch(() => null)
    throw new Error(reason || 'the endpoint refused this tuning — nothing was changed')
  }
  if (!res.ok) throw new Error('the save did not go through — nothing was changed')
  return sanitizeIdentityOverrides((await res.json())?.identity)
}
