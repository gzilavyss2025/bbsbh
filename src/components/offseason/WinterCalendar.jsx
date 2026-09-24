import { useMemo } from 'react'
import { useCopy } from '../../copy/copyContext.js'
import { currentMilestone, daysBetween, parseWinterCalendar } from '../../lib/time/seasonPhase.js'
import { monthDayShort } from '../../lib/dates.js'

// THE WINTER CALENDAR — the dated strip under the wire, and the countdown that
// takes the rail slot the wire vacated.
//
// The winter has a shape a scorer keeps in their head: the GM meetings, the
// 40-man deadline, the Rule 5 draft, arbitration filing, the Hall of Fame vote,
// the day pitchers and catchers report. None of those six is in statsapi, and
// every one of them moves from winter to winter, so they live in the copy
// registry (`offseason.calendar`), editable at /admin, rather than in a table
// this file would be asserting without a source. The registry's default holds
// one winter's estimates, marked "(est.)" (issue #1038).
//
// TWO DATES ARE NOT TYPED, because two of them can be checked: spring
// training's first game and Opening Day come off the next season's own row and
// are appended here. They are the reason an unedited calendar is short rather
// than empty — and the reason the strip can fail closed on everything else.
//
// FAILING CLOSED IS THE POINT. parseWinterCalendar drops any line that is not
// `YYYY-MM-DD | Label`, and any line dated outside the offseason now on screen.
// So a calendar left over from last winter renders as nothing, and the strip is
// two checkable dates instead of six confidently wrong ones. The alternative —
// MM-DD with the year filled in — would reprint last winter's Rule 5 date every
// December, which is a worse failure than a short strip because it looks right.
export function WinterCalendar({ winter }) {
  const { t } = useCopy()
  const typed = t('offseason.calendar')

  const rows = useMemo(() => {
    const parsed = parseWinterCalendar(typed, {
      startDate: winter.startDate,
      endDate: winter.endDate,
    })
    // Appended, then re-sorted with the typed rows rather than pinned to the
    // end: spring training opens before Opening Day, but an admin may well
    // type a date that falls between them.
    const anchors = []
    if (winter.springStartDate) {
      anchors.push({ date: winter.springStartDate, label: 'Spring training', fixed: true })
    }
    if (winter.openingDay) {
      anchors.push({ date: winter.openingDay, label: 'Opening Day', fixed: true })
    }
    return [...parsed, ...anchors].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }, [typed, winter.startDate, winter.endDate, winter.springStartDate, winter.openingDay])

  const next = currentMilestone(rows, winter.today)

  if (rows.length === 0) return null

  return (
    <nav className="wintercal" aria-label="The winter calendar">
      <ol className="wintercal__list">
        {rows.map((row, i) => (
          <li
            key={`${row.date}-${row.label}`}
            className={`wintercal__item${i === next ? ' wintercal__item--next' : ''}${
              i < next || next < 0 ? ' wintercal__item--past' : ''
            }`}
            // The one that has not happened yet is the reader's place in the
            // winter, so it is named for a screen reader rather than left to
            // the colour change alone.
            aria-current={i === next ? 'date' : undefined}
          >
            <span className="wintercal__date">{monthDayShort(row.date)}</span>
            <span className="wintercal__label">{row.label}</span>
          </li>
        ))}
      </ol>
    </nav>
  )
}

// The countdown. Wide, this is what stands in the rail slot the wire left; on a
// phone it follows the calendar inside the lead. Either way it counts to a date
// off the schedule rather than a typed one, so the number cannot be stale while
// the page is up.
//
// WHICH DATE depends on the level. At MLB the winter ends at spring training's
// first game, which is a real schedulable date on the season row. Below MLB
// there is no such date to count to — no minor-league season row carries a
// spring field at all (checked for 2025, 2026 and 2027 at every level) — and
// the level goes from no baseball straight to its own Opening Day, so that is
// what it counts to. One component either way: the difference is a date and a
// label, not a second countdown.
//
// Renders nothing at all when that date is unknown (the next season's rows
// missing or unreadable). A countdown is a promise about a specific day, and
// there is no honest version of it without the day.
export function WinterCountdown({ winter }) {
  const { t } = useCopy()
  const spring = Boolean(winter.springStartDate)
  const target = winter.springStartDate ?? winter.openingDay
  const days = daysBetween(winter.today, target)
  if (days == null || days < 0) return null

  return (
    <aside
      className="springcount"
      aria-label={spring ? 'Days until spring training' : 'Days until Opening Day'}
    >
      <p className="springcount__label">
        {t(spring ? 'offseason.springLabel' : 'offseason.openerLabel')}
      </p>
      <p className="springcount__n">{days}</p>
      <p className="springcount__day">
        {days === 1 ? 'day' : 'days'} — {monthDayShort(target)}
      </p>
    </aside>
  )
}
