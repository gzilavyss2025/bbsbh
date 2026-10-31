import { useEffect, useRef, useState } from 'react'
import { compressImage } from '../../lib/admin/compressImage.js'
import { MAX_PHOTOS, loadPhotos, savePhotos, withPhoto, withoutPhoto } from '../../lib/scorecard-photos/store.js'

// Photos of your paper scorecard for one stamped game (#2511), in the Game Log's selected-stamp
// panel. Device only: compressed here, kept in this browser's IndexedDB, never uploaded. A photo
// may show the score, so this renders only on the Game Log (check-stamp-surfaces.mjs).
// About 400 KB a photo at 1600 px: pencil stays legible and four fit easily on a phone.
const COMPRESS = { maxWidth: 1600, maxBytes: 400_000 }

export function ScorecardPhotos({ gamePk }) {
  // { pk, photos, urls }: the loaded game's photos and one object URL each. A state for another
  // game reads as still loading, so a stamp switch never shows the last stamp's pages.
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState(null)
  const input = useRef(null)
  const photos = state?.pk === gamePk ? state.photos : null
  const urls = state?.pk === gamePk ? state.urls : {}

  const show = (list) => setState({ pk: gamePk, photos: list, urls: urlsFor(list) })

  useEffect(() => {
    let live = true
    loadPhotos(gamePk).then((list) => { if (live) setState({ pk: gamePk, photos: list, urls: urlsFor(list) }) })
    return () => { live = false }
  }, [gamePk])
  // Each set of object URLs is revoked when it is replaced or the panel closes.
  useEffect(() => () => { for (const u of Object.values(state?.urls ?? {})) URL.revokeObjectURL(u) }, [state])

  const add = async (file) => {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const { blob } = await compressImage(file, COMPRESS)
      const next = withPhoto(photos ?? [], { id: Date.now(), blob, addedAt: Date.now() })
      if (await savePhotos(gamePk, next)) show(next)
      else setError('This browser could not save the photo.')
    } catch (e) {
      setError(e?.message || 'That photo could not be read.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    const next = withoutPhoto(photos ?? [], id)
    if (await savePhotos(gamePk, next)) show(next)
  }

  if (photos === null) return null
  const full = photos.length >= MAX_PHOTOS
  return (
    <div className="scphotos">
      <p className="scphotos__label">Scorecard photos</p>
      {photos.length > 0 && (
        <ul className="scphotos__grid">
          {photos.map((p, i) => (
            <li key={p.id} className="scphotos__item">
              <button type="button" className="scphotos__thumb" onClick={() => setViewing(p.id)} aria-label={`Open scorecard photo ${i + 1}`}>
                {urls[p.id] && <img src={urls[p.id]} alt="" />}
              </button>
              <button type="button" className="scphotos__remove" onClick={() => remove(p.id)} aria-label={`Remove scorecard photo ${i + 1}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { add(e.target.files?.[0]); e.target.value = '' }} />
      <button type="button" className="btn btn--ghost" disabled={busy || full} onClick={() => input.current?.click()}>
        {busy ? 'Saving…' : full ? `${MAX_PHOTOS} of ${MAX_PHOTOS} photos` : 'Add a photo of your scorecard'}
      </button>
      <p className="scphotos__note">
        {error || 'Kept in this browser only. Export them from My Tally.'}
      </p>
      {viewing && urls[viewing] && (
        <div className="scrim scrim--center" onClick={() => setViewing(null)}>
          <img className="scphotos__full" src={urls[viewing]} alt="Your scorecard page" />
        </div>
      )}
    </div>
  )
}

function urlsFor(list) {
  const out = {}
  for (const p of list) out[p.id] = URL.createObjectURL(p.blob)
  return out
}
