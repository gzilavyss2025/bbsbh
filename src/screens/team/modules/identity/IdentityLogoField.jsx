import { useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { TeamTreatmentMark } from '../../../../components/logo/TeamTreatmentMark.jsx'
import {
  describeLogoCaveat,
  describeLogoRejection,
  LOGO_MAX_BYTES,
  LOGO_SIZE,
} from '../../../../lib/logoArt.js'

// The drawer's Logo art group for one (club, treatment): the tile as it renders
// right now, the Art URL box behind it, and the upload that fills that box.
//
// UPLOADING IS NOT SAVING — the discipline api/identity-logo.js (and
// ballpark-photo before it) is built on. A successful upload only writes the
// returned blob URL into the DRAFT, where the preview layer repaints the tile
// at once; nothing a visitor sees changes until the drawer's Save lands it
// through /api/identity like any other override. Cancel is genuinely a cancel.
//
// THIS FILE TOUCHES CLERK, second in this feature after IdentityAdminBar.jsx —
// the upload is an authenticated write, so it needs the same token the save
// uses. That is safe for the same structural reason the bar is: this component
// renders only inside the drawer, the drawer renders only while `editing`, and
// `editing` can only be set by the bar — which exists only behind
// isClerkEnabled, under the ClerkProvider main.jsx mounts on such a deploy.
// The drawer's whole chunk is lazy, so none of this reaches a visitor's bundle.
//
// The file is checked HERE first, against the same src/lib/logoArt.js rules the
// endpoint enforces (512x512 PNG under the cap), purely so a rejection is
// instant and specific — the server re-checks every byte and is what decides.

const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'

function isOwnBlobUrl(raw) {
  try {
    const url = new URL(String(raw))
    return url.protocol === 'https:' && url.hostname.endsWith(BLOB_HOST_SUFFIX)
  } catch {
    return false
  }
}

export function IdentityLogoField({ teamId, name, isMilb, treatment, field, value, savedValue, onChange }) {
  const { getToken } = useAuth()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const inputRef = useRef(null)
  const shown = value ?? ''

  async function handleFile(file) {
    if (!file) return
    setMessage(null)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const rejection = describeLogoRejection(bytes)
    if (rejection) {
      setMessage({ kind: 'error', text: `${file.name}: ${rejection}` })
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setBusy(true)
    try {
      const params = new URLSearchParams({ teamId: String(teamId), slot: treatment })
      // Re-uploading before saving replaces this draft's own abandoned blob —
      // and ONLY that. A URL the saved override still points at is never sent,
      // so nothing a device is rendering can be deleted out from under it.
      if (shown && shown !== (savedValue || '') && isOwnBlobUrl(shown)) params.set('replaces', shown)
      const token = await getToken()
      const res = await fetch(`/api/identity-logo?${params}`, {
        method: 'POST',
        headers: { 'content-type': 'image/png', authorization: `Bearer ${token}` },
        body: bytes,
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({
          kind: 'error',
          text:
            body?.error ??
            (res.status === 404
              ? 'no upload endpoint here — under vite dev, use /identity-lab or paste a URL'
              : `the upload did not go through (${res.status})`),
        })
        return
      }
      onChange(field.id, body.url)
      const caveat = describeLogoCaveat(bytes)
      setMessage({
        kind: 'ok',
        text: `uploaded — the tile above is wearing it now; Save keeps it${caveat ? ` · ${caveat}` : ''}`,
      })
    } catch {
      setMessage({ kind: 'error', text: 'the upload did not go through — check the connection and retry' })
    } finally {
      setBusy(false)
      // Let the same file be picked twice in a row — a file input fires no
      // change event otherwise.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="iddrawer__logo">
      {/* The SAME component and resolver every real surface renders — the strip
          above shows it at thumb size, this one at judging size. It repaints
          from the draft's preview layer, so an upload or a pasted URL shows
          here (and on the whole page) before anything is saved. */}
      <TeamTreatmentMark
        teamId={teamId}
        name={name}
        treatment={isMilb ? undefined : treatment}
        side={isMilb ? treatment : undefined}
        size={96}
        block="iddrawer__logomark"
      />
      <div className="iddrawer__logocontrols">
        <label className="iddrawer__field" htmlFor={field.id}>
          <span className="iddrawer__label">{field.label}</span>
          <input
            id={field.id}
            className="iddrawer__input"
            type="text"
            value={shown}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.landed || '—'}
            spellCheck="false"
            autoComplete="off"
          />
        </label>
        <span className="iddrawer__logoactions">
          <input
            ref={inputRef}
            className="iddrawer__logofile"
            type="file"
            accept="image/png,.png"
            aria-label="Upload logo art for this tile"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="iddrawer__btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title={`A ${LOGO_SIZE}x${LOGO_SIZE} PNG under ${LOGO_MAX_BYTES / 1024} KB — the curated-art standard`}
          >
            {busy ? 'Uploading…' : 'Upload a PNG'}
          </button>
        </span>
        <p className="iddrawer__hint">
          {LOGO_SIZE}×{LOGO_SIZE} PNG, under {LOGO_MAX_BYTES / 1024} KB. An empty box means &ldquo;use
          what ships&rdquo;; a pasted https URL works too.
        </p>
        {message && (
          <p
            className={`iddrawer__note${message.kind === 'error' ? ' iddrawer__note--bad' : ''}`}
            role="status"
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
