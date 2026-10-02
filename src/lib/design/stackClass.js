// THE STACK'S CLASS LIST (#1180) — the one place a gap step turns into a class
// name, shared by components/ui/layout/Stack.jsx and its tests. Pure, so
// node --test can pin it, the way cardClass.js pins the card.
//
// GAPS. Five names for four steps on the 4px scale, signed off in
// .scratch/design-system/layout.md:
//   tight    --space-1   4px
//   snug     --space-2   8px
//   base     --space-3  12px (the default)
//   loose    --space-4  16px
//   section  --space-section: the gap between a page's top-level sections.
//            Today it is the 16px step, and it has its own name so that one
//            edit to that token moves every page.
// There is no hairline step and no half-step: a stack that wants 2px or 6px
// is a different layout, and it stays in its own namespace (ADR-0085).
// An unknown gap is a caller's typo, and it throws.
//
// LISTS. A <ul> or <ol> gets .stack--list, which drops the marker and the
// indent. A modifier, not a bare element rule, so a block's own namespace
// still wins on order.
export const GAPS = ['tight', 'snug', 'base', 'loose', 'section']
export const STACK_TAGS = ['div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'ul', 'ol', 'li', 'form', 'fieldset', 'label']
const LISTS = ['ul', 'ol']

export function stackClassName({ gap = 'base', as = 'div', className = '' } = {}) {
  if (!GAPS.includes(gap)) throw new Error(`Stack: unknown gap "${gap}" (${GAPS.join(', ')})`)
  if (!STACK_TAGS.includes(as)) throw new Error(`Stack: unknown element "${as}" (${STACK_TAGS.join(', ')})`)
  const parts = ['stack', `stack--${gap}`]
  if (LISTS.includes(as)) parts.push('stack--list')
  if (className) parts.push(className)
  return parts.join(' ')
}
