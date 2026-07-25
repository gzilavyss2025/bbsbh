import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { FIELDS, GROUPS, defaultCopy, fillTokens, sanitizeOverrides } from '../copy/registry.js'
import { ConsentModal } from '../components/ConsentModal.jsx'
import { makePreviewResolver } from '../copy/previewResolver.js'
import { formatResetTime, nextResetAt } from '../lib/scoresUnlocked.js'

// The admin copy editor (route: /admin, unlinked). Lets the site owner tune the
// wording — and the humor — of the spoiler-consent pop-ups without a deploy.
// Reads/writes the global copy store via /api/copy. Access is gated twice: this
// UI only unlocks for a signed-in Clerk user whose publicMetadata.role is
// 'admin', and the API independently enforces a server-side allowlist — so this
// client check is convenience, not the security boundary.
//
// The store is never required: on a deploy with no Clerk / no copy store, this
// page shows a "not configured" notice and the rest of the app runs on shipped
// defaults exactly as before.

// A sample reset time for the live previews — the real modal fills {time} with
// the user's actual next-8am. Kept literal here so the preview is deterministic.
const PREVIEW_TIME = '8:00 AM'

function Shell({ onBack, children }) {
  return (
    <div className="screen admincopy">
      <SiteHeader />
      <header className="topbar">
        <button className="topbar__back" onClick={onBack}>
          ‹ Games
        </button>
        <h1 className="topbar__title">Copy editor</h1>
      </header>
      {children}
    </div>
  )
}

function Notice({ children }) {
  return <p className="admincopy__notice">{children}</p>
}

// A small non-interactive rendering of a consent modal, so the admin sees the
// wording in context as they edit it.
function ModalPreview({ values, ids }) {
  const line = (id) => fillTokens(values[id] ?? '', { time: PREVIEW_TIME })
  return (
    <div className="admincopy__preview" aria-hidden="true">
      <div className="admincopy__previewCard">
        <h4 className="admincopy__previewTitle">{line(ids.title)}</h4>
        <p className="admincopy__previewBody">{line(ids.body)}</p>
        {line(ids.humorLine) && <p className="admincopy__previewHumor">{line(ids.humorLine)}</p>}
        {line(ids.changesNote) && <p className="admincopy__previewBody">{line(ids.changesNote)}</p>}
        <p className="admincopy__previewReset">{line(ids.resetNote)}</p>
        <div className="admincopy__previewButtons">
          <span className="admincopy__previewBtn admincopy__previewBtn--dismiss">
            {line(ids.dismiss)}
          </span>
          <span className="admincopy__previewBtn admincopy__previewBtn--confirm">
            {line(ids.confirm)}
          </span>
        </div>
      </div>
    </div>
  )
}

function Field({ field, value, onChange, onReset }) {
  const defaults = field.default
  const isDefault = (value ?? '') === defaults || (value ?? '') === ''
  const count = (value ?? '').length
  const over = count > field.maxLength
  const Input = field.multiline ? 'textarea' : 'input'
  return (
    <div className="admincopy__field">
      <label className="admincopy__label" htmlFor={`copy-${field.id}`}>
        {field.label}
      </label>
      <p className="admincopy__help">{field.help}</p>
      <Input
        id={`copy-${field.id}`}
        className="admincopy__input"
        value={value ?? ''}
        rows={field.multiline ? 3 : undefined}
        onChange={(e) => onChange(field.id, e.target.value)}
      />
      <div className="admincopy__fieldMeta">
        <span className={over ? 'admincopy__count admincopy__count--over' : 'admincopy__count'}>
          {count} / {field.maxLength}
        </span>
        <button
          type="button"
          className="admincopy__reset"
          disabled={isDefault}
          onClick={() => onReset(field.id)}
        >
          Reset to default
        </button>
      </div>
    </div>
  )
}

