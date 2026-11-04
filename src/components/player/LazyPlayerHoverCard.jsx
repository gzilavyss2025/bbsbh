import { Suspense, useState, useSyncExternalStore } from 'react'
import { lazyNamed } from '../../lib/react/lazyNamed.js'
import { subscribeHover, getHoverSnapshot } from '../../lib/playerHoverStore.js'
import { PanelBoundary } from '../ui/state/LazyPanel.jsx'

const PlayerHoverCard = lazyNamed(() => import('./PlayerHoverCard.jsx'), 'PlayerHoverCard')

// Always mounted by App.jsx; loads the card's chunk (its whole data path) only
// once the hover store first holds a target. The store starts the download as
// soon as a hover is scheduled (playerHoverStore.js), so it overlaps the 300 ms
// intent delay. The snapshot is the boolean "is a card open", so this re-renders
// only when a card opens or closes, not on every hover commit. A failed chunk
// leaves the card absent (PanelBoundary) rather than taking the app down.
export function LazyPlayerHoverCard() {
  const open = useSyncExternalStore(subscribeHover, () => getHoverSnapshot().id != null)
  const [seen, setSeen] = useState(false)
  if (open && !seen) setSeen(true)
  return seen ? (
    <PanelBoundary>
      <Suspense fallback={null}>
        <PlayerHoverCard />
      </Suspense>
    </PanelBoundary>
  ) : null
}
