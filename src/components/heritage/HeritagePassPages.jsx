import { useCallback, useEffect, useRef, useState } from 'react'
import { passDate, heritagePassModel } from '../../lib/heritage/pass.js'
import { HeritagePass } from './HeritagePass.jsx'
import { heritageArt } from '../../lib/heritage/art.js'
import { gamePath } from '../../lib/route.js'
import { useRouteLink } from '../../lib/nav.js'
import { Stack } from '../ui/layout/Stack.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'
import { Button } from '../ui/control/Button.jsx'

// Only the owner's active stamps may supply tickets, including unplaced stamps.
// Facts alone never add a game. This view does not alter book placements.
// `loading` and `failed` describe the facts read, so a ticket says why it is blank.
export function HeritagePassPages({ stamps, factsByPk, loading = false, failed = false }) {
  const linkProps = useRouteLink()
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
    <Stack as="section" gap="loose" className="heritagepasses" aria-label="Souvenir tickets">
      <Cluster className="heritagepasses__head" align="center">
        <h2>Souvenir tickets</h2>
        <Cluster as="nav" aria-label="Souvenir ticket navigation">
          <Button disabled={edges.start} onClick={() => turn(-1)} aria-label="Previous souvenir ticket">‹ Previous</Button>
          <Button disabled={edges.end} onClick={() => turn(1)} aria-label="Next souvenir ticket">Next ›</Button>
        </Cluster>
      </Cluster>
      <ul ref={rail} className="heritagepasses__rail" aria-label="Your stamped game tickets" tabIndex={0} onScroll={updateEdges}>
        {stamps.map((entry) => {
          const game = factsByPk[entry.gamePk]
          return (
            <li key={entry.gamePk} className="heritagepasses__ticket">
              {heritagePassModel(game) ? (
                <a className="heritagepasses__link"
                  {...linkProps(gamePath(game.date, game.away.abbreviation, game.home.abbreviation, 'lineup1', game.gameNumber))}
                  aria-label={`Open ${game.away.name} at ${game.home.name}, ${passDate(game.date)}`}>
                  <HeritagePass game={game} artwork={heritageArt(game.venue)} />
                </a>
              ) : <p>{passDate(entry.date)} · {loading ? 'Loading game details…'
                : failed ? 'Game details could not load' : 'Game details not available'}</p>}
            </li>
          )
        })}
      </ul>
    </Stack>
  )
}
