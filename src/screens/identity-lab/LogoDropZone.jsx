import { useRef, useState } from 'react'
import { describeLogoRejection, LOGO_MAX_BYTES, LOGO_SIZE } from '../../lib/logoArt.js'
import { uploadLogo } from './saveStores.js'

// Drag a PNG onto a tile and it becomes that club's art. Wraps the tile's own
// logo box (TreatmentBox passes it as `children`) so the drop target is the
// thing you are looking at, rather than a separate upload panel you have to
// aim at while comparing marks.
//
// The file is checked HERE first, against the same src/lib/logoArt.js rules the
// endpoint enforces, purely so a rejection is instant and specific — the server
// re-checks every byte it is handed and is the one that decides. Both messages
// come from the same function, so they can't disagree about why something
// bounced.
//
// Dev-only, like everything else in this lab: outside `npm run dev` the
// endpoint doesn't exist, and the screen itself is DEV-gated in App.jsx
// (ADR-0029).
export function LogoDropZone({ teamId, treatment, label, caveat, onUploaded, children }) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file) return
    setMessage(null)
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const rejection = describeLogoRejection(bytes)
      if (rejection) {
        setMessage({ kind: 'error', text: `${file.name}: ${rejection}` })
        return
      }
      const result = await uploadLogo({ teamId, treatment, bytes })
      if (result.error) {
        setMessage({ kind: 'error', text: result.error })
        return
      }
      // The write is live the moment it lands — Vite serves public/ straight
      // off disk — but the browser still holds the old bytes for this URL, so
      // the tile has to re-request with a new cache-buster before it shows.
      onUploaded?.()
      const notes = [result.caveat, caveat].filter(Boolean)
      setMessage(
        notes.length
          ? { kind: 'note', text: `${result.file} — ${notes.join(' · ')}` }
          : { kind: 'ok', text: `saved to ${result.file}` },
      )
    } finally {
      setBusy(false)
      // Let the same file be picked twice in a row (after a failed attempt and
      // a re-export, say) — a file input fires no change event otherwise.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const hint = `Drop a ${LOGO_SIZE}x${LOGO_SIZE} PNG under ${LOGO_MAX_BYTES / 1024} KB here, or use Replace art`

  return (
    <div className="colorlab__logodrop">
      <div
        className={`colorlab__logodropzone${dragging ? ' colorlab__logodropzone--over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer?.files?.[0])
        }}
        title={hint}
      >
        {children}
        {(dragging || busy) && (
          <span className="colorlab__logodropbadge">{busy ? 'Saving' : 'Drop'}</span>
        )}
      </div>
      <input
        ref={inputRef}
        className="colorlab__logodropinput"
        type="file"
        accept="image/png,.png"
        aria-label={`Replace ${label} art`}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className="colorlab__wparesetbtn"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={hint}
      >
        Replace art
      </button>
      {message && (
        <p className={`colorlab__logodropmsg colorlab__logodropmsg--${message.kind}`}>{message.text}</p>
      )}
    </div>
  )
}
