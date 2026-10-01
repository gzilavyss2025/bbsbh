import { tableParts } from '../../../lib/design/tableClass.js'

// THE TABLE — the one grid of figures with column names (#1132). Drawn once, in
// styles/system/table.css. It is the box and the cells, never what a cell says:
// the space around it belongs to the parent, and a column's width, a subtotal
// row or a favorite-team tint to the block's own namespace.
//
//   frame    'sheet' (the default): the wrap draws the box. 'bare': no box,
//            for a table inside a Card, which already draws one.
//   density  'row' (the default): cells 6 by 8. 'tight': 4 by 2, the box
//            score's.
//   sticky   the first column stays put while the rest scroll.
//   label    names the scroll region and makes it a Tab stop, so a keyboard
//            can scroll a wide table. Leave it off for a table that never
//            scrolls.
//   className  the block's NAMESPACE ("rpt", "bs__grid--bat"), on the <table>
//            itself, where every family rule hooks. Never a second frame.
//   ...rest  passed to the <table>: aria-describedby, id.
//
// A table renders as two elements: the wrap (a div) around the <table>.
//
// It fetches nothing and gates nothing: it takes children, so a reveal gate
// stays where the caller put it (ADR-0009). This file imports no api/ module
// and no stamp module (ADR-0035), so it may render inside a SealBox reveal.
export function Table({ frame, density, sticky, label, className, children, ...rest }) {
  const { wrap, grid, region } = tableParts({ frame, density, sticky, label, className })
  return (
    <div className={wrap} {...region}>
      <table className={grid} {...rest}>
        {children}
      </table>
    </div>
  )
}
