import { useEffect } from 'react'
import { fetchLeagueMoves } from '../../api/transactions/leagueFeed.js'
import { useAsync } from '../../hooks/useAsync.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { MoveItems, cutlineText, flattenDays } from './MoveRow.jsx'
import { SheetDock } from '../ui/dock/SheetDock.jsx'

// THE WIRE DOCK — the phone's presentation of the league's roster moves.
//
// The sheet itself (three detents, the drag, the measured floor the slate pads
// by) is ui/dock/SheetDock.jsx, shared with the postseason's BracketDock. This
// file is only what the wire puts IN it: the newest move on the resting rail,
// and the ledger in the body. (A tablet and a desktop get the same feed as
// WireRail.jsx beside the games instead — ADR-0062. Sideways is not on offer
// at 390pt, which is why this file still exists.)
//
// A roster move carries no score (api/transactions/leagueFeed.js), so there is
// no SealBox in this file and none is wanted.

export function WireDock({ endDate, sportId, onPresence, singleDay = false }) {
  const { data } = useAsync(
    (signal) => fetchLeagueMoves(endDate, sportId, { signal, singleDay }),
    [endDate, sportId, singleDay],
  )

  const items = flattenDays(data)
  const stories = items.filter((item) => item.kind === 'story')
  const total = stories.length
  const newest = stories[0]?.story ?? null
  const present = total > 0

  useEffect(() => {
    onPresence?.(present)
  }, [onPresence, present])

  // Renders nothing while loading, on a failed fetch, and on a genuinely quiet
  // window — the slate is the page, and an empty rail pinned across the
  // bottom of it would cost a permanent strip of screen to say nothing.
  if (!present) return null

  const newestLine = newest ? cutlineText(newest.cutline) : ''

  return (
    <SheetDock
      label="Roster moves around the league"
      bodyId="wire-dock-list"
      measureKey={total}
      title="Transactions"
      // The same ledger look as the offseason page and the club ledger.
      bodyClassName="oseason__list"
      closeLabel="Collapse roster moves"
      collapsed={
        // The same face as the open sheet: its title, then the newest move as
        // a ledger row says it (club mark, sentence), and the arrow that opens it.
        <>
          <span className="wiredock__railtitle">Transactions</span>
          {newest && <TeamLogo teamId={newest.teamId} size={18} className="wiredock__mark" />}
          <span className="wiredock__cut">{newestLine}</span>
          <span className="wiredock__open" aria-hidden="true">See all ›</span>
        </>
      }
    >
      <MoveItems items={items} marks />
    </SheetDock>
  )
}
