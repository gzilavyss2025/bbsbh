import { useRef, useState } from 'react'
import { describeLogoRejection, LOGO_MAX_BYTES, LOGO_SIZE } from '../../lib/logoArt.js'
import { copyLogo, uploadLogo } from './saveStores.js'

// Drag a PNG onto a tile and it becomes that club's art. Wraps the tile's own
// logo box (JerseyBench passes it as `children`) so the drop target is the
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
//
// `copyTargets`, when supplied (this team's other real treatments), adds a
// second way in: pick one and reuse whatever's already uploaded there instead
// of procuring/uploading the same mark again. Absent for any tile with
// nothing else to copy from — mirrors `upload` itself being absent when a
// treatment has no destination at all (JerseyBench.jsx).
export function LogoDropZone({ teamId, treatment, label, caveat, copyTargets, onUploaded, children }) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [copyFrom, setCopyFrom] = useState(copyTargets?.[0]?.key ?? '')
  const inputRef = useRef(null)

  // The shared tail of both a fresh upload and a copy — same success/failure
  // shape from the same middleware, so the same message logic answers "did it
  // land, and is anything worth flagging about it" either way.
  function applyResult(result) {
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
  }

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
      applyResult(await uploadLogo({ teamId, treatment, bytes }))
    } finally {
      setBusy(false)
      // Let the same file be picked twice in a row (after a failed attempt and
      // a re-export, say) — a file input fires no change event otherwise.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleCopy() {
    if (!copyFrom) return
    setMessage(null)
    setBusy(true)
    try {
      applyResult(await copyLogo({ teamId, from: copyFrom, to: treatment }))
    } finally {
      setBusy(false)
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
      {copyTargets?.length > 0 && (
        <div className="colorlab__logocopyrow">
          <select
            className="colorlab__logocopyselect"
            aria-label={`Copy which treatment's art onto ${label}`}
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value)}
            disabled={busy}
          >
            {copyTargets.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="colorlab__wparesetbtn"
            onClick={handleCopy}
            disabled={busy || !copyFrom}
            title={`Copy that treatment's uploaded art onto ${label}, no re-upload needed`}
          >
            Copy here
          </button>
        </div>
      )}
      {message && (
        <p className={`colorlab__logodropmsg colorlab__logodropmsg--${message.kind}`}>{message.text}</p>
      )}
    </div>
  )
}
