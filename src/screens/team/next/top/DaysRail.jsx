// The days calendar under the form line (the On the mound card's day rail): six days back, today,
// the day after. A chip is a result (W, L), an off day (dashed), or the next game (the club it is
// against). The Today box slides in from the left; the next-game chip stamps. `rail` is daysRail().
export function DaysRail({ rail }) {
  const { days, todayIdx, month, post } = rail
  const label = days.map((d, i) => `${d.d}: ${d.chips.map((c) => ({ w: 'won', l: 'lost', off: 'no game', next: `next game ${c.t}` })[c.k]).join(', ')}${i === todayIdx ? ' (today)' : ''}`).join('. ')
  return (
    <div className="tnext__panel tnext__daysbox">
      <p className="tnext__label"><span>{post ? 'Postseason days' : 'Recent days'}</span><span>{month}</span></p>
      <div className="tnext__days" role="img" aria-label={label}>
        {days.map((d) => (
          <div key={d.date} className="tnext__day">
            <p className="tnext__dayd">{d.d}</p>
            {d.chips.map((c, i) => (
              <p key={i} className={`tnext__chip tnext__chip--${c.k}`}>{c.t}</p>
            ))}
          </div>
        ))}
        <div className="tnext__today" style={{ '--today-col': todayIdx }}><span>Today</span></div>
      </div>
    </div>
  )
}
