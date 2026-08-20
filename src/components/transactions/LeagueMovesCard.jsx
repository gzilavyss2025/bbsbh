import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchLeagueMoves } from '../../api/transactions/leagueFeed.js'
import { useAsync } from '../../hooks/useAsync.js'
import { MoveItems, flattenDays, takeStories } from './MoveRow.jsx'

// The slate's roster-move card — every club's moves from the last 48 hours,
// read live off the wire (issue #772). Spoiler-free: a roster move and its date
// carry no score, so there is no SealBox here and none is wanted (see
// api/transactions/leagueFeed.js).
//
// THIS IS THE WIDE SURFACE ONLY. A phone gets the same feed as a bottom-anchored
// dock instead (WireDock.jsx), because in the flow this card sits ABOVE the game
// list, and on a 390pt screen that is most of the first screen spent on other
// clubs' paperwork. A tablet and a desktop have the room, and a strip pinned
// across the bottom of a 1200px window is a phone idiom worn in the wrong place
// — so the two presentations split at the app's one layout breakpoint
// (WIDE_QUERY) and GameSelect picks. Both draw a move through MoveRow.jsx.
//
// It renders the SAME story shape the team page's Transactions card does —
// `groupLeagueWide` hands back `{ rail, cutline, type, typeLabel }` from the
// one pipeline, and nothing is re-derived here. What it does NOT reuse is
// `TeamTransactionsCard` itself, for a structural reason worth stating: that
// card is a horizontal deck of paper cards sitting UNDER a club's own name,
// so its cutline never says whose move it is (`stripLeadingClub` takes the
// club out, because the page already answered). Drop those cards on a
// league-wide feed and half of them read "Sent LHP Kent Emanuel outright to
// Louisville Bats" with no subject at all. Naming the club is therefore not
// decoration on this surface — it is the sentence's missing half, which is
// why every row leads with a colour spine, a mark and an abbreviation.
//
// The layout is a wire ledger rather than a deck: a real 48 hours holds about
// 35 stories across 20 clubs, and the worst 48 hours of a month held 125
// (measured, .scratch/home-transactions/). A thirty-five-card horizontal
// swipe is the wrong shape for the busiest page in the app, and the slate
// below it is what the reader actually came for.

// ---------------------------------------------------------------------------
// Fitting the card to the page
// ---------------------------------------------------------------------------
// The card sits ABOVE the game list, so its height is taken straight out of
// the slate's. Rather than pick a row count and hope, it measures the space it
// actually has and ends on a WHOLE row — so the "all N moves" door always
// lands at the fold and the first game card is always visible beneath it.
//
// Rows are not a fixed height (a cutline runs one line to three), so the fit
// cannot be arithmetic on a constant; it walks the rendered rows and keeps the
// last one whose bottom clears the budget.
const MIN_ROWS = 3
const MAX_ROWS = 8
// The fallback a browser with no layout to measure keeps. Deliberately
// mid-range rather than MAX_ROWS: on the one surface that can't measure, too
// few is a stub and too many is the card taking over the slate.
const DEFAULT_ROWS = 5
// Room left below the card for the first game card to show through. A card
// that filled the viewport exactly would read as the page, which this is not.
const PEEK_PX = 108

// A measurement can only see rows that are IN the list, and the trim takes the
// ones past the fit back out again — so measuring the list as it stands can
// only ever shrink the card, never grow it back. Left that way the fit ratchets
// down from its starting count and stops: a 1180px-tall iPad measured a 868px
// budget and then used 427px of it, and MAX_ROWS was unreachable at any size.
//
// So every measurement runs against the FULL candidate list. `probing` renders
// MAX_ROWS rows for exactly the frame the measurement needs, and the layout
// effect trims them back inside that same frame — the long list is measured,
// never painted (`.wirecard__list` is `overflow: hidden`, so even the clamped
// frame after a resize cannot show one).
function useFittedRows(listRef, ready) {
  const [budget, setBudget] = useState(null)
  const [rows, setRows] = useState(DEFAULT_ROWS)
  const [probing, setProbing] = useState(true)

  const measure = useCallback(() => {
    const list = listRef.current
    if (!list || typeof window === 'undefined') {
      // Nothing to measure — keep DEFAULT_ROWS rather than the probe's count.
      setProbing(false)
      return
    }
    const top = list.getBoundingClientRect().top
    const space = window.innerHeight - top - PEEK_PX
    setBudget(space)
    const children = [...list.children]
    let fits = 0
    for (const child of children) {
      if (child.getBoundingClientRect().bottom - top > space) break
      if (child.dataset.moveRow != null) fits += 1
    }
    setRows(Math.min(MAX_ROWS, Math.max(MIN_ROWS, fits)))
    setProbing(false)
  }, [listRef])

  // Layout effect, not an effect: the measurement runs before paint, so both
  // the clamp and the trim are already on the list the first time it is drawn
  // and an over-long list is never briefly visible.
  useLayoutEffect(() => {
    if (!ready || !probing) return
    measure()
  }, [measure, probing, ready])

  // A resize re-opens the probe rather than measuring in place, for the same
  // reason: a window that got taller has to be able to give rows back.
  useEffect(() => {
    if (!ready || typeof window === 'undefined') return
    const reprobe = () => setProbing(true)
    window.addEventListener('resize', reprobe)
    return () => window.removeEventListener('resize', reprobe)
  }, [ready])

  return { budget, rows: probing ? MAX_ROWS : rows }
}

// ---------------------------------------------------------------------------

// `endDate` is the slate's own day, and the caller only mounts this when that
// day is today — "the last 48 hours" is a claim about now, and on a July slate
// a card of August moves reads as a bug rather than as news. The prop stays
// explicit rather than being read from a clock in here so the card is
// testable and so the screen keeps owning what day it is showing.
export function LeagueMovesCard({ endDate }) {
  const { data } = useAsync((signal) => fetchLeagueMoves(endDate, { signal }), [endDate])
  const [expanded, setExpanded] = useState(false)
  const listRef = useRef(null)

  const items = flattenDays(data)
  const total = items.filter((item) => item.kind === 'story').length
  const { budget, rows } = useFittedRows(listRef, total > 0)
  const shown = expanded ? items : takeStories(items, rows)
  const hidden = total - shown.filter((item) => item.kind === 'story').length

  // Renders nothing while loading, on a failed fetch, and on a genuinely
  // quiet 48 hours — the slate is the page, and an empty shell above it would
  // cost the reader a scroll to learn nothing.
  if (total === 0) return null

  return (
    <section className="wirecard" aria-label="Roster moves around the league">
      <div className="wirecard__head">
        <h2 className="wirecard__title">Around the league</h2>
        <span className="wirecard__note">Last 48 hours</span>
      </div>
      <ul
        className="wirecard__list"
        ref={listRef}
        // Clamped to the measured budget only while collapsed, and only once
        // a budget exists. It is what keeps the pre-measurement frame from
        // showing a list longer than the fit is about to allow, so trimming
        // to `rows` changes nothing visible.
        style={!expanded && budget != null ? { maxHeight: `${budget}px` } : undefined}
      >
        <MoveItems items={shown} />
      </ul>
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          className="wirecard__door"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show fewer moves' : `All ${total} moves`}
          <span aria-hidden="true" className="wirecard__chevron">{expanded ? '‹' : '›'}</span>
        </button>
      )}
    </section>
  )
}
