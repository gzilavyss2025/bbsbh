import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchLeagueMoves, windowDaysFor } from '../../api/transactions/leagueFeed.js'
import { useAsync } from '../../hooks/useAsync.js'
import { MoveItems, flattenDays, takeStories } from './MoveRow.jsx'

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
// THE RAIL IS NOT ITS OWN SCROLLER, and is not sticky. It was both at first,
// and that cost the wheel: with the cursor over the rail, scrolling stopped
// moving the games. It scrolls with the page now, so the slate has exactly one
// scroller and no gesture has to be routed between two. 25-wide-layout.css
// carries that reasoning in full, including why sticky had to go with the cap.
//
// ---------------------------------------------------------------------------
// THE FIT: the wire may fill the page, never lengthen it
// ---------------------------------------------------------------------------
// MLB's window is three days (leagueFeed.js explains why two was really ~34
// hours), which runs 41 to 65 stories — around 4,000px of rail against a games
// column that is typically 1,900. AA/A+/A read wider windows off the same
// module (`windowDaysFor`) to make up for a level's own thinner news, so the
// story count below varies by level; the FIT below reads whatever the list
// holds rather than assuming MLB's count, so it needs no per-level branch.
// Left alone the wire would set the length of the slate, which is the same
// mistake the old card made, turned on its side.
//
// So the rail ends where the games end. It measures the column beside it and
// keeps the last WHOLE row that clears that height; the rest go behind one
// control. The page is exactly as long as the games make it, and the space the
// games do leave is filled rather than left blank — which is also what fixes
// the emptying-out the scroll-with-the-page change introduced.
//
// This is a measurement, and the card this replaced had one that went wrong, so
// the difference is worth stating. That card measured against the VIEWPORT and
// had to re-probe on every scroll-adjacent relayout; this measures against a
// SIBLING ELEMENT, which changes only when the slate's own content does. The
// bug it hit is still the bug to avoid: a measurement can only see rows that
// are IN the list, and trimming takes rows out, so measuring the trimmed list
// can only ever shrink the fit — it ratchets down and never recovers. The
// guard, same as before: every measurement runs against the FULL list.
// `probing` renders all of it for exactly the frame the measurement needs, and
// the layout effect trims inside that same frame, so the long list is measured
// and never painted (`.wirerail__list` is `overflow: hidden`).
//
// Below this the rail would be a stub rather than a ledger, so it holds its
// ground and overhangs the games instead. Beside a two-game slate that is the
// right trade; the alternative is a column showing one move.
const MIN_ROWS = 4
// Room kept for the "more" control while measuring. Reserved unconditionally,
// including in the case where everything fits and no control is drawn — the
// alternative is measuring twice to find out, and the cost of being wrong is
// 52px of slack at the foot of a rail nobody is reading to the pixel.
const DOOR_RESERVE = 52

// `fitTo` is a ref to the games column. Passed in rather than found by selector
// so the dependency is visible from GameSelect, where both are rendered.
function useFitToColumn(listRef, fitTo, ready) {
  const [budget, setBudget] = useState(null)
  const [rows, setRows] = useState(null)
  const [probing, setProbing] = useState(true)

  // Layout effect, not an effect: the measurement runs before paint, so the
  // clamp and the trim are both on the list the first time it is drawn.
  //
  // Inlined rather than lifted into a useCallback: the callback read two refs
  // and set two pieces of state, which the React Compiler refuses to compile
  // ("Existing memoization could not be preserved"). It has nothing to gain
  // from here anyway — the effect is the only caller.
  useLayoutEffect(() => {
    if (!ready || !probing) return
    const list = listRef.current
    const column = fitTo?.current
    if (!list || !column) {
      // Nothing to measure against — leave the rail whole rather than guessing
      // a row count for a layout we cannot see.
      setProbing(false)
      return
    }
    const listTop = list.getBoundingClientRect().top
    const space = column.getBoundingClientRect().bottom - listTop - DOOR_RESERVE
    setBudget(space)
    let fits = 0
    for (const child of list.children) {
      if (child.getBoundingClientRect().bottom - listTop > space) break
      if (child.dataset.moveRow != null) fits += 1
    }
    setRows(Math.max(MIN_ROWS, fits))
    setProbing(false)
  }, [fitTo, listRef, probing, ready])

  // A ResizeObserver on the COLUMN rather than a window resize listener: the
  // games column changes height for reasons a window resize never fires on — a
  // result filter applied, the slate's own fetch landing, an Off Day section
  // appearing. Re-opening the probe (rather than measuring in place) is what
  // lets the fit grow again when the column gets taller.
  useEffect(() => {
    const column = fitTo?.current
    if (!ready || !column || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setProbing(true))
    observer.observe(column)
    return () => observer.disconnect()
  }, [fitTo, ready])

  return { budget, rows: probing ? null : rows }
}

