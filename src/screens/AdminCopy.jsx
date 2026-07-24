import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { FIELDS, GROUPS, defaultCopy, fillTokens, sanitizeOverrides } from '../copy/registry.js'

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

// The editor body — only rendered for a confirmed admin, so Clerk hooks here
// always have a provider (main.jsx only mounts one when Clerk is enabled).
function Editor() {
  const { getToken } = useAuth()
  const defaults = useMemo(defaultCopy, [])
  // values[id] is the current text in each box: an override, or the default.
  const [values, setValues] = useState(defaults)
  const [status, setStatus] = useState({ state: 'loading', message: 'Loading current copy…' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/copy')
        const data = res.ok ? await res.json() : {}
        const overrides = sanitizeOverrides(data?.copy)
        if (cancelled) return
        setValues({ ...defaults, ...overrides })
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
  }, [defaults])

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
        setStatus({ state: 'saved', message: 'Saved. Live within a minute.' })
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
  }, [getToken, overridePayload])

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
          disabled={status.state === 'saving' || anyOverLimit}
        >
          Save {overrideCount ? `(${overrideCount} custom)` : '(all default)'}
        </button>
        {status.message && (
          <span className={`admincopy__status admincopy__status--${status.state}`}>
            {status.message}
          </span>
        )}
      </div>

      {GROUPS.map((group) => {
        const groupFields = FIELDS.filter((f) => f.group === group.id)
        const ids = Object.fromEntries(groupFields.map((f) => [f.id.split('.')[1], f.id]))
        return (
          <section key={group.id} className="admincopy__group" aria-label={group.label}>
            <h2 className="admincopy__groupTitle">{group.label}</h2>
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
    </div>
  )
}

// Gate: signed in? admin? Only then mount the Editor. Uses Clerk hooks, so it is
// only ever rendered under a ClerkProvider (see AdminCopyPage).
function AdminGate() {
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
  return <Editor />
}

export function AdminCopyPage({ onBack }) {
  useDocumentTitle('Copy editor')
  return (
    <Shell onBack={onBack}>
      {isClerkEnabled ? (
        <AdminGate />
      ) : (
        <Notice>
          The copy editor needs sign-in configured (Clerk) on this deploy. The app still runs on the
          shipped default wording.
        </Notice>
      )}
    </Shell>
  )
}
