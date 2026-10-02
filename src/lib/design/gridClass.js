// THE GRID'S CLASS LIST AND STYLE (#1180) — the one place a gap step, a fit
// mode and a column minimum turn into class names and a custom property,
// shared by components/ui/layout/Grid.jsx and its tests. Pure, so node --test
// can pin it, the way stackClass.js pins the stack.
//
// WHAT IT IS. As many columns of at least `min` as fit, each taking an equal
// share of the row, with no breakpoint. Signed off in
// .scratch/design-system/layout.md as the 28 grids that already do this and
// nothing else: a grid that fixes its columns (a label and a value, a named
// area, `repeat(3, 1fr)`) is a layout you author, and stays in its own
// namespace.
//
// GAPS. The Stack's four steps, without `section`: 4, 8 (the default), 12 and
// 16px. 20 of the 28 existing grids sit on them. There is no row gap: only two
// of the 28 set two values.
//
// FIT. Left out, the grid FILLS: a short last row keeps its column width, so
// one card does not stretch across the page (17 of the 28). `fit` collapses
// the empty columns, so a short row stretches to the full width (11 of the 28).
//
// MIN. A length, 9rem when left out: a number is px, a string is a rem, em, px, ch, vw length or a
// var(--token). It is capped at the grid's own width, so a grid narrower than
// `min` is one column and never overflows.
//
// An unknown gap, a bad `min` or an unknown element is a caller's typo, and it
// throws.
//
// LISTS. A <ul> or <ol> gets .grid--list, which drops the marker and the
// indent. A modifier, so a block's own namespace still wins on order.
export const GAPS = ['tight', 'snug', 'base', 'loose']
export const GRID_TAGS = ['div', 'section', 'nav', 'ul', 'ol', 'dl']
const LISTS = ['ul', 'ol']
const LENGTH = /^(\d*\.?\d+(px|rem|em|ch|vw)|var\(--[a-z0-9-]+\))$/i

export function gridClassName({ gap = 'snug', fit = false, as = 'div', className = '' } = {}) {
  if (!GAPS.includes(gap)) throw new Error(`Grid: unknown gap "${gap}" (${GAPS.join(', ')})`)
  if (!GRID_TAGS.includes(as)) throw new Error(`Grid: unknown element "${as}" (${GRID_TAGS.join(', ')})`)
  const parts = ['grid', `grid--${gap}`]
  if (fit) parts.push('grid--fit')
  if (LISTS.includes(as)) parts.push('grid--list')
  if (className) parts.push(className)
  return parts.join(' ')
}

// The column minimum as the custom property the stylesheet reads, or nothing
// when the caller gave none: the default (9rem) lives on the .grid rule, so
// every var() in the stylesheet resolves in CSS. A number is px; anything that
// is not a plain length or a token is refused, so a stray `;` or `}` cannot
// reach the style attribute.
export function gridMinStyle(min) {
  if (min === undefined) return {}
  const value = typeof min === 'number' && Number.isFinite(min) && min > 0 ? `${min}px` : min
  if (typeof value !== 'string' || !LENGTH.test(value)) {
    throw new Error(`Grid: min must be a length such as 150, "9rem" or "var(--shot-sm-w)", not ${JSON.stringify(min)}`)
  }
  return { '--grid-min': value }
}
