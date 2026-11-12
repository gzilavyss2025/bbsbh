import { fetchLeagueMoves, windowDaysFor } from '../../api/transactions/leagueFeed.js'
import { shiftDays } from '../../lib/time/standingsDates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { MoveItems, flattenDays, takeStories } from '../transactions/MoveRow.jsx'
import { LongAtBats } from './LongAtBats.jsx'
import { RecordDoors, SeasonRecord } from './SeasonRecord.jsx'
import { WinterCalendar } from './WinterCalendar.jsx'
import { TopFreeAgents } from './TopFreeAgents.jsx'
import { useLayoutEffect, useRef, useState } from 'react'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { EmptyState } from '../ui/state/EmptyState.jsx'
import { ClubStrip } from './ClubStrip.jsx'
import { useRouteLink } from '../../lib/nav.js'
import { ALL_MLB_TEAM_IDS, teamAbbr } from '../../lib/teams.js'
const MLB_CLUBS = new Set(ALL_MLB_TEAM_IDS)

// A club's moves: the ones it filed, and the ones that name it (a trade partner).
const forClub = (days, id) =>
  id == null || !days ? days : days.map((d) => ({ ...d, stories: (d.stories ?? []).filter((s) => s.teamId === id || s.cutline?.some((g) => g.teamId === id)) }))

// THE OFFSEASON LEAD — the same roster wire, promoted.
//
// In season the wire is a secondary feed and is shaped like one: a narrow rail
// down the right of the games, fitted to the height of the column beside it so
// it fills the page without lengthening it (WireRail.jsx has that reasoning in
// full). All of that is an argument about the GAMES — that the slate's own
// content must keep the fold, and the wire may have the margin.
//
// From November to February there are no games to keep the fold, and the wire
// is the most-read thing in baseball. So on the MLB offseason page it stops
// being the margin and becomes the page: full width, the reader's first line
// of type, with the winter's dated calendar under it.
//
// It is the same feed, the same window and the same rows. Nothing new is
// fetched and nothing new is sealed — a roster move and its date carry no
// score, which is why the wire has never needed a SealBox and does not need
// one here (see api/transactions/leagueFeed.js). The offseason page changes
// where this surface SITS, not what it is allowed to say.
//
// THE WINDOW IS STILL THE WINDOW. It was worth checking whether a feed built
// for a busy season has anything to lead a page with in December, so the raw
// endpoint was measured over eight five-day windows across the 2025-26 winter:
// the quietest, the week of Christmas, returned 223 rows, and the week the
// season ended returned 2,017 — against 1,409 for a June window taken for
// scale. The winter wire is not thin. So the window is left exactly as it is,
// and the line under the heading says which window it is rather than claiming
// the whole offseason. Widening it to the season-long feed the design sketches
// is a real change to leagueFeed.js's backtested window, not a copy edit.
//
// EVERY MOVE, TEN AT A TIME. The ledger opens on ten moves and a door adds ten
// more. When the window runs out, the door reaches back one more window of
// days, so a reader can keep going through the winter.
const STEP = 10
const MAX_BACKFILL = 6

