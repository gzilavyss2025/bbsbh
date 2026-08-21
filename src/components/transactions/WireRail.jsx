import { useEffect } from 'react'
import { fetchLeagueMoves } from '../../api/transactions/leagueFeed.js'
import { useAsync } from '../../hooks/useAsync.js'
import { MoveItems, flattenDays } from './MoveRow.jsx'

// THE WIRE RAIL — the wide surface's presentation of the league's roster moves
// (issue #772). Spoiler-free: a roster move and its date carry no score, so
// there is no SealBox here and none is wanted (see
// api/transactions/leagueFeed.js).
//
// It replaces LeagueMovesCard, which put this same feed ABOVE the game list.
// That card was measured on a real 1440x900 window and it ran from y=183 to
// y=841 — 658px of a 900px viewport, which put every one of the day's game
// cards below the fold. The slate opened on other clubs' paperwork.
//
// The card was ALSO too wide for what it held: its rows were 896px and the
// longest cutline used about 55% of that. Too tall and too wide at the same
// time, on a shell that caps at 960px inside windows that are routinely 1440 —
// so roughly 480px of the page sat empty while the games were pushed off it.
//
// So the wire stops taking VERTICAL space and starts taking HORIZONTAL space.
// It runs down the right of the games in margin the page was already wasting.
// This is the shape every dense data site converges on for a secondary feed
// beside a primary one, and the reason is always the same: horizontal space
// costs the primary content nothing.
//
// What that buys, measured against the card it replaces at 1440x900:
//
//                     games above the fold      moves shown
//   LeagueMovesCard            0                  7 of 10, behind a door
//   WireRail                   6                 10 of 10, no door
//
// The rail is BETTER for the wire, not a demotion of it. That is worth stating
// plainly, because "move it out of the way" usually means "show less of it",
// and here it does not: every story is drawn, however busy the 48 hours were,
// and none of them costs the games a pixel of height.
//
// THE RAIL IS NOT ITS OWN SCROLLER. It was, briefly — capped to the viewport,
// sticky, `overscroll-behavior: contain` — and that cost the wheel: with the
// cursor over the rail, scrolling stopped moving the games. It scrolls with the
// page now, so the slate has exactly one scroller and no gesture has to be
// routed between two. 25-wide-layout.css carries the full reasoning, including
// why sticky had to go with the cap.
//
// THREE THINGS THIS FILE NO LONGER DOES, all of which the card had to:
//   * No fitted-row measurement. The card walked its rendered rows to find how
//     many cleared a height budget, re-probing on every resize, because it had
//     to end on a whole row at the fold. A rail beside the games has no fold to
//     end at, so `useFittedRows` and its MIN/MAX/DEFAULT row counts are gone.
//   * No door. "All 10 moves" existed because the fit hid some; nothing is
//     hidden now.
//   * No expanded state. Same reason.
//
// WHAT IT STILL SHARES with the phone's dock (WireDock.jsx): the feed, the
// grouping, and MoveRow.jsx. A move is drawn in exactly one place. The rail
// asks for MoveRow's `compact` variant — no photo rail, the leading banner up
// beside the club — because 288px will not hold a face column and a readable
// sentence; the reasoning lives on MoveRow itself.
//
// PRESENCE, and why the caller needs telling. The rail renders nothing while
// loading, on a failed fetch, and on a genuinely quiet 48 hours — and only IT
// knows which, because the answer arrives with the fetch. The slate has to
// widen its shell to make room for a rail (see .screen--wirerail in
// 25-wide-layout.css), and it cannot wait for the fetch to do it: reserving
// the width only once the moves land would slide the game grid sideways a
// beat after first paint. So the slate reserves the room up front on what it
// knows synchronously (today + MLB + wide) and this reports back only to take
// it away again, which in season is the rare case. Reporting is deliberately
// held until the fetch settles for exactly that reason — an eager "nothing
// yet" would cause the very jump the arrangement exists to avoid.
export function WireRail({ endDate, onPresence }) {
  const { data, loading } = useAsync((signal) => fetchLeagueMoves(endDate, { signal }), [endDate])

  const items = flattenDays(data)
  const total = items.filter((item) => item.kind === 'story').length

  useEffect(() => {
    // Silence while the fetch is in flight — see PRESENCE above. On an error
    // `loading` clears with no data, which correctly reports an absent rail.
    if (loading) return
    onPresence?.(total > 0)
  }, [loading, onPresence, total])

  if (total === 0) return null

  return (
    // The visible head is the one word. The window and the count are NOT
    // repeated beside it: every row below already carries a spelled-out
    // dateline ("Thursday, August 20") with that day's count on it, so a
    // "48h · 10" in the head restated what the ledger says twice over. The
    // accessible name keeps the window, because a screen reader landing on
    // this region has not read the datelines yet.
    <aside className="wirerail" aria-label="Transactions around the league, last 48 hours">
      <div className="wirerail__head">
        {/* Mixed case here on purpose: the CSS applies the app's ALL-CAPS
            invariant, never a per-component .toUpperCase() (ADR-0017). */}
        <h2 className="wirerail__title">Transactions</h2>
      </div>
      <ul className="wirerail__list">
        <MoveItems items={items} compact />
      </ul>
    </aside>
  )
}