// Version history — the last few saved states, newest first. Restoring loads a
// past version into the boxes (leaving the editor dirty); the admin reviews and
// saves to apply it. Cheap recoverability for a solo owner iterating on copy.
function HistoryPanel({ history, onRestore, onClose }) {
  const fmt = (at) => {
    const t = Number(at)
    if (!Number.isFinite(t)) return 'unknown time'
    try {
      return new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    } catch {
      return 'unknown time'
    }
  }
  return (
    <section className="admincopy__history" aria-label="Version history">
      <div className="admincopy__historyHead">
        <h3 className="admincopy__historyTitle">Version history</h3>
        <button type="button" className="admincopy__history-open" onClick={onClose}>
          Close
        </button>
      </div>
      {history === 'loading' && <p className="admincopy__help">Loading…</p>}
      {Array.isArray(history) && history.length === 0 && (
        <p className="admincopy__help">No saved versions yet — history starts with your next save.</p>
      )}
      {Array.isArray(history) && history.length > 0 && (
        <ul className="admincopy__historyList">
          {history.map((entry, i) => {
            const count = entry?.copy ? Object.keys(entry.copy).length : 0
            return (
              <li key={`${entry?.at ?? 'x'}-${i}`} className="admincopy__historyItem">
                <span className="admincopy__historyWhen">{fmt(entry?.at)}</span>
                <span className="admincopy__historyCount">
                  {count ? `${count} custom` : 'all default'}
                </span>
                <button
                  type="button"
                  className="admincopy__reset"
                  onClick={() => onRestore(entry?.copy || {})}
                >
                  Restore
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// The editor body — only rendered for a confirmed admin, so Clerk hooks here
// always have a provider (main.jsx only mounts one when Clerk is enabled).
function Editor({ onDirty }) {
  const { getToken } = useAuth()
  const defaults = useMemo(defaultCopy, [])
  // values[id] is the current text in each box: an override, or the default.
  const [values, setValues] = useState(defaults)
  // The last-persisted override map — what's actually in the store. Used to
  // compute "dirty" and to seed the boxes; kept apart from `values` so a
  // restore-from-history can leave the editor dirty without lying about storage.
  const [baseline, setBaseline] = useState({})
  const [status, setStatus] = useState({ state: 'loading', message: 'Loading current copy…' })
  // null = history not loaded yet; [] = loaded, empty; [...] = entries.
  const [history, setHistory] = useState(null)
  // Which group's REAL ConsentModal is being previewed (group id), or null. The
  // preview renders the actual ConsentModal with a resolver built from the boxes
  // as they stand right now — unsaved edits included.
  const [preview, setPreview] = useState(null)
  // A sample {time} for the preview, computed once — the real modal fills it
  // with the viewer's own next-8am; this is a deterministic stand-in.
  const sampleTime = useMemo(() => formatResetTime(nextResetAt()), [])

  // Adopt a stored override map as the new ground truth: fills the boxes and
  // resets the dirty baseline to match.
  const adoptStored = useCallback(
    (overrides) => {
      const clean = sanitizeOverrides(overrides)
      setValues({ ...defaults, ...clean })
      setBaseline(clean)
    },
    [defaults],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // `no-store` is essential HERE (unlike the public CopyProvider fetch):
        // the editor must read the TRUE current state, never the browser's
        // 60s-cached public GET. Reading stale would make the next Save — which
        // replaces the whole map — silently revert fields the admin never touched.
        const res = await fetch('/api/copy', { cache: 'no-store' })
        const data = res.ok ? await res.json() : {}
        if (cancelled) return
        adoptStored(data?.copy)
        setStatus({ state: 'idle', message: '' })
      } catch {
        if (cancelled) return
        // Editable even if the GET failed — the boxes just start from defaults.
        setStatus({ state: 'idle', message: '' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [adoptStored])

  const onChange = useCallback((id, text) => {
    setValues((prev) => ({ ...prev, [id]: text }))
  }, [])

  const onReset = useCallback(
    (id) => {
      setValues((prev) => ({ ...prev, [id]: defaults[id] }))
    },
    [defaults],
  )

  // Only fields that differ from the shipped default are stored; sanitize drops
  // anything empty or over-budget, so the payload is exactly what the server
  // will persist.
  const overridePayload = useMemo(() => {
    const diff = {}
    for (const f of FIELDS) {
      const v = values[f.id]
      if (typeof v === 'string' && v.trim() && v !== f.default) diff[f.id] = v
    }
    return sanitizeOverrides(diff)
  }, [values])

  const anyOverLimit = FIELDS.some((f) => (values[f.id] ?? '').length > f.maxLength)

  // Dirty = the desired payload differs from what's actually stored. Drives the
  // unsaved-changes guard (parent) and the beforeunload warning.
  const dirty = useMemo(
    () => JSON.stringify(overridePayload) !== JSON.stringify(baseline),
    [overridePayload, baseline],
  )
  useEffect(() => {
    onDirty?.(dirty)
  }, [dirty, onDirty])
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = useCallback(async () => {
    setStatus({ state: 'saving', message: 'Saving…' })
    try {
      const token = await getToken()
      const res = await fetch('/api/copy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ copy: overridePayload }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        // Seed the boxes from what the server actually STORED (already trimmed +
        // sanitized), so the display matches storage exactly and dirty clears.
        adoptStored(data?.copy ?? overridePayload)
        setHistory(null) // stale now — reload next time it's opened
        setStatus({ state: 'saved', message: 'Saved. New visitors see it within a minute.' })
        return
      }
      if (res.status === 403) {
        setStatus({ state: 'error', message: 'This account is not on the copy-admin allowlist.' })
        return
      }
      if (res.status === 501) {
        setStatus({ state: 'error', message: 'The copy store is not configured on this deploy.' })
        return
      }
      setStatus({ state: 'error', message: `Save failed (${res.status}).` })
    } catch {
      setStatus({ state: 'error', message: 'Save failed — network error.' })
    }
  }, [getToken, overridePayload, adoptStored])

  const loadHistory = useCallback(async () => {
    setHistory('loading')
    try {
      const token = await getToken()
      const res = await fetch('/api/copy?history=1', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = res.ok ? await res.json() : {}
      setHistory(Array.isArray(data?.history) ? data.history : [])
    } catch {
      setHistory([])
    }
  }, [getToken])

  // Restore populates the boxes from a past version but deliberately does NOT
  // touch the baseline — so the editor goes dirty and the admin must review and
  // Save to actually apply it. No silent rewrite.
  const restore = useCallback((copy) => {
    setValues((prev) => ({ ...prev, ...defaults, ...sanitizeOverrides(copy) }))
    setStatus({ state: 'idle', message: 'Loaded a previous version — review, then Save to apply.' })
  }, [defaults])

  const overrideCount = Object.keys(overridePayload).length

  return (
    <div className="admincopy__body">
      <p className="admincopy__lede">
        Edit the wording of the spoiler-consent moments. Blank a box or tap Reset to fall back to
        the shipped default. Use <code>{'{time}'}</code> where the reset time should appear. Changes
        go live for everyone within about a minute of saving.
      </p>

      <div className="admincopy__savebar">
        <button
          type="button"
          className="admincopy__save"
          onClick={save}
          disabled={status.state === 'saving' || anyOverLimit || !dirty}
        >
          {dirty ? `Save${overrideCount ? ` (${overrideCount} custom)` : ''}` : 'Saved'}
        </button>
        <button type="button" className="admincopy__history-open" onClick={loadHistory}>
          Version history
        </button>
        {status.message && (
          <span className={`admincopy__status admincopy__status--${status.state}`}>
            {status.message}
          </span>
        )}
      </div>

      {history !== null && (
        <HistoryPanel history={history} onRestore={restore} onClose={() => setHistory(null)} />
      )}

      {GROUPS.map((group) => {
        const groupFields = FIELDS.filter((f) => f.group === group.id)
        const ids = Object.fromEntries(groupFields.map((f) => [f.id.split('.')[1], f.id]))
        return (
          <section key={group.id} className="admincopy__group" aria-label={group.label}>
            <div className="admincopy__groupHead">
              <h2 className="admincopy__groupTitle">{group.label}</h2>
              <button
                type="button"
                className="admincopy__previewOpen"
                onClick={() => setPreview(group.id)}
              >
                View real modal
              </button>
            </div>
            <div className="admincopy__groupGrid">
              <div className="admincopy__fields">
                {groupFields.map((f) => (
                  <Field
                    key={f.id}
                    field={f}
                    value={values[f.id]}
                    onChange={onChange}
                    onReset={onReset}
                  />
                ))}
              </div>
              <ModalPreview values={values} ids={ids} />
            </div>
          </section>
        )
      })}

      {/* The actual ConsentModal, rendered with a resolver built from the live
          box values (unsaved edits included) — a pixel-accurate rehearsal of
          what users will see, distinct from the always-on inline ModalPreview.
          Confirm/dismiss are no-ops here: previewing must never fire a real
          toggle or persist anything, it only closes. */}
      {preview && (
        <ConsentModal
          group={preview}
          time={sampleTime}
          resolveText={makePreviewResolver(preview, values, sampleTime)}
          onConfirm={() => setPreview(null)}
          onDismiss={() => setPreview(null)}
        />
      )}
    </div>
  )
}

// Gate: signed in? admin? Only then mount the Editor. Uses Clerk hooks, so it is
// only ever rendered under a ClerkProvider (see AdminCopyPage).
function AdminGate({ onDirty }) {
  const { isLoaded, isSignedIn, user } = useUser()
  if (!isLoaded) return <Notice>Checking your access…</Notice>
  if (!isSignedIn) {
    return <Notice>Sign in with an admin account to edit copy. Use the account button above.</Notice>
  }
  const role = user?.publicMetadata?.role
  if (role !== 'admin') {
    return (
      <Notice>
        This account is signed in but is not a copy admin. Ask for the <code>admin</code> role, or
        add this user id to the server allowlist.
      </Notice>
    )
  }
  return <Editor onDirty={onDirty} />
}

export function AdminCopyPage({ onBack }) {
  useDocumentTitle('Copy editor')
  // Track unsaved edits so leaving via the in-app back button can confirm first
  // (the beforeunload handler in Editor covers tab-close/reload separately).
  const dirtyRef = useRef(false)
  const guardedBack = useCallback(() => {
    if (dirtyRef.current) {
      const ok = window.confirm('You have unsaved copy changes. Discard them and leave?')
      if (!ok) return
    }
    onBack?.()
  }, [onBack])
  return (
    <Shell onBack={guardedBack}>
      {isClerkEnabled ? (
        <AdminGate onDirty={(d) => (dirtyRef.current = d)} />
      ) : (
        <Notice>
          The copy editor needs sign-in configured (Clerk) on this deploy. The app still runs on the
          shipped default wording.
        </Notice>
      )}
    </Shell>
  )
}
