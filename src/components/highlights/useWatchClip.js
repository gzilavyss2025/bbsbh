import { useEffect, useState } from 'react'
import { createClipLookup } from './watchClip.js'

const IDLE = { src: null, notice: '', loading: false }

// The open / src / notice / loading state one Watch button drives a
// HighlightSheet with. It decides nothing about WHICH play offers a clip: the
// caller applies its own rule (watchClipSource plus its own package lookup)
// and calls `openClip` only for a play that offers one.
//
// `target` is whatever the caller needs back while the sheet is open (the
// swing list keeps the play and its package; the play-by-play card passes
// `true`). `rawPlayId` is the play to look up — null when the package is
// already in hand and nothing needs asking. The sheet opens FIRST and then
// fills, so a slow lookup never reads as a dead tap.
export function useWatchClip() {
  const [open, setOpen] = useState(null)
  const [clip, setClip] = useState(IDLE)
  const [lookup] = useState(() => createClipLookup((r) => setClip({ ...r, loading: false })))
  useEffect(() => {
    lookup.mount()
    return lookup.unmount
  }, [lookup])

  const openClip = (target, rawPlayId = null) => {
    setOpen(target)
    if (!rawPlayId) { lookup.cancel(); setClip(IDLE); return }
    setClip({ src: null, notice: '', loading: true })
    return lookup.start(rawPlayId)
  }
  const close = () => {
    lookup.cancel()
    setOpen(null)
    setClip(IDLE)
  }
  return { open, ...clip, openClip, close }
}
