import { useEffect } from 'react'
import { fetchLeagueMoves, windowDaysFor } from '../../api/transactions/leagueFeed.js'
import { useAsync } from '../../hooks/useAsync.js'
import { teamAbbr, teamPrimaryColor } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { MoveItems, cutlineText, dateline, flattenDays } from './MoveRow.jsx'
import { Pill } from '../ui/control/Pill.jsx'
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
// Spoiler safety needs no argument here and gets none: a roster move carries no
// score (api/transactions/leagueFeed.js is spoiler-free), so there is no
// SealBox in this file and none is wanted.

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

  const clubInk = newest ? teamPrimaryColor(newest.teamId) || 'var(--graphite)' : 'var(--graphite)'
  const newestAbbr = newest ? teamAbbr({ id: newest.teamId }) : ''
  const newestLine = newest ? cutlineText(newest.cutline) : ''

  return (
    <SheetDock
      label="Roster moves around the league"
      bodyId="wire-dock-list"
      style={{ '--wire-club': clubInk }}
      measureKey={total}
      title="Transactions"
      note={`${singleDay ? dateline(endDate) : `Last ${windowDaysFor(sportId)} days`} · ${total}`}
      closeLabel="Collapse roster moves"
      collapsed={
        // The club's colour spine and mark answer "whose move?" before a word
        // is read — the same job they do on a ledger row, in one line.
        <>
          <span className="wiredock__spine" aria-hidden="true" />
          {newest && <TeamLogo teamId={newest.teamId} size={20} className="wiredock__mark" />}
          <span className="wiredock__line">
            <span className="wiredock__club">{newestAbbr}</span>
            <span className="wiredock__cut">{newestLine}</span>
          </span>
          <Pill fill="paper" figure className="wiredock__count">{total}</Pill>
          <span className="wiredock__chevron" aria-hidden="true">⌃</span>
        </>
      }
    >
      <MoveItems items={items} />
    </SheetDock>
  )
}
