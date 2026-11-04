import { useMemo } from 'react'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { useCopy } from '../../copy/copyContext.js'
import { currentMilestone, daysBetween, parseWinterCalendar } from '../../lib/time/seasonPhase.js'
import { monthDayName } from '../../lib/dates.js'
import { useRouteLink } from '../../lib/nav.js'

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
// The free agency entry opens the season's free-agent class (#2509). Matched by
// its words, since the calendar's lines are admin-edited copy.
const FREE_AGENCY = /free agen/i

export function WinterCalendar({ winter }) {
  const { t } = useCopy()
  const linkProps = useRouteLink()
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
      anchors.push({ date: winter.springStartDate, label: 'Spring training games start', fixed: true })
    }
    if (winter.openingDay) {
      anchors.push({ date: winter.openingDay, label: 'Opening Day', fixed: true })
    }
    return [...parsed, ...anchors].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }, [typed, winter.startDate, winter.endDate, winter.springStartDate, winter.openingDay])

  const next = currentMilestone(rows, winter.today)

  if (rows.length === 0) return null

  // One column per month, so the winter reads as a calendar page rather than
  // a strip: the month once, then each date as a day number beside its label.
  const months = []
  rows.forEach((row, i) => {
    const day = monthDayName(row.date).split(' ')[1]
    const [y, m, d] = row.date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).toLocaleString('en-US', { weekday: 'short' })
    const mon = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
    if (months.at(-1)?.mon !== mon) months.push({ mon, items: [] })
    months.at(-1).items.push({ ...row, day, dow, i })
  })

  return (
    <nav className="wintercal" aria-label="The winter calendar">
      <SectionHead as="h2" className="wintercal__head">Winter calendar</SectionHead>
      <ol className="wintercal__months">
        {months.map(({ mon, items }) => (
          <li key={mon} className="wintercal__month">
            <p className="wintercal__mon">{mon}</p>
            <ol className="wintercal__list">
              {items.map(({ date, label, day, dow, i }) => (
                <li
                  key={`${date}-${label}`}
                  className={`wintercal__item${i === next ? ' wintercal__item--next' : ''}${
                    i < next || next < 0 ? ' wintercal__item--past' : ''
                  }`}
                  // The one that has not happened yet is the reader's place in
                  // the winter, so it is named for a screen reader rather than
                  // left to the colour change alone.
                  aria-current={i === next ? 'date' : undefined}
                >
                  <span className="wintercal__day">
                    <span className="wintercal__dow">{dow}</span>
                    {day}
                  </span>
                  <span className="wintercal__label">
                    {FREE_AGENCY.test(label) ? (
                      <a className="plink wintercal__link" {...linkProps(`/free-agents/${winter.seasonEnded}`)}>
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </span>
                </li>
              ))}
            </ol>
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
// A spring training photo across the top of the card, picked by hand (an
// image id on img.mlbstatic.com, its 5x2 cut).
const SPRING_PHOTO = 'https://img.mlbstatic.com/mlb-images/image/private/t_5x2/t_w2208/mlb/rqr0tlmzxa0bntwmdvxu.jpg'
// The two spring leagues' own marks on MLB's logo CDN: 114 is the Cactus
// League (Arizona), 115 the Grapefruit League (Florida).
const SPRING_LEAGUES = [
  { id: 114, name: 'Cactus League' },
  { id: 115, name: 'Grapefruit League' },
]

export function WinterCountdown({ winter }) {
  const { t } = useCopy()
  const spring = Boolean(winter.springStartDate)
  const target = winter.springStartDate ?? winter.openingDay
  const days = daysBetween(winter.today, target)
  if (days == null || days < 0) return null

  return (
    <Card
      as="aside"
      frame="stamped"
      body="flush"
      className="springcount"
      aria-label={spring ? 'Days until spring training' : 'Days until Opening Day'}
    >
      {spring && (
        <span className="springcount__photo">
          <img src={SPRING_PHOTO} alt="" loading="lazy" decoding="async" />
        </span>
      )}
      {spring && (
        <div className="springcount__leagues">
          {SPRING_LEAGUES.map(({ id, name }) => (
            <img
              key={id}
              className="springcount__league"
              src={`https://www.mlbstatic.com/team-logos/league-on-light/${id}.svg`}
              alt={name}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}
      <p className="springcount__label">
        {t(spring ? 'offseason.springLabel' : 'offseason.openerLabel')}
      </p>
      <p className="springcount__n">
        {days} {days === 1 ? 'day' : 'days'}
      </p>
      <p className="springcount__day">
        {new Date(`${target}T12:00:00Z`).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })}
      </p>
    </Card>
  )
}
