import { Suspense, useState, useSyncExternalStore } from 'react'
import { lazyNamed } from '../../lib/react/lazyNamed.js'
import { subscribeHover, getHoverSnapshot } from '../../lib/playerHoverStore.js'

const PlayerHoverCard = lazyNamed(() => import('./PlayerHoverCard.jsx'), 'PlayerHoverCard')

// Always mounted by App.jsx; loads the card's chunk (its whole data path) only
// once the hover store first holds a target. The store keeps that target, so the
// card reads it on mount. Once loaded it stays mounted.
export function LazyPlayerHoverCard() {
  const { id } = useSyncExternalStore(subscribeHover, getHoverSnapshot, getHoverSnapshot)
  const [seen, setSeen] = useState(false)
  if (id != null && !seen) setSeen(true)
  return seen ? (
    <Suspense fallback={null}>
      <PlayerHoverCard />
    </Suspense>
  ) : null
}
