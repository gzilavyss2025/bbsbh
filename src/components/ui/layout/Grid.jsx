import { gridClassName, gridMinStyle } from '../../../lib/design/gridClass.js'

// THE GRID — as many columns of at least `min` as fit, each an equal share of
// the row, with no breakpoint (#1180): a gallery of cards, a run of tiles.
// Drawn once, in styles/system/grid.css. Like Stack and Cluster, it owns the
// space BETWEEN its children and nothing else: no padding, no margin, no
// frame.
//
// It is NOT the grid for a layout you author — a label beside a value, a named
// area, a fixed three across. Those keep their own namespace rule.
//
//   min        the narrowest a column may be: a number (px), a length such as
//              '9rem', or a var(--token). The default is '9rem'. A grid
//              narrower than `min` is one column and never overflows.
//   gap        'tight' (4px), 'snug' (8px, the default), 'base' (12px) or
//              'loose' (16px).
//   fit        left out, the grid FILLS: a short row keeps its column width.
//              With `fit`, empty columns collapse and a short row stretches
//              across.
//   as         the element: 'div' (the default), 'section', 'nav', 'dl', or
//              'ul' / 'ol' for a list.
//   className  the block's NAMESPACE, for its own parts. A namespace that sets
//              its own gap or columns loads later and wins on order.
//   style      merged after `min`, so the caller wins.
//   ...rest    passed to the element: id, aria-*, data-*.
//
// A Grid computes and fetches nothing, so it may render anywhere, inside a
// SealBox reveal too. It imports no api/ module, no stamp module and no club
// theme.
export function Grid({ min, gap = 'snug', fit = false, as: Tag = 'div', className = '', style, children, ...rest }) {
  return (
    <Tag
      className={gridClassName({ gap, fit, as: Tag, className })}
      style={{ ...gridMinStyle(min), ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