// ---------------------------------------------------------------------------

// PRESENCE, and why the caller needs telling. The rail renders nothing while
// loading, on a failed fetch, and on a genuinely quiet window — and only IT
// knows which, because the answer arrives with the fetch. The slate has to
// widen its shell to make room for a rail (see .screen--wirerail in
// 25-wide-layout.css), and it cannot wait for the fetch to do it: reserving the
// width only once the moves land would slide the game grid sideways a beat
// after first paint. So the slate reserves the room up front on what it knows
// synchronously (today + wide) and this reports back only to take it away
// again, which in season is the rare case. Reporting is deliberately held until
// the fetch settles for exactly that reason — an eager "nothing yet" would
// cause the very jump the arrangement exists to avoid.
export function WireRail({ endDate, sportId, onPresence, fitTo }) {
  const { data, loading } = useAsync(
    (signal) => fetchLeagueMoves(endDate, sportId, { signal }),
    [endDate, sportId],
  )
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef(null)

  const items = flattenDays(data)
  const total = items.filter((item) => item.kind === 'story').length
  const { budget, rows } = useFitToColumn(listRef, fitTo, total > 0)

  useEffect(() => {
    // Silence while the fetch is in flight — see PRESENCE above. On an error
    // `loading` clears with no data, which correctly reports an absent rail.
    if (loading) return
    onPresence?.(total > 0)
  }, [loading, onPresence, total])

  if (total === 0) return null

  // `rows === null` is the probe frame (and the no-column fallback): render
  // everything, so the measurement sees the full list.
  const collapsed = !expanded && rows != null
  const shown = collapsed ? takeStories(items, rows) : items
  const hidden = total - shown.filter((item) => item.kind === 'story').length

  return (
    // The visible head is the one word. The window and the count are NOT
    // repeated beside it: every row below already carries a spelled-out
    // dateline ("Thursday, August 20") with that day's count on it, so a
    // "48h · 10" in the head restated what the ledger says twice over. The
    // accessible name keeps the window, because a screen reader landing on
    // this region has not read the datelines yet.
    <aside
      className="wirerail"
      aria-label={`Transactions around the league, last ${windowDaysFor(sportId)} days`}
    >
      <div className="wirerail__head">
        {/* Mixed case here on purpose: the CSS applies the app's ALL-CAPS
            invariant, never a per-component .toUpperCase() (ADR-0017). */}
        <h2 className="wirerail__title">Transactions</h2>
      </div>
      <ul
        className="wirerail__list"
        ref={listRef}
        // Clamped to the measured budget only while collapsed, and only once a
        // budget exists. It is what stops the pre-measurement frame painting a
        // list longer than the fit is about to allow, so trimming to `rows`
        // changes nothing visible.
        style={collapsed && budget != null ? { maxHeight: `${budget}px` } : undefined}
      >
        <MoveItems items={shown} compact />
      </ul>
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          className="wirerail__door"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show fewer' : `${hidden} more`}
        </button>
      )}
    </aside>
  )
}
