// Save one or more contract-identity row corrections without disturbing any
// other row — the sibling of saveIdentityPatch.js, same shape, same reason:
// the merge happens on the server, against Redis itself, inside the request
// that writes (api/contract-identity.js), so a reviewer's stale view of the
// queue can never delete another reviewer's correction.
//
import { adminFetch } from './adminFetch.js'

// `patch` is `{ rowKey: { mlbId, dismissed?, note?, confidence?,
// originalConfidence? } | null }` — a value of `null` clears that row's
// override. `confidence: 'exact'` marks a human-confirmed match;
// `originalConfidence` is one of `'fuzzy' | 'ambiguous' | 'unresolved'`,
// the tier the automated pipeline assigned before that confirmation.
// Resolves to the full stored override map the server echoed back.
//
// Throws with a message worth showing a human: a signed-out session (403), a
// deploy with no override store configured (501), a patch the endpoint
// refused outright (422 — an unrecognized rowKey or an invalid value
// anywhere in the patch), and the network being gone.
export async function saveContractIdentityPatch(getToken, patch) {
  const data = await adminFetch(getToken, {
    url: '/api/contract-identity',
    method: 'PATCH',
    body: { patch },
    messages: {
      501: 'the contract-identity override store is not configured on this deploy',
      422: 'that correction was refused — nothing was changed',
    },
  })
  return data?.overrides ?? {}
}
