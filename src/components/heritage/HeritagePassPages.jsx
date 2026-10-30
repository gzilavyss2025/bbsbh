import { useCallback, useEffect, useRef, useState } from 'react'
import { passDate, heritagePassModel } from '../../lib/heritage/pass.js'
import { HeritagePass } from './HeritagePass.jsx'
import { heritageArt } from '../../lib/heritage/art.js'
import { Stack } from '../ui/layout/Stack.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Button } from '../ui/control/Button.jsx'

// Only the owner's active stamps may supply tickets, including unplaced stamps.
// Facts alone never add a game. This view does not alter book placements.
export function HeritagePassPages({ stamps, factsByPk, onOpenGame }) {
  const rail = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: stamps.length < 2 })
  const updateEdges = useCallback(() => {
    const node = rail.current
    if (node) setEdges({ start: node.scrollLeft <= 1, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 1 })
  }, [])
  useEffect(() => {
    if (!rail.current) return
    const observer = new ResizeObserver(updateEdges)
    observer.observe(rail.current)
    return () => observer.disconnect()
  }, [stamps.length, updateEdges])
  const turn = (direction) => {
    const node = rail.current
    const ticket = node?.firstElementChild
    if (ticket) node.scrollBy({ left: direction * (ticket.offsetWidth + parseFloat(getComputedStyle(node).gap)) })
  }
  if (!stamps.length) return null
  return (
    <Stack as="section" gap="loose" className="heritagepasses" aria-label="Heritage Passes">
      <Cluster className="heritagepasses__head" align="center">
        <h2>Heritage Passes</h2>
        <Cluster as="nav" aria-label="Heritage Pass navigation">
          <Button disabled={edges.start} onClick={() => turn(-1)} aria-label="Previous Heritage Pass">‹ Previous</Button>
          <Button disabled={edges.end} onClick={() => turn(1)} aria-label="Next Heritage Pass">Next ›</Button>
        </Cluster>
      </Cluster>
      <ul ref={rail} className="heritagepasses__rail" aria-label="Your stamped game tickets" tabIndex={0} onScroll={updateEdges}>
        {stamps.map((entry) => (
          <li key={entry.gamePk} className="heritagepasses__ticket">
            {heritagePassModel(factsByPk[entry.gamePk]) ? <HeritagePass game={factsByPk[entry.gamePk]}
              artwork={heritageArt(factsByPk[entry.gamePk].venue)} /> : (
              <p>{passDate(entry.date)} · Game details not available</p>
            )}
            <Button className="heritagepasses__open" onClick={() => onOpenGame?.(entry.gamePk)}
              aria-label={`Open game, ${passDate(entry.date)}`}>Open game ›</Button>
          </li>
        ))}
      </ul>
    </Stack>
  )
}
