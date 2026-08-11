import { useCallback, useId, useRef } from 'react'
import { FIELDS } from '../../../../copy/registry.js'
import { fieldIds } from '../../../../lib/ballpark/ballparkArt.js'
import '../../../../styles/61-ballpark-admin.css'

// The owner's edit form, shown inside the Ballpark card body while the gear is
// engaged. Deliberately Clerk-free: it only reads and writes the draft, and the
// buttons that need a token live up in BallparkAdminBar. It renders at all only
// when `draft.editing`, which nothing but the admin-only gear can turn on.
//
// LENGTH CAPS ARE READ FROM THE REGISTRY, never retyped. src/copy/registry.js
// is the one definition of what a valid value is, and sanitizeOverrides DROPS
// an over-length value silently on both the client and the server — so a
// hard-coded maxLength that drifted above the registry's would produce the
// worst possible outcome: a field that accepts your typing, reports success,
// and saves nothing.

// maxLength per slot, straight from the registry. Every park is given the same
// budgets by parkFields(), so one real park's ids answer for all thirty — and
// looking them up by a REAL key rather than a placeholder means this throws
// loudly at import if the id scheme ever changes, instead of quietly falling
// back to a wrong number.
const CAPS = Object.fromEntries(
  Object.entries(fieldIds('wrigleyfield')).map(([slot, id]) => [
    slot,
    FIELDS.find((f) => f.id === id)?.maxLength,
  ]),
)

// A file picker that looks like the rest of the card. A bare <input type="file">
// cannot be styled across browsers, so the input is hidden and a button drives
// it — the standard trick, and the label still binds for screen readers.
function ImagePicker({ label, accept, hint, current, onPick, onClear, disabled }) {
  const inputRef = useRef(null)
  const id = useId()
  const choose = useCallback(() => inputRef.current?.click(), [])
  const pick = useCallback(
    (event) => {
      const file = event.target.files?.[0]
      if (file) onPick(file)
      // Reset so choosing the SAME file twice still fires a change event —
      // otherwise re-picking after a Cancel silently does nothing.
      event.target.value = ''
    },
    [onPick],
  )

  return (
    <div className="bpadmin__field">
      <span className="bpadmin__label" id={id}>
        {label}
      </span>
      <div className="bpadmin__row">
        <button type="button" className="bpadmin__btn" onClick={choose} disabled={disabled} aria-labelledby={id}>
          Choose file
        </button>
        {current && (
          <button type="button" className="bpadmin__btn" onClick={onClear} disabled={disabled}>
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={pick}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      <p className="bpadmin__hint">{hint}</p>
    </div>
  )
}

export function BallparkEditFields({ draft, defaultName }) {
  const { values, status, setValue, setFile, clearSlot } = draft
  const busy = status.busy

  return (
    <div className="bpadmin">
      <p className="bpadmin__title">Editing this ballpark</p>

      <div className="bpadmin__field">
        <label className="bpadmin__label" htmlFor="bpadmin-name">
          Name shown
        </label>
        <input
          id="bpadmin-name"
          className="bpadmin__input"
          type="text"
          value={values.name}
          maxLength={CAPS.name}
          placeholder={defaultName}
          disabled={busy}
          onChange={(e) => setValue('name', e.target.value)}
        />
        <p className="bpadmin__hint">Leave empty to use “{defaultName}”, the name the schedule feed gives.</p>
      </div>

      <ImagePicker
        label="Name as an image"
        accept="image/png"
        hint="A PNG of the park’s name, shown instead of the text above. Transparent background. Resized here before it uploads."
        current={values.wordmark}
        disabled={busy}
        onPick={(file) => setFile('wordmark', file)}
        onClear={() => clearSlot('wordmark')}
      />

      <ImagePicker
        label="Photo"
        accept="image/jpeg,image/png"
        hint="Replaces the bundled photograph. Resized and re-compressed here before it uploads, so a photo straight off a phone is fine."
        current={values.photo}
        disabled={busy}
        onPick={(file) => setFile('photo', file)}
        onClear={() => clearSlot('photo')}
      />

      <div className="bpadmin__field">
        <label className="bpadmin__label" htmlFor="bpadmin-credit">
          Photo credit
        </label>
        <input
          id="bpadmin-credit"
          className="bpadmin__input"
          type="text"
          value={values.credit}
          maxLength={CAPS.credit}
          placeholder="Photographer · licence"
          disabled={busy}
          onChange={(e) => setValue('credit', e.target.value)}
        />
        <p className="bpadmin__hint">
          Only used with your own photo. The bundled photo keeps its own Wikimedia credit, which yours does not
          inherit.
        </p>
      </div>

      <p className="bpadmin__hint bpadmin__hint--wide">
        Tap the photograph above to set which part of it survives the widescreen crop. It is at {values.focus || '50 50'} now.
      </p>

      {status.error && (
        <p className="bpadmin__error" role="alert">
          {status.error}
        </p>
      )}
    </div>
  )
}
