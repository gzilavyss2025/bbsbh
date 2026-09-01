import { SLOT_BY_ID, EVENT_BY_ID, droughtsFor } from '../../../../api/scheduleShape.js'
import { ALL_MLB_TEAM_IDS, teamClubName, teamLocationName } from '../../../../lib/teams.js'
import '../../../../styles/65-team-records.css'

// The Numbers tab's "Last Time" card: what this club has stopped doing, and
// when it last did it. Two kinds of row, ranked together.
//
// A SLOT row is a recurring position in the schedule it keeps losing — game 1
// of a road trip, game 1 of a homestand, a series opener in one particular
// city. An EVENT row is something it either does in a game or does not — throw
// a shutout, score ten, hold a lead it carried into the ninth. Both print the
// date it last happened and how many chances have gone by since.
//
// The Records card above answers a RATE over this season ("7-5 in series
// openers"). This one answers a DATE across a decade, which is a different
// question and the one people actually repeat to each other: "the last time
// the Brewers won game 1 of a road trip was July 3rd." src/api/scheduleShape.js
// derives it; docs/schedule-shape.md is the catalog.
//
// It prints nothing most days, and that is the design. Every row has passed a
// gate in scheduleShape.js, and the two things those gates throw out are worth
// naming here because both look like good rows until you check:
//
//   - A run whose chances were too rare. "Hasn't won a series opener in
//     Cleveland since 2016" is nine chances in eleven years, and "hasn't lost
//     in extra innings in 149 games" is six extra-inning games.
//   - A run that is this club's normal. Colorado has thrown five shutouts in
//     three seasons, so 109 games without one is not news about Colorado.
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

// The cities that host two clubs, plus any club whose "location" is really just
// its own name. Both are cases where a place name cannot stand on its own.
//
// "Series opener in Chicago" does not say whether the games were at Wrigley or
// on the South Side, and the Athletics — MLB-branded with no city at all while
// the club relocates — came out as "in Athletics". Computed from the name table
// rather than listed by hand, so a club moving into or out of a shared market,
// or getting its city back, needs no edit here.
const AMBIGUOUS_PLACE = (() => {
  const counts = new Map()
  for (const id of ALL_MLB_TEAM_IDS) {
    const place = teamLocationName(id)
    if (place) counts.set(place, (counts.get(place) ?? 0) + 1)
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([place]) => place))
})()

// Where a road series was played, in the form a person would say it: the place
// name when it names one park — "in Baltimore", "in Toronto" — and the club
// when it does not.
function roadPlace(opponentId) {
  const place = teamLocationName(opponentId)
  const club = teamClubName(opponentId)
  if (!place || !club) return null
  if (place === club || AMBIGUOUS_PLACE.has(place)) return `at the ${club}`
  return `in ${place}`
}

// What the club was trying to win. A rival-scoped row has to say WHERE or it
// is not the fact anybody repeats — "game 1 of a road series" means nothing
// until it becomes "game 1 of a series in Chicago".
//
// The road row leads with the PLACE and the home row with the club, because
// each preposition wants a different noun: "in Baltimore" is where the games
// were played, and "vs. the Orioles" is who was in the other dugout. Run
// the other way round they both read as machine output — "at Orioles" is not
// a thing anyone says.
function label(row) {
  if (row.scope === 'event') return EVENT_BY_ID.get(row.eventId)?.label ?? null
  const slot = SLOT_BY_ID.get(row.slotId)
  if (!slot) return null
  // `slot.label` rather than `slot.short`: this row is a KEY in a three-cell
  // grid beside a date and a count, not a sentence. "Homestand finale" fits
  // the column the Records card above set; "The last game of a homestand"
  // wraps to three lines at phone width.
  if (row.scope !== 'rival') return slot.label
  if (row.slotId === 'series-opener-away') {
    const place = roadPlace(row.opponentId)
    return place ? `Series opener ${place}` : null
  }
  const club = teamClubName(row.opponentId)
  return club ? `Series opener vs. the ${club}` : null
}

// The two row shapes name their date and their count differently — a slot
// counts chances at that slot, an event counts tries at that event — so they are
// flattened to one pair here rather than branching in the markup.
function normalise(row) {
  return {
    ...row,
    k: label(row),
    date: row.scope === 'event' ? row.last : row.lastWin?.date ?? null,
    since: row.scope === 'event' ? row.sinceLast : row.sinceWin,
  }
}

export function LastTimeCard({ data, cutoff }) {
  const rows = droughtsFor(data, { cutoff }).map(normalise).filter((r) => r.k && r.date)
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
            <div key={`${r.slotId ?? r.eventId}-${r.opponentId ?? 'all'}`} className="tstatrow">
              <span className="tstatrow__k">{r.k}</span>
              {/* The date is the fact; the count is what makes it a drought
                  rather than a coincidence. Printing one without the other is
                  the "never show a number without the number it should be"
                  rule in docs/callouts.md — nine straight is only remarkable
                  once you know how often the slot comes around, and the count
                  is what carries that. */}
              <span className="tstatrow__v">{when(r.date)}</span>
              <span className="tstatrow__r">{r.since}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
