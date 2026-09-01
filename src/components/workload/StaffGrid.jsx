import { useMemo } from 'react'
import { bullpenStatusCounts } from '../../api/workload.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { DayStrip, DayStripKey } from './DayStrip.jsx'
import { PenDots } from './PenDots.jsx'

// THE STAFF GRID — one club's whole bullpen over a week, on one board.
//
// Rows are the pen, columns are the last seven days plus today (dashed, never
// spent), a cell is what he threw. That eighth column is not decoration: the
// row prints `last7dayPitches` in the total, and seven columns ending on today
// would start a day late and drop an outing the total still counted — a blank
// week beside a non-zero number (see staffGridFor's note).
// It is the shape every reliever tracker in the sport arrived at independently
// (Razzball's rolling usage matrix, The Hardball Times' bullpen usage chart,
// Inside the Pen), and it is the one picture workload.json could always draw and
// never did: the app had a fourteen-day strip for ONE pitcher and a list of
// names for a staff, but nothing that put a staff's strips side by side.
//
// SORTED ON STATUS, THEN LOAD (api/workload.js's compareArms). Ranking on
// pitches alone buries the row a reader opened the board for — an arm can throw
// the fewest pitches on his own staff and still be the only man unavailable,
// because three straight short outings trip the hard flag while no single count
// trips anything.
//
// Spoiler-free, inherited from api/workload.js: completed appearances only, and
// the as-of date excludes today, so no in-progress line can leak. No SealBox.
//
// `rows` is staffGridFor's output. Null or empty renders nothing — a club with
// no arms on file is a gap in the file, not an empty bullpen.
export function StaffGrid({ rows, showDots = true, showKey = true }) {
  const counts = useMemo(
    () => bullpenStatusCounts((rows ?? []).map((r) => r.status)),
    [rows],
  )
  if (!rows || rows.length === 0) return null
  const days = rows[0].cells
  const cols = `repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className="staffgrid">
      {showDots && (
        <div className="staffgrid__summary">
          <PenDots counts={counts} />
          <span className="staffgrid__tally">
            {counts.fresh} available
            {counts.limited > 0 && ` · ${counts.limited} limited`}
            {counts.down > 0 && ` · ${counts.down} down`}
          </span>
        </div>
      )}

      <div className="staffgrid__head">
        <span className="staffgrid__hlabel">Arm</span>
        <span className="staffgrid__days" style={{ gridTemplateColumns: cols }}>
          {days.map((d) => (
            <span
              key={d.date}
              className={`staffgrid__dayname${d.today ? ' staffgrid__dayname--today' : ''}`}
            >
              {weekdayInitial(d.date)}
            </span>
          ))}
        </span>
        <span className="staffgrid__hlabel staffgrid__hlabel--end">7d</span>
      </div>

      <ul className="staffgrid__rows">
        {rows.map((r) => (
          <li className={`staffgrid__row staffgrid__row--${r.status}`} key={r.personId}>
            <span className="staffgrid__arm">
              <span
                className={`pendots__dot pendots__dot--${r.status}`}
                aria-hidden="true"
              />
              {/* The row prints a surname; `name`/`ariaLabel` carry the whole
                  one, so the hover card and a screen reader both get it. */}
              <PlayerLink
                id={r.personId}
                className="staffgrid__name"
                name={r.name}
                ariaLabel={r.name}
              >
                {surname(r.name)}
              </PlayerLink>
            </span>
            <DayStrip
              cells={r.cells}
              runs={r.runs}
              size="sm"
              label={`${r.name}: ${statusWord(r.status)}`}
            />
            <span className="staffgrid__total">{r.last7dayPitches}</span>
          </li>
        ))}
      </ul>

      {showKey && (
        <div className="staffgrid__key">
          <DayStripKey />
        </div>
      )}
    </div>
  )
}

// SURNAMES, not full names. Seven day columns and a total leave a phone about
// eighty pixels for a name, and "Andrew Kittredge" truncated to "ANDREW KITT…"
// loses the half a scorer actually scans. Everything after the given name is
// kept, so a two-word surname survives ("Jose De Leon" -> "De Leon"), and the
// full name rides the link's aria-label.
function surname(name) {
  const parts = String(name ?? '').trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0]
}

const STATUS_WORD = { fresh: 'available', limited: 'limited', down: 'likely down' }
function statusWord(s) {
  return STATUS_WORD[s] ?? s
}

// 'YYYY-MM-DD' -> the day's initial. Parsed as UTC, matching the whole-day
// indexing api/workload.js does, so a column never slides a day on a device
// west of Greenwich.
const INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
function weekdayInitial(ymd) {
  const t = Date.parse(`${ymd}T00:00:00Z`)
  return Number.isFinite(t) ? INITIALS[new Date(t).getUTCDay()] : ''
}
