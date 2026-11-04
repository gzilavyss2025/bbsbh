// The one authed admin request behind saveCopyPatch / saveIdentityPatch /
// saveContractIdentityPatch: they differ only in URL, method, the human text for
// each failure, and what they do with the answer. Returns the parsed JSON body.
//
// `messages` is `{ [status]: text, fail?: text }`; any status keyed there throws
// that text, a function value gets the Response and returns the text (async ok),
// and `fail` covers every other non-2xx. A signed-out session (no token) and the
// 403 admin-list refusal read the same on every endpoint, so they live here.
export async function adminFetch(getToken, { url, method, body, messages }) {
  const token = await getToken()
  if (!token) throw new Error('you are signed out — sign in again to save')

  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (res.ok) return res.json()
  const m = messages[res.status] ?? (res.status === 403
    ? 'this account is not on the admin list'
    : 'the save did not go through — nothing was changed')
  throw new Error(typeof m === 'function' ? await m(res) : m)
}
