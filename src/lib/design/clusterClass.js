// THE CLUSTER'S CLASS LIST (#1180) — the one place a gap step, a row gap and an
// alignment turn into class names, shared by components/ui/layout/Cluster.jsx
// and its tests. Pure, so node --test can pin it, the way stackClass.js pins
// the stack.
//
// GAPS. Three steps, signed off in .scratch/design-system/layout.md:
//   tight  --space-1   4px
//   snug   --space-2   8px (the default)
//   base   --space-3  12px
// They cover 80 of the 149 wrapping rows. There is no 16px step: two rules use
// it. There is no half-step: those stay in their own namespace (ADR-0085).
//
// ROW GAP. A wrapped row often wants a tighter line gap than the gap between
// its items, and 39 rows say so with a two-value `gap`. `rowGap` takes the
// same three steps and, when left out, equals `gap`. `gap` is the space between
// items on a line; `rowGap` is the space between lines.
//
// ALIGN. The cross-axis alignment of the items on a line. Left out, it is the
// flexbox default (stretch), which is what 69 of the 147 existing rows use.
// 'center' (41 rows) and 'baseline' (31, the stat-and-label rows) are the other
// two that matter, and 'start' (5) completes the set. This went in with the
// part because a Cluster that cannot align cannot host half the rows it
// exists for.
//
// An unknown gap, row gap, alignment or element is a caller's typo, and it
// throws.
//
// LISTS. A <ul> or <ol> gets .cluster--list, which drops the marker and the
// indent. A modifier, so a block's own namespace still wins on order.
export const GAPS = ['tight', 'snug', 'base']
export const ALIGNS = ['start', 'center', 'baseline']
export const CLUSTER_TAGS = ['div', 'span', 'section', 'nav', 'header', 'footer', 'ul', 'ol', 'li']
const LISTS = ['ul', 'ol']

export function clusterClassName({ gap = 'snug', rowGap, align, as = 'div', className = '' } = {}) {
  if (!GAPS.includes(gap)) throw new Error(`Cluster: unknown gap "${gap}" (${GAPS.join(', ')})`)
  if (rowGap !== undefined && !GAPS.includes(rowGap)) {
    throw new Error(`Cluster: unknown rowGap "${rowGap}" (${GAPS.join(', ')})`)
  }
  if (align !== undefined && !ALIGNS.includes(align)) {
    throw new Error(`Cluster: unknown align "${align}" (${ALIGNS.join(', ')})`)
  }
  if (!CLUSTER_TAGS.includes(as)) throw new Error(`Cluster: unknown element "${as}" (${CLUSTER_TAGS.join(', ')})`)
  const parts = ['cluster', `cluster--${gap}`]
  if (rowGap !== undefined) parts.push(`cluster--row-${rowGap}`)
  if (align !== undefined) parts.push(`cluster--align-${align}`)
  if (LISTS.includes(as)) parts.push('cluster--list')
  if (className) parts.push(className)
  return parts.join(' ')
}
