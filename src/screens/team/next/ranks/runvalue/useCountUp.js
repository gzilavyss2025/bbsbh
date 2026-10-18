import { useEffect } from 'react'

const easeOutCubic = (t) => 1 - (1 - t) ** 3

// The run value card's count-ups (#2295), in one requestAnimationFrame loop with no re-render: each
// element under `root` that carries `data-count-at` ("delay,duration" in ms) has its own text node
// rewritten every frame, from 0 to its `data-count` (the final value), through `format`. An element
// keeps `data-count` while it is off the count (a row off the board), so the cleanup below can
// always write back what React rendered.
// An element with `data-count-mask` shows its mask text until its count is `data-count-mask-at`
// done, then its own text.
//
// It writes the text node React rendered, never textContent, so React's later updates still land
// on the node it owns. The cleanup writes every element's final text back, from its CURRENT
// data-count (React has committed a re-rank by the time the cleanup runs), so a tap mid-count never
// leaves a half-counted figure behind. `play` turns false for good on the first tap, and never back.
export function useCountUp(root, play, format) {
  useEffect(() => {
    if (!play || !root.current) return undefined
    const items = [...root.current.querySelectorAll('[data-count-at]')].map((el) => {
      const [delay, dur] = (el.dataset.countAt ?? '0,1000').split(',').map(Number)
      return { el, delay, dur }
    })
    const final = (el) => (el.dataset.countMask != null ? el.dataset.countFinal : format(Number(el.dataset.count)))
    const write = (el, text) => {
      if (el.firstChild) el.firstChild.nodeValue = text
    }
    let frame = 0
    let start = null
    const step = (now) => {
      if (start == null) start = now
      let busy = false
      for (const { el, delay, dur } of items) {
        const t = Math.max(0, Math.min(1, (now - start - delay) / dur))
        if (t < 1) busy = true
        if (el.dataset.countMask != null) {
          write(el, t >= Number(el.dataset.countMaskAt) ? el.dataset.countFinal : el.dataset.countMask)
        } else {
          write(el, format(Number(el.dataset.count) * easeOutCubic(t)))
        }
      }
      if (busy) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      for (const { el } of items) write(el, final(el))
    }
  }, [root, play, format])
}
