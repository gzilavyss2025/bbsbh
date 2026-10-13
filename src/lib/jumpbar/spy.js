// THE JUMP BAR'S PURE HALF (#1883): which section is current, where the bar
// must scroll to show its current button, and how a count reads. The DOM half
// (measuring, listeners, the tap) is HubTabBar's anchor variant
// (components/chrome/HubTabBar.jsx). test/jump-bar.test.js pins this file.

// The current section. `sections` is the bar's list in page order, each
// `{ key, top }`, with `top` measured from the top edge of the scroll area.
// The current section is the last one whose top has crossed `line`. Before
// the first section crosses it, the first section is current.
//
// `atEnd` is true when the scroll area is at its bottom. Then the last section
// is current, because a short last section can never scroll its top up to
// the line, and its button would otherwise never be marked.
export function currentSection(sections, { line = 0, atEnd = false } = {}) {
  if (!sections.length) return null
  if (atEnd) return sections[sections.length - 1].key
  let current = sections[0].key
  for (const s of sections) {
    if (s.top > line) break
    current = s.key
  }
  return current
}

// The bar's next scrollLeft, so the whole current button shows with `pad`
// of space at the edge. A button already in view keeps the bar where it is.
// On a phone the bar scrolls sideways, and the current button changes when
// the PAGE scrolls, not when a reader taps. So the bar must move itself, or
// the mark sits off the end of a control nobody touched.
export function scrollLeftToShow({ scrollLeft, width, itemLeft, itemWidth, pad = 0 }) {
  const start = itemLeft - pad
  const end = itemLeft + itemWidth + pad
  if (start < scrollLeft) return Math.max(0, start)
  if (end > scrollLeft + width) return end - width
  return scrollLeft
}

// A count as the badge prints it: a number gets thousands separators, a
// string prints as given, and no count is null (the badge shows a dot).
export function countLabel(count) {
  if (count == null || count === '') return null
  if (typeof count === 'number') return Number.isFinite(count) ? count.toLocaleString('en-US') : null
  return String(count)
}

// What a measure does with the tap's hold (`hold` is { until } or null). A live
// hold keeps the mark and renews itself, because the tap's own smooth scroll
// keeps firing frames. `retryIn` is when the spy must measure again: just after
// the renewed hold ends. Without that, nothing re-measures once the scroll stops
// and the mark can stay on the tapped button while the page sits elsewhere.
export function holdStep(hold, now, holdMs) {
  if (hold && now <= hold.until) return { measure: false, hold: { until: now + holdMs }, retryIn: holdMs + 1 }
  return { measure: true, hold: null, retryIn: 0 }
}
