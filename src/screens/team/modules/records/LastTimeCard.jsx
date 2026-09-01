import { SLOT_BY_ID, droughtsFor } from '../../../../api/scheduleShape.js'
import { teamClubName, teamLocationName } from '../../../../lib/teams.js'
import '../../../../styles/65-team-records.css'

// The Numbers tab's "Last Time" card: the recurring slots in this club's
// schedule it has stopped winning — game 1 of a road trip, game 1 of a
// homestand, the getaway day, a series opener in one particular city — each
// with the date it last won one and how many chances have gone by since.
//
// The Records card above answers a RATE over this season ("7-5 in series
// openers"). This one answers a DATE across a decade, which is a different
// question and the one people actually repeat to each other: "the last time
// the Brewers won game 1 of a road trip was July 3rd." src/api/scheduleShape.js
// derives it; docs/schedule-shape.md is the catalog.
//
// It prints nothing most days, and that is the design. Every row has passed
// the noteworthiness gate in scheduleShape.js — long enough a run, and its
// chances close enough together to be about this club rather than about how
// rarely the schedule visits that city. Without the gate the card would fill
// with "hasn't won a series opener in Cleveland since 2016", which is nine
// chances in eleven years and no kind of drought.
//
// Spoiler: the same footing as the Records card beside it. The shard holds
// only Final games from a cron that runs before the day's games, `cutoff` is
// the same day-before cutoff every dated card on this tab honours, and it is
// applied before anything is counted (ADR-0034 — the hub is an open surface).

// "Jul 3" — parsed off the ISO string rather than through Date, which would
// shift the day by one in any timezone behind UTC. Same reason and same shape
// as teamRecords.js's shortDate, which this deliberately mirrors.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function when(iso) {
  const [y, m, d] = iso.split('-')
  const now = String(new Date().getFullYear())
  // The year is dropped inside the current season and kept outside it. "Jul 3"
  // reads as this year to anyone holding a scorecard; "May 18, 2019" has to say
  // so, because the whole force of the line is how long ago it was.
  return y === now ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`
}

// What the club was trying to win. A rival-scoped row has to say WHERE or it
// is not the fact anybody repeats — "game 1 of a road series" means nothing
// until it becomes "game 1 of a series in Chicago".
//
// The road row takes the PLACE name and the home row the club name, because
// each preposition wants a different noun: "in Baltimore" is where the games
// were played, and "against the Orioles" is who was in the other dugout. Run
// the other way round they both read as machine output — "at Orioles" is not
// a thing anyone says.
function label(row) {
  const slot = SLOT_BY_ID.get(row.slotId)
  if (!slot) return null
  // `slot.label` rather than `slot.short`: this row is a KEY in a three-cell
  // grid beside a date and a count, not a sentence. "Homestand finale" fits
  // the column the Records card above set; "The last game of a homestand"
  // wraps to three lines at phone width.
  if (row.scope !== 'rival') return slot.label
  if (row.slotId === 'series-opener-away') {
    const place = teamLocationName(row.opponentId)
    return place ? `Series opener in ${place}` : null
  }
  const club = teamClubName(row.opponentId)
  return club ? `Series opener vs. ${club}` : null
}

export function LastTimeCard({ data, cutoff }) {
  const rows = droughtsFor(data, { cutoff })
    .map((r) => ({ ...r, k: label(r) }))
    .filter((r) => r.k)
  if (!rows.length) return null

  return (
    <div className="tstats-card trec trec--lasttime">
      <div className="tstats-card__head">
        <span>Last Time</span>
        <em>chances since</em>
      </div>
      <div className="tstats-card__body">
        <div className="tstats">
          {rows.map((r) => (
            <div key={`${r.slotId}-${r.opponentId ?? 'all'}`} className="tstatrow">
              <span className="tstatrow__k">{r.k}</span>
              {/* The date is the fact; the count is what makes it a drought
                  rather than a coincidence. Printing one without the other is
                  the "never show a number without the number it should be"
                  rule in docs/callouts.md — nine straight is only remarkable
                  once you know how often the slot comes around, and the count
                  is what carries that. */}
              <span className="tstatrow__v">{r.lastWin ? when(r.lastWin.date) : 'never'}</span>
              <span className="tstatrow__r">{r.sinceWin}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
