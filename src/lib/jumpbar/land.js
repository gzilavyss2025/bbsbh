// THE JUMP BAR'S LANDING (#2073, decision 3): when a tap's scroll has landed on its
// section, so the page can stamp that section's cards. The pure half: the timers and the
// position test come in, so node can test it. The DOM half is HubTabBar's holdTarget.
// test/jump-bar-land.test.js pins this file.

// The scroll has stopped once no scroll event came for this long. A smooth scroll fires
// one each frame (about 16ms).
export const QUIET_MS = 150

// A landing watch for one tap. `isThere()` says the section sits at the line (or the
// scroll area is at its end). `onLand()` runs at most once, the first time the scroll
// stops with the section there. A stop is a scrollend (`ended`) or QUIET_MS with no
// scroll (`scrolled` restarts the timer). The timer starts at once: a tap that scrolls
// nowhere fires no scroll event, and still lands.
export function createLanding({ isThere, onLand, quietMs = QUIET_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null
  let over = false
  const settle = () => {
    clearTimer(timer)
    timer = null
    if (over || !isThere()) return
    over = true
    onLand()
  }
  const scrolled = () => {
    if (over) return
    clearTimer(timer)
    timer = setTimer(settle, quietMs)
  }
  const cancel = () => {
    over = true
    clearTimer(timer)
    timer = null
  }
  scrolled()
  return { scrolled, ended: settle, cancel }
}

// Plays a CSS animation again on an element that already has its class: take the class
// off, read a layout value so the browser sees the change, put the class back. A
// finished animation is gone from getAnimations(), so it cannot be restarted there.
export function replayClass(el, cls) {
  if (!el?.classList?.contains(cls)) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}
