import { useEffect, useRef, useState } from 'react'
import { highlightForPlay } from '../../../api/highlights.js'
import { CLIP_PACKAGE, CLIP_RAW, watchClipSource, resolveRawClip } from '../../highlights/watchClip.js'

// The film behind one big-swing row, opened in the same HighlightSheet the
// play-by-play's Watch button uses. Same rules as AtBatCard (PlayByPlay.jsx):
// MLB's edited package when one exists, else the raw clip of the terminal
// pitch, and only the TAP asks a host anything — one lookup, one playId, never
// a prefetch. A hit is kept per playId; a miss is not (watchClip.js says why).
//
// The package comes from highlightForPlay, NOT eligibleHighlightForPlay. A swing
// row exists only for a revealed play, and a swing is not a "best play" claim,
// so the Play of the Game filter does not apply: any package MLB cut for the
// play is offered, as on the play-by-play card.
//
// Spoiler-safe for the same reason the chart is: a swing row exists only for a
// play the reader has already revealed, so the clip's burned-in scorebug shows
// nothing the row above it has not.
//
// `highlights` is the game's `content` items (optional); `filmEligible` is
// filmCanExist(feed), true when the caller cannot answer.
export function useSwingClip({ highlights = null, filmEligible = true } = {}) {
  const [open, setOpen] = useState(null) // { playId, item, title }
  const [src, setSrc] = useState(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const hits = useRef(new Map())
  const abortRef = useRef(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const sourceFor = (playId) => {
    const item = highlightForPlay(highlights, playId)
    return { item, kind: watchClipSource(item, playId, { filmEligible }) }
  }

  const openClip = async (playId, title) => {
    const { item, kind } = sourceFor(playId)
    if (!kind) return
    abortRef.current?.abort()
    setOpen({ playId, item: kind === CLIP_PACKAGE ? item : null, title })
    setNotice('')
    if (kind !== CLIP_RAW) { setSrc(null); setLoading(false); return }
    const kept = hits.current.get(playId)
    if (kept) { setSrc(kept); setLoading(false); return }
    setSrc(null)
    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller
    const result = await resolveRawClip(playId, { signal: controller.signal })
    if (controller.signal.aborted) return
    abortRef.current = null
    if (result.src) hits.current.set(playId, result.src)
    setSrc(result.src)
    setNotice(result.notice)
    setLoading(false)
  }

  const close = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setOpen(null)
    setLoading(false)
  }

  const hasClip = (playId) => sourceFor(playId).kind != null
  return { open, src, notice, loading, openClip, close, hasClip }
}
