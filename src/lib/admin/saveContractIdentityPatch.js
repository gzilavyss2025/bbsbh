// Save one or more contract-identity row corrections without disturbing any
// other row — the sibling of saveIdentityPatch.js, same shape, same reason:
// the merge happens on the server, against Redis itself, inside the request
// that writes (api/contract-identity.js), so a reviewer's stale view of the
// queue can never delete another reviewer's correction.
//
// `patch` is `{ rowKey: { mlbId, dismissed?, note? } | null }` — a value of
// `null` clears that row's override. Resolves to the full stored override
// map the server echoed back.
//
// Throws with a message worth showing a human: a signed-out session (403), a
// deploy with no override store configured (501), a patch the endpoint
// refused outright (422 — an unrecognized rowKey or an invalid value
// anywhere in the patch), and the network being gone.
export async function saveContractIdentityPatch(getToken, patch) {
  const token = await getToken()
  if (!token) throw new Error('you are signed out — sign in again to save')

  const res = await fetch('/api/contract-identity', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ patch }),
  })
  if (res.status === 403) throw new Error('this account is not on the admin list')
  if (res.status === 501) throw new Error('the contract-identity override store is not configured on this deploy')
  if (res.status === 422) throw new Error('that correction was refused — nothing was changed')
  if (!res.ok) throw new Error('the save did not go through — nothing was changed')
  return (await res.json())?.overrides ?? {}
}
