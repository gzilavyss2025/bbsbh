import { useCallback } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { setIdentityOverrides } from '../../../../lib/identity/overlay.js'
import { cacheIdentityOverrides } from '../../../../lib/identity/hydrate.js'
import { saveIdentityPatch } from '../../../../lib/admin/saveIdentityPatch.js'
import { identityDraftRefusal, identityIdsForClub } from './identityFields.js'
import '../../../../styles/62-identity-admin.css'

// The owner's controls at the right end of the team hub header: a gear when
// idle, Save and Cancel while editing. The ONLY part of this feature that
// touches Clerk.
//
// It imports @clerk/clerk-react at the top level, so TeamHubShell lazy-loads it
// and only when `isClerkEnabled` — the same shape as BallparkAdminBar,
// ProfileAccount, the cloud sync components, and every other Clerk-touching
// module here. Never a conditionally-called hook: the CONDITION is the render of
// this component, not a call inside it. On a deploy with no publishable key this
// file is never fetched, so the bundle a normal visitor downloads does not
// contain it — nor, through it, the field catalog or the drawer.
//
// TWO GATES, AND ONLY ONE OF THEM IS REAL. `publicMetadata.role === 'admin'`
// below decides whether to DRAW the gear. It is convenience, not security — a
// value the client can read is a value the client can lie about. The boundary is
// COPY_ADMIN_USER_IDS on the server (api/_lib/adminAuth.js), checked on the one
// write this component makes. Someone who forged the role would get a gear that
// produced 403s.

function GearButton({ onClick, label }) {
  return (
    <button type="button" className="idadmin__gear" onClick={onClick} title={label}>
      {/* The same drawn gear BallparkAdminBar uses — the app ships no icon set,
          and eight teeth on two circles is smaller than a font subset would be.
          aria-hidden because the button's own label already names the action. */}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7.6 7.6 0 0 0-1.7-1l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1a.5.5 0 0 0-.6.2L2.5 8.8a.5.5 0 0 0 .1.6L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function IdentityAdminBar({ teamId, isMilb, draft }) {
  const { isLoaded, user } = useUser()
  const { getToken } = useAuth()
  const { busy, error } = draft.status

  const save = useCallback(async () => {
    // Refuse a failing header triad HERE, before a request — instantly, with the
    // ratio, while the bar it is talking about is on screen. The endpoint runs
    // the identical check and is what actually decides; this is the courtesy
    // half of a two-sided gate, not a replacement for it.
    const refusal = identityDraftRefusal(teamId, isMilb)
    if (refusal) {
      draft.setStatus({ busy: false, error: refusal })
      return
    }

    draft.setStatus({ busy: true, error: '' })
    try {
      // EVERY id this club owns goes into the patch, including the empty ones —
      // an empty value is how the owner CLEARS an override back to what ships,
      // and omitting it would silently make clearing impossible. The merge
      // leaves every field outside this club alone, which is the property that
      // stops one club's drawer erasing another's tuning.
      const patch = {}
      for (const id of identityIdsForClub(teamId, isMilb)) patch[id] = draft.values[id] || ''

      const stored = await saveIdentityPatch(getToken, patch)
      // Hand the server's map straight back to the running app, so the change is
      // on screen now rather than after the public GET's 60-second cache ages
      // out — the same hand-back CopyProvider's applyOverrides does. Cached too,
      // so the next cold load paints tuned art on its first frame.
      setIdentityOverrides(stored)
      cacheIdentityOverrides(stored)
      draft.commit()
    } catch (caught) {
      draft.setStatus({ busy: false, error: caught?.message || 'the save did not go through' })
    }
  }, [draft, getToken, teamId, isMilb])

  // Clerk still resolving, or not the owner: no gear, no gap where one would be.
  if (!isLoaded || user?.publicMetadata?.role !== 'admin') return null

  if (!draft.editing) return <GearButton onClick={draft.start} label="Edit this club's identity" />

  return (
    <span className="idadmin__actions">
      <button type="button" className="idadmin__btn" onClick={draft.cancel} disabled={busy}>
        Cancel
      </button>
      <button
        type="button"
        className="idadmin__btn idadmin__btn--save"
        onClick={save}
        disabled={busy || !draft.dirty}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      {/* The failure itself is printed in the drawer below, where a sentence
          fits. This only has to say that something went wrong to someone whose
          eyes are on the button they just pressed. */}
      {error && (
        <span className="idadmin__flag" role="status">
          Not saved
        </span>
      )}
    </span>
  )
}
