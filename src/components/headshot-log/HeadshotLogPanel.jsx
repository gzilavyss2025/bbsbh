import { useEffect, useState } from 'react'
import { clearHeadshotLog, readHeadshotLog } from '../../lib/headshot/log.js'

// TEMPORARY (issue #1446): a read-out of the on-device headshot log, shown
// only when the page was opened with `?headshotlog`, so a "?" seen on a phone
// can be traced without dev tools. Holds ids, URLs and flags — never a score.
// Remove with src/lib/headshot/log.js once the cause is fixed.
const FLAG = 'bbsbh:headshotlog:panel'

function wanted() {
  try {
    if (new URLSearchParams(window.location.search).has('headshotlog')) {
      window.sessionStorage.setItem(FLAG, '1')
    }
    return window.sessionStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

export function HeadshotLogPanel() {
  const [on] = useState(wanted)
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState([])
  useEffect(() => {
    if (!on || !open) return undefined
    const read = () => setLog(readHeadshotLog())
    read()
    const t = setInterval(read, 2000)
    return () => clearInterval(t)
  }, [on, open])
  if (!on) return null
  const lines = log.map((e) => {
    const { at, ...rest } = e
    return `${new Date(at).toLocaleTimeString()} ${JSON.stringify(rest)}`
  })
  return (
    <div style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 'calc(100vw - 16px)' }}>
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
