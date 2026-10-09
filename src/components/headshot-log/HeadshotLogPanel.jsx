import { useEffect, useState } from 'react'
import { clearHeadshotLog, readHeadshotLog } from '../../lib/headshot/log.js'

// TEMPORARY (issue #1446): a read-out of the on-device headshot log. It shows
// a small "Headshot log" button on its own as soon as the log holds an entry
// (a failed load, or a logo or monogram drawn where a face was expected), so
// a "?" seen on a phone can be traced without dev tools or a URL flag. Holds
// ids, URLs and flags, never a score. Remove with src/lib/headshot/log.js once
// the cause is fixed.
export function HeadshotLogPanel() {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState([])
  useEffect(() => {
    const read = () =>
      setLog((prev) => {
        const next = readHeadshotLog()
        return next.length === prev.length && next.at(-1)?.at === prev.at(-1)?.at ? prev : next
      })
    read()
    const t = setInterval(read, 2000)
    return () => clearInterval(t)
  }, [])
  if (!log.length) return null
  const lines = log.map((e) => {
    const { at, ...rest } = e
    return `${new Date(at).toLocaleTimeString()} ${JSON.stringify(rest)}`
  })
  return (
    <div style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 'var(--z-toast)', display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 'calc(100vw - 16px)' }}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Headshot log ({log.length})
      </button>
      {open && (
        <>
          <button
            type="button"
            className="btn"
            onClick={() => {
              clearHeadshotLog()
              setLog([])
            }}
          >
            Clear
          </button>
          <textarea style={{ textTransform: 'none', width: '100%', fontFamily: 'var(--font-mono)' }} readOnly value={lines.join('\n')} rows={10} aria-label="Headshot log" />
        </>
      )}
    </div>
  )
}