export function OffseasonLead({ endDate, sportId, winter, children }) {
  const [pages, setPages] = useState(1)
  const [cap, setCap] = useState(null)
  const [kept, setKept] = useState(null)
  const listRef = useRef(null)
  const [visible, setVisible] = useState(STEP)
  const [teamId, setTeamId] = useState(null)
  const span = windowDaysFor(sportId)
  // One window per page, newest first, each ending where the last began. It
  // may reach back past the winter's first day: October's moves are moves too.
  const ends = Array.from({ length: pages }, (_, i) => shiftDays(endDate, -i * span))
  const { data, loading } = useAsync(
    (signal) =>
      Promise.all(ends.map((end) => fetchLeagueMoves(end, sportId, { signal, singleDay: false }))).then(
        (all) => all.flat(),
      ),
    [endDate, sportId, pages],
  )
  // A different day or level starts the ledger over.
  const [prevKey, setPrevKey] = useState(`${endDate}-${sportId}`)
  if (prevKey !== `${endDate}-${sportId}`) {
    setPrevKey(`${endDate}-${sportId}`)
    setPages(1)
    setVisible(STEP)
    setCap(null)
    setKept(null)
    setTeamId(null)
  }

  // While an older window loads, keep the moves already on screen.
  if (data && data !== kept) setKept(data)
  const days = data ?? kept
  const items = flattenDays(forClub(days, teamId))
  // The clubs in hand, the same strip as the longest at-bats (LongAtBats.jsx).
  const clubs = [
    ...new Set(
      (days ?? []).flatMap((day) =>
        (day.stories ?? []).flatMap((st) => [st.teamId, ...(st.cutline ?? []).map((seg) => seg.teamId)]),
      ),
    ),
  ]
    .filter((id) => MLB_CLUBS.has(id))
    .sort((x, y) => teamAbbr({ id: x }).localeCompare(teamAbbr({ id: y })))
  const pickClub = (id) => {
    setTeamId(id)
    setVisible(STEP)
    setCap(null)
  }
  const total = items.filter((item) => item.kind === 'story').length
  // A quiet window (one move on a Monday in November) left the card a single
  // row tall on a phone. Reach back, a window at a time, until the first ten
  // are in hand — capped so a club with no winter news stops looking.
  // Once per landed fetch, so a render before the next fetch starts cannot skip ahead.
  const [filled, setFilled] = useState(null)
  if (data && data !== filled && !loading && total < visible && pages < MAX_BACKFILL) {
    setFilled(data)
    setPages((n) => n + 1)
  }
  const shown = takeStories(items, visible)
  // The card keeps the height its first ten moves gave it; more moves scroll
  // inside it, and each press scrolls to the first of the new ones.
  const nextTop = useRef(null)
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    if (nextTop.current != null && list.scrollHeight > nextTop.current) {
      list.scrollTop = nextTop.current
      nextTop.current = null
    }
  }, [shown.length])
  const showMore = () => {
    const list = listRef.current
    if (list && cap == null) setCap(list.offsetHeight)
    if (list) nextTop.current = list.scrollHeight
    setVisible((n) => n + STEP)
    // Out of moves in hand: reach back one more window.
    if (total <= visible + STEP) setPages((n) => n + 1)
  }

  return (
    <section
      className="oseason"
      aria-label={`The ${winter.seasonEnded} offseason`}
    >
      {/* The hero: how the season finished, beside the days until the next
          one. One row of two stamped cards; a phone stacks them. */}
      <div className="ohero">
        <SeasonRecord sportId={sportId} season={winter.seasonEnded} dateStr={endDate} />
        <div className="ohero__side">
          {children}
          <RecordDoors />
        </div>
      </div>

      <WinterCalendar winter={winter} />

      <TopFreeAgents season={winter.seasonEnded} />

      {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
          invariant is never a per-component .toUpperCase() (ADR-0017). */}
      <SectionHead as="h2" className="oseason__head">
        Transactions
      </SectionHead>

      {/* The wire renders nothing at all while its fetch is in flight and on a
          failure — the same silence the rail keeps. On the offseason page that
          silence would leave the reader looking at a bare heading, so the lead
          says which of the two it is rather than showing an empty ledger. */}
      {days?.some((d) => d.stories?.length) ? (
        <>
          {/* The ledger card: its moves, and the door as its footer bar. */}
          <div className="oseason__ledger">
            {clubs.length > 0 && <ClubStrip className="oseason__clubs" clubs={clubs} value={teamId} onPick={pickClub} />}
            {/* One ledger line per move: faces, the sentence, the club. */}
            <ul className="oseason__list" ref={listRef} style={cap ? { maxHeight: cap, overflowY: 'auto' } : undefined}>
              {total > 0 ? (
                <MoveItems items={shown} marks />
              ) : (
                <li className="oseason__none">{`No moves for this club in the last ${span * pages} days.`}</li>
              )}
            </ul>
            <button
              type="button"
              className="door door--boxed door--bar oseason__door"
              onClick={showMore}
              disabled={loading}
            >
              {loading ? 'Reading the wire…' : `${STEP} more`}
            </button>
          </div>
        </>
      ) : loading ? (
        <p className="oseason__loading" role="status">Reading the wire…</p>
      ) : (
        <EmptyState className="oseason__empty" role="status">
          {`No moves filed in the last ${windowDaysFor(sportId)} days.`}
        </EmptyState>
      )}

      <RevisitSeason season={winter.seasonEnded} />

      {/* The season's notebook: one row of stamped cards (LongAtBats.jsx). */}
      <LongAtBats season={winter.seasonEnded} />
    </section>
  )
}

// Doors to the season's standalone boards, between the wire and the notebook.
const REVISIT = [
  ['Streak Finder', '/streaks'],
  ['Best Stretch', '/best-stretch'],
  ['Pressure Moments', '/pressure-moments'],
  ['Situational Records', '/situational-records'],
  ['League Leaders', '/leaders'],
  ['ABS Challenges', '/abs-challenges'],
  ['Games After Elimination', '/eliminated'],
  ['Standing Out', '/outliers'],
]
function RevisitSeason({ season }) {
  const linkProps = useRouteLink()
  return (
    <section className="oseason__revisit" aria-label={`Revisit the ${season} season`}>
      <SectionHead as="h3" className="oseason__head">{`Revisit the ${season} season`}</SectionHead>
      <div className="oseason__revisitgrid">
        {REVISIT.map(([label, path]) => (
          <a key={path} className="door door--boxed door--stamped srecord__door" {...linkProps(path)}>
            {label}
          </a>
        ))}
      </div>
    </section>
  )
}
