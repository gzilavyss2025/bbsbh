import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { carryShows } from '../../../lib/scorecard/carry.js'

// Does the carry strip show? (ADR-0092.) True while the last opened box or a
// runner's box is outside the part of the pane a reader can read.
//
// MEASURED, NEVER COMPUTED (G2): the sheet's cells carry `data-carry` (the
// boxes the strip holds), and each is measured with getBoundingClientRect
// against the visible paper: under the sticky header, over the sticky foot row,
// right of the rail, inside the pane. Measured again after every render, which
// covers each tap and the lens's own seating scroll (useLens runs first in the
// same commit), and again once a pan of the pane settles. The result is a
// boolean, so a render that changes nothing re-renders nothing.
const SETTLE_MS = 120

export function useCarry({ on, paneRef, tableRef }) {
  const [show, setShow] = useState(false)

  const measure = useCallback(() => {
    const pane = paneRef.current
    const table = tableRef.current
    const rail = table?.querySelector('thead .sc-sheet__name')
    // The foot row's own cell: its cells stick to the pane's bottom, the
    // <tfoot> element's box stays where the table lays it.
    const foot = table?.querySelector('tfoot td')
    const cells = table ? [...table.querySelectorAll('[data-carry]')] : []
    if (!on || !pane || !rail || !foot || !cells.length) return setShow(false)
    const box = pane.getBoundingClientRect()
    setShow(
      carryShows(
        {
          top: table.tHead.getBoundingClientRect().bottom,
          bottom: foot.getBoundingClientRect().top,
          left: rail.getBoundingClientRect().right,
          right: box.left + pane.clientLeft + pane.clientWidth,
        },
        cells.map((c) => c.getBoundingClientRect()),
      ),
    )
  }, [on, paneRef, tableRef])
  // No dependency list, as useLens: a reveal or a new column moves boxes
  // without resizing the pane.
  useLayoutEffect(measure)

  useEffect(() => {
    const pane = paneRef.current
    if (!on || !pane) return undefined
    let timer
    const settle = () => {
      clearTimeout(timer)
      timer = setTimeout(measure, SETTLE_MS)
    }
    pane.addEventListener('scroll', settle, { passive: true })
    return () => {
      pane.removeEventListener('scroll', settle)
      clearTimeout(timer)
    }
  }, [on, paneRef, measure])

  return on && show
}
