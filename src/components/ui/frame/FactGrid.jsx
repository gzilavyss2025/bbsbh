import { Card } from './Card.jsx'

// THE FACT GRID — a Card that holds one gap-rule grid of label/value facts
// (#1113, slice C2). The Card is the block (.factgrid, 09-team-info.css) and
// keeps its margin. The grid is the inner .factgrid__grid, whose
// --border-rule ground shows through 1px gaps as the rules between cells.
// Eight files render one, so the pair is drawn here once.
//
//   as         the grid element: 'dl' (the default) for facts drawn as
//              <dt>/<dd> pairs, 'div' for the player page's <div> facts.
//   className  the caller's own namespace ("cmdmap__facts"), which sizes the
//              grid's columns from outside (.spray__facts .factgrid__grid).
//
// Like Card, it computes and fetches nothing, so it may render inside a
// SealBox reveal too. The facts it holds are the caller's.
export function FactGrid({ as: Grid = 'dl', className = '', children }) {
  return (
    <Card as="div" body="flush" className={`factgrid ${className}`.trim()}>
      <Grid className="factgrid__grid">{children}</Grid>
    </Card>
  )
}
