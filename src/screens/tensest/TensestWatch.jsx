import { useEffect, useRef, useState } from 'react'
import { loadTensestClips } from '../../api/tensest/tensest.js'
import { resolveRawClip } from '../../components/highlights/watchClip.js'
import { fetchHighlights, highlightForPlay } from '../../api/game/highlights.js'
import { HighlightSheet } from '../../components/playbyplay/HighlightSheet.jsx'

const NO_CLIP = 'No clip for this at-bat.'

// The ▶ on one Pressure Moments row. It costs nothing until tapped: the tap reads the
// clip-id file (once for the page), then asks for this one play's film (watchClip.js
// has the one-lookup-per-tap rule). This page is not a scoring surface, so the clip's
// burned-in scorebug is no leak here (ADR-0034).
export function TensestWatch({ row }) {
  const [open, setOpen] = useState(false)
  const [item, setItem] = useState(null)
  const [src, setSrc] = useState(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const live = useRef(true)
  const abort = useRef(null)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      abort.current?.abort()
    }
  }, [])

  const watch = async () => {
    setOpen(true)
    if (item || src || loading) return
    setNotice('')
    setLoading(true)
    const playId = (await loadTensestClips())[`${row.pk}:${row.i}`]
    // MLB's own cut wins when there is one, as on the box score and Gameday: it carries
    // the play's title and blurb. The raw pitch clip is the floor under it.
    const pkg = playId ? highlightForPlay(await fetchHighlights(row.pk), playId) : null
    if (pkg) {
      if (!live.current) return
      setItem(pkg)
      setLoading(false)
      return
    }
    const controller = (abort.current = new AbortController())
    const res = playId ? await resolveRawClip(playId, { signal: controller.signal }) : { src: null, notice: NO_CLIP }
    abort.current = null
    if (!live.current) return
    setSrc(res.src)
    setNotice(res.notice)
    setLoading(false)
  }

  return (
    <>
      <button type="button" className="tensest__watch" onClick={watch} aria-label={`Watch ${row.bn} vs ${row.pn}`}>
        <span aria-hidden="true">▶</span>
      </button>
      {open && <HighlightSheet item={item} src={src} notice={loading ? 'Loading the clip…' : notice} title={`${row.bn} vs ${row.pn}: ${row.what}`} onClose={() => setOpen(false)} />}
    </>
  )
}
