// Scroll `el` to the top of the window and hold it there while the page above it grows.
// Slots and bands above load as they come near and push it down: re-scroll each time its
// parent resizes, until the reader moves, or until the element leaves the page. Returns the
// cleanup. The player page and the team page both land an old address with it.
// ponytail: a fixed 4 s hold; a slot that loads later than that can still push it.
const MOVES = ['wheel', 'touchstart', 'keydown', 'pointerdown']

export function holdSectionInView(el) {
  if (typeof ResizeObserver === 'undefined') return el.scrollIntoView()
  // The observer fires once on observe(), which is the first scroll.
  const hold = new ResizeObserver(() => (el.isConnected ? el.scrollIntoView() : stop()))
  hold.observe(el.parentElement)
  const stop = () => {
    hold.disconnect()
    for (const e of MOVES) window.removeEventListener(e, stop)
  }
  for (const e of MOVES) window.addEventListener(e, stop, { passive: true })
  const timer = setTimeout(stop, 4000)
  return () => {
    clearTimeout(timer)
    stop()
  }
}
