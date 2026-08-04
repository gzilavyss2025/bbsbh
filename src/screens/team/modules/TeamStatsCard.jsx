const DASH = '—'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// Sunday-first, matching the calendar week Date.getUTCDay() indexes (0=Sun).
export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Record by day of week, off the same cutoff-gated `schedule` rows the
// Schedule section below already renders (fetchTeamSchedule only sets `won`
// once a game is Final AND on/before the asOf cutoff — see api/schedule.js —
// so this reads no further ahead than the rest of the page). Days with no
// decided games yet show DASH rather than "0-0".
export function dayOfWeekRecord(games) {
  const tally = DOW_LABELS.map(() => ({ wins: 0, losses: 0 }))
  for (const g of games) {
    if (g.won == null) continue
    const dow = new Date(`${g.apiDate}T00:00:00Z`).getUTCDay()
    if (g.won) tally[dow].wins++
    else tally[dow].losses++
  }
  return DOW_LABELS.map((label, i) => {
    const { wins, losses } = tally[i]
    const total = wins + losses
    return {
      k: label,
      v: total ? `${wins}-${losses}` : DASH,
      rank: total ? (wins / total).toFixed(3).replace(/^0/, '') : DASH,
    }
  })
}
// Same UTC-parse convention as dayOfWeekRecord's own apiDate → weekday
// mapping (and isoToday() itself), so "today" lines up with whichever row
// that same calendar date would have tallied into.
export function todayDowLabel() {
  return DOW_LABELS[new Date(`${isoToday()}T00:00:00Z`).getUTCDay()]
}

export function TeamStats({ title, stats, note = 'rank out of 30', highlightKey }) {
  return (
    <div className="tstats-card">
      <div className="tstats-card__head">
        <span>{title}</span>
        {note && <em>{note}</em>}
      </div>
      <div className="tstats-card__body">
        <div className="tstats">
          {stats.map((s) => (
            <div
              key={s.k}
              className={`tstatrow${s.extreme ? ` tstatrow--${s.extreme}` : ''}${s.k === highlightKey ? ' tstatrow--today' : ''}`}
            >
              <span className="tstatrow__k">{s.k}</span>
              <span className="tstatrow__v">{s.v}</span>
              <span className={`tstatrow__r${s.tone ? ` tstatrow__r--${s.tone}` : ''}`}>{s.rank}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
