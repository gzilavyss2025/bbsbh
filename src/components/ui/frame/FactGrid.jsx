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
//   look       'card' (the default): the grid on its own Card.
//              'strip': the fact strip under the player page's hero (#1882).
//              No Card: it sits flush inside a stamped card, under an ink
//              rule, three facts across on a phone and six on a wide screen
//              (system/stamped/stamped.css).
//
// Like Card, it computes and fetches nothing, so it may render inside a
// SealBox reveal too. The facts it holds are the caller's.
export function FactGrid({ as: Grid = 'dl', look = 'card', className = '', children }) {
  if (look === 'strip') {
    return <Grid className={`factgrid factgrid--strip ${className}`.trim()}>{children}</Grid>
  }
  if (look !== 'card') throw new Error(`FactGrid: unknown look "${look}" (card, strip)`)
  return (
    <Card as="div" body="flush" className={`factgrid ${className}`.trim()}>
      <Grid className="factgrid__grid">{children}</Grid>
    </Card>
  )
}
