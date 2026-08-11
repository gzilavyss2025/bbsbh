import { useCallback } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useCopy } from '../../../../copy/copyContext.js'
import { saveCopyPatch } from '../../../../lib/admin/saveCopyPatch.js'
import { uploadBallparkArt } from '../../../../lib/admin/uploadBallparkArt.js'
import { fieldIds } from './useBallparkDraft.js'
import '../../../../styles/61-ballpark-admin.css'

// The owner's controls in the Ballpark card's masthead: a gear when idle, Save
// and Cancel while editing. The ONLY part of this feature that touches Clerk.
//
// It imports @clerk/clerk-react at the top level, so BallparkCard lazy-loads it
// and only when `isClerkEnabled` — the same shape as ProfileAccount, the cloud
// sync components, and every other Clerk-touching module here. Never a
// conditionally-called hook: the CONDITION is the render of this component, not
// a call inside it. On a deploy with no publishable key this file is never
// fetched at all, so the bundle a normal visitor downloads does not contain it.
//
// TWO GATES, AND ONLY ONE OF THEM IS REAL. `publicMetadata.role === 'admin'`
// below decides whether to DRAW the gear. It is convenience, not security — it
// is a value the client can read and therefore a value the client can lie
// about. The boundary is COPY_ADMIN_USER_IDS on the server (api/_lib/adminAuth
// .js), checked on both writes this component makes. Someone who forged the
// role would get a gear that produced 403s.

function GearButton({ onClick }) {
  return (
    <button type="button" className="bpadmin__gear" onClick={onClick} title="Edit this ballpark">
      {/* A gear, drawn rather than imported: the app ships no icon set, and
          eight teeth on two circles is smaller than a font subset would be.
          aria-hidden because the button's own label already names the action. */}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.8a.5.5 0 0 0 .1.6L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
        />
      </svg>
      <span className="sr-only">Edit this ballpark</span>
    </button>
  )
}

export function BallparkAdminBar({ parkKey, draft, saved }) {
  const { isLoaded, user } = useUser()
  const { getToken } = useAuth()
  const { applyOverrides } = useCopy()
  const { busy, error } = draft.status

  const save = useCallback(async () => {
    draft.setStatus({ busy: true, error: '' })
    try {
      // Images first. An upload that fails must leave the copy store untouched,
      // so the URL-bearing fields are only assembled once every byte is stored —
      // a half-saved park pointing at an image that never landed would render a
      // broken photo and look like data loss.
      //
      // `replaces` is the SAVED url, not the draft one: it names the object this
      // save makes obsolete, and taking it from the draft would ask the endpoint
      // to delete something the owner has not committed to replacing yet.
      const next = { ...draft.values }
      for (const kind of ['photo', 'wordmark']) {
        const file = draft.files[kind]
        if (!file) continue
        next[kind] = await uploadBallparkArt(getToken, { parkKey, kind, file, replaces: saved[kind] })
      }

      // Every one of this park's fields goes into the patch, including the empty
      // ones — an empty value is how the owner CLEARS an override, and omitting
      // it would silently make clearing impossible. mergeOverrides turns '' into
      // a deletion and leaves every field outside this park alone.
      const ids = fieldIds(parkKey)
      const patch = {}
      for (const [slot, id] of Object.entries(ids)) patch[id] = next[slot] || ''

      const stored = await saveCopyPatch(getToken, patch)
      // Hand the server's map straight back to the running app, so the change is
      // on screen now instead of after the public GET's 60-second cache ages out.
      applyOverrides(stored)
      draft.commit(next)
    } catch (caught) {
      draft.setStatus({ busy: false, error: caught?.message || 'the save did not go through' })
    }
  }, [draft, getToken, parkKey, saved, applyOverrides])

  // Clerk still resolving, or not the owner: no gear, no gap where one would be.
  if (!isLoaded || user?.publicMetadata?.role !== 'admin') return null

  if (!draft.editing) return <GearButton onClick={draft.start} />

  return (
    <span className="bpadmin__actions">
      <button type="button" className="bpadmin__btn" onClick={draft.cancel} disabled={busy}>
        Cancel
      </button>
      <button
        type="button"
        className="bpadmin__btn bpadmin__btn--save"
        onClick={save}
        disabled={busy || !draft.dirty}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      {/* The failure itself is printed in the form below, where a sentence
          fits. This only has to say that something went wrong to someone whose
          eyes are on the button they just pressed. */}
      {error && (
        <span className="bpadmin__flag" role="status">
          Not saved
        </span>
      )}
    </span>
  )
}
