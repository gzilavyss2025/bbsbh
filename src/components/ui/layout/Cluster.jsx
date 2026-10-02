import { clusterClassName } from '../../../lib/design/clusterClass.js'

// THE CLUSTER — children in a row that wraps onto the next line, with one step
// of space between them (#1180): pills, buttons, tags. Drawn once, in
// styles/system/cluster.css. Like Stack, it owns the space BETWEEN its
// children and nothing else: no padding, no margin, no frame.
//
//   gap        the space between items on a line: 'tight' (4px), 'snug'
//              (8px, the default) or 'base' (12px).
//   rowGap     the space between lines, in the same three steps. Left out, it
//              equals `gap`.
//   align      the items' alignment on a line: 'start', 'center' or
//              'baseline'. Left out, items stretch (the flexbox default).
//   as         the element: 'div' (the default), 'span' (inside a link or a
//              button, which hold phrasing content only), 'section', 'nav',
//              'header', 'footer', or 'ul' / 'ol' / 'li' for a list.
//   className  the block's NAMESPACE, for its own parts. A namespace that
//              sets its own gap, alignment or justification loads later and
//              wins on order.
//   ...rest    passed to the element: id, aria-*, style, data-*.
//
// A Cluster computes and fetches nothing, so it may render anywhere, inside a
// SealBox reveal too. It imports no api/ module, no stamp module and no club
// theme.
export function Cluster({ gap = 'snug', rowGap, align, as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={clusterClassName({ gap, rowGap, align, as: Tag, className })} {...rest}>
      {children}
    </Tag>
  )
}
