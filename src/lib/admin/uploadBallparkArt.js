// Compress a chosen file and put it in the project's blob store, returning the
// URL that goes into the copy field. The client half of api/ballpark-photo.js.
//
// The two kinds are not symmetric and the differences are deliberate — see
// compressImage.js for why a wordmark stays PNG and a photograph does not, and
// the KINDS table in the endpoint for the byte ceilings these mirror. Keeping
// the numbers in both places is on purpose: the browser needs them to know what
// to compress TO, and the server cannot trust a client to have done it.

import { compressImage } from './compressImage.js'

const KINDS = {
  photo: { maxWidth: 1600, maxBytes: 1_500_000, transparent: false },
  // A wordmark is lettering. 1000px across is more than the card's title slot
  // will ever render it at, even on a 3x screen.
  wordmark: { maxWidth: 1000, maxBytes: 400_000, transparent: true },
}

// `replaces` is the URL this upload supersedes, so the endpoint can delete the
// object it makes obsolete. Passing the CURRENTLY SAVED value (not the one from
// an earlier unsaved pick) is what keeps that safe — the endpoint only deletes
// URLs in our own store, and only after the new object is written.
export async function uploadBallparkArt(getToken, { parkKey, kind, file, replaces = '' }) {
  const spec = KINDS[kind]
  if (!spec) throw new Error(`unknown kind: ${kind}`)

  const { blob, contentType } = await compressImage(file, spec)

  const token = await getToken()
  if (!token) throw new Error('you are signed out — sign in again to upload')

  const params = new URLSearchParams({ key: parkKey, kind })
  if (replaces) params.set('replaces', replaces)

  const res = await fetch(`/api/ballpark-photo?${params}`, {
    method: 'POST',
    headers: { 'content-type': contentType, authorization: `Bearer ${token}` },
    body: blob,
  })
  if (res.status === 501) throw new Error('image uploads are not configured on this deploy')
  if (res.status === 403) throw new Error('this account is not on the admin list')
  if (!res.ok) {
    // The endpoint's messages (too large, not a JPEG or PNG, unknown ballpark)
    // are written to be read by a person, so pass them through when there is
    // one rather than flattening every failure into "upload failed".
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.error || 'the upload did not go through')
  }
  const { url } = await res.json()
  if (!url) throw new Error('the upload returned no URL')
  return url
}
