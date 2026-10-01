import { stackClassName } from '../../../lib/design/stackClass.js'

// THE STACK — children in a column, with one step of space between them
// (#1180). Drawn once, in styles/system/stack.css. It owns the space BETWEEN
// its children and nothing else: no padding, no margin, no frame. The space
// around it belongs to its parent, and the look of what is inside belongs to
// the children.
//
//   gap        'tight' (4px), 'snug' (8px), 'base' (12px, the default),
//              'loose' (16px) or 'section' (the gap between a page's
//              top-level sections, --space-section). A page's outer Stack
//              takes 'section'.
//   as         the element: 'div' (the default), 'section', 'article',
//              'aside', 'header', 'footer', 'nav', 'main', 'form',
//              'fieldset', or 'ul' / 'ol' / 'li' for a list.
//   className  the block's NAMESPACE, for its own parts. A namespace that
//              sets its own gap, or alignment, loads later and wins on order.
//   ...rest    passed to the element: id, aria-*, style, data-*.
//
// A Stack computes and fetches nothing, so it may render anywhere, inside a
// SealBox reveal too. It imports no api/ module, no stamp module and no club
// theme.
export function Stack({ gap = 'base', as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={stackClassName({ gap, as: Tag, className })} {...rest}>
      {children}
    </Tag>
  )
}
