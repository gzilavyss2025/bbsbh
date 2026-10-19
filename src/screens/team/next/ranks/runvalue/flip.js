// The re-rank slide on the run value card (#2295), as FLIP: measure every flip-tagged element just
// before the tap's re-render, then animate each one from where it was to where it is now.
//
// Why not CSS transitions alone: the list keeps its DOM in rank order (so the reading and Tab order
// are the rank order, spec "Accessibility"), and React re-orders a keyed list by MOVING nodes. A moved
// node loses its running and pending transitions, so the rows that change place would jump. A Web
// Animation started after the commit does not care where the node went.
//
// Tags (data-flip): `row:{id}` slides its `top` (or fades out, when it just left the board),
// `frame:{id}` resizes the headshot frame, `seg:{id}:{part}` moves a mini-bar segment.
const EASE_STAMP = 'cubic-bezier(0.2, 0.9, 0.3, 1)'
const SLIDE_MS = 460
const LEAVE_MS = 220

export function measureFlip(root) {
  const out = new Map()
  if (!root) return out
  for (const el of root.querySelectorAll('[data-flip]')) {
    out.set(el.dataset.flip, {
      top: el.offsetTop,
      left: el.offsetLeft,
      width: el.offsetWidth,
      height: el.offsetHeight,
      // Only a segment animates its opacity; reading it for the rows and frames too would resolve
      // style for every node on the list for nothing.
      opacity: el.dataset.flip.startsWith('seg:') ? getComputedStyle(el).opacity : null,
      shown: el.dataset.shown !== 'false',
    })
  }
  return out
}

export function playFlip(root, before) {
  if (!root || !before?.size) return
  for (const el of root.querySelectorAll('[data-flip]')) {
    const was = before.get(el.dataset.flip)
    if (!was || typeof el.animate !== 'function') continue
    const kind = el.dataset.flip.split(':')[0]
    const opts = { duration: SLIDE_MS, easing: EASE_STAMP }
    if (kind === 'row') {
      const shown = el.dataset.shown !== 'false'
      if (was.shown && !shown) {
        const hold = { top: `${was.top}px`, visibility: 'visible' }
        el.animate([{ ...hold, opacity: 1 }, { ...hold, opacity: 0 }], { duration: LEAVE_MS, easing: 'linear' })
      } else if (was.shown && shown && was.top !== el.offsetTop) {
        el.animate([{ top: `${was.top}px` }, { top: `${el.offsetTop}px` }], opts)
      }
    } else if (kind === 'frame') {
      if (was.width !== el.offsetWidth) {
        el.animate(
          [
            { width: `${was.width}px`, height: `${was.height}px` },
            { width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px` },
          ],
          opts,
        )
      }
    } else if (kind === 'seg') {
      const to = { left: `${el.offsetLeft}px`, width: `${el.offsetWidth}px`, right: 'auto', opacity: getComputedStyle(el).opacity }
      el.animate([{ left: `${was.left}px`, width: `${was.width}px`, right: 'auto', opacity: was.opacity }, to], opts)
    }
  }
}
