import { useState } from 'react'
import { fetchLeagueMoves, windowDaysFor } from '../../api/transactions/leagueFeed.js'
import { useAsync } from '../../hooks/useAsync.js'
import { MoveItems, flattenDays, takeStories } from '../transactions/MoveRow.jsx'
import { LongAtBats } from './LongAtBats.jsx'
import { SeasonRecord } from './SeasonRecord.jsx'
import { WinterCalendar } from './WinterCalendar.jsx'
import { useCopy } from '../../copy/copyContext.js'
import { SectionHead } from '../ui/frame/SectionHead.jsx'

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
// A count rather than a fit: there is no games column to measure against, so
// the lead shows a fixed run of stories and puts the rest behind the rail's own
// door control. Six because the CALENDAR has to clear the fold — measured on a
// 1440x1000 window, eight stories and their datelines put the strip at y=984,
// which is the fold to the pixel. Six lands it near y=886 with the door above
// it, so a reader sees where they are in the winter without scrolling and still
// meets the ledger first.
const LEAD_ROWS = 6

export function OffseasonLead({ endDate, sportId, winter, children }) {
  const { t } = useCopy()
  const { data, loading } = useAsync(
    (signal) => fetchLeagueMoves(endDate, sportId, { signal, singleDay: false }),
    [endDate, sportId],
  )
  const [expanded, setExpanded] = useState(false)

  const items = flattenDays(data)
  const total = items.filter((item) => item.kind === 'story').length
  const shown = expanded ? items : takeStories(items, LEAD_ROWS)
  const hidden = total - shown.filter((item) => item.kind === 'story').length

  return (
    <section
      className="oseason"
      aria-label={`The ${winter.seasonEnded} offseason`}
    >
      {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
          invariant is never a per-component .toUpperCase() (ADR-0017). */}
      <SectionHead as="h2" className="oseason__head" note={t('offseason.leadNote')}>
        Transactions
      </SectionHead>

      {/* The wire renders nothing at all while its fetch is in flight and on a
          failure — the same silence the rail keeps. On the offseason page that
          silence would leave the reader looking at a bare heading, so the lead
          says which of the two it is rather than showing an empty ledger. */}
      {total > 0 ? (
        <>
          <ul className="oseason__list">
            <MoveItems items={shown} />
          </ul>
          {(hidden > 0 || expanded) && (
            <button
              type="button"
              className="oseason__door"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? 'Show fewer' : `${hidden} more`}
            </button>
          )}
        </>
      ) : (
        <p className="oseason__quiet" role="status">
          {loading
            ? 'Reading the wire…'
            : `No moves filed in the last ${windowDaysFor(sportId)} days.`}
        </p>
      )}

      {/* One note about the season the wire has just stopped covering, and the
          one door on this page that opens onto results — issue #1078, step 4.
          Both sit under the ledger because the wire is what a reader came for
          in December; the note is what they stay for. Either renders nothing
          when its file is not the season this page names. */}
      <LongAtBats season={winter.seasonEnded} />

      <SeasonRecord sportId={sportId} season={winter.seasonEnded} />

      <WinterCalendar winter={winter} />

      {/* The countdown, on a phone. Wide, it takes the rail slot the wire has
          just left and GameSelect mounts it there instead — so it is passed in
          rather than rendered here, and only one of the two ever exists. */}
      {children}
    </section>
  )
}
