// The Series schedule as a calendar strip: one cell per game and one per off
// day, each with its weekday and date. Today is marked, the next game is
// inked, an if-needed game has a dashed edge, and an off day is a plain cell
// with no word on it. `days` is calendarDays' list (lib/postseason/worldseries/
// hero.js); nothing here reads a result, except on a decided Series, whose game
// cells (decidedHero) carry `winnerId`: the winning club's logo fills the flag. Today/Next are visible as well as
// spoken; conditional games keep their dashed edge and the hero's small key.
import { teamClubNameShort } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

function spoken(d) {
  const when = [d.weekday, d.day].filter(Boolean).join(' ')
  const what = d.gameNumber != null ? `Game ${d.gameNumber}` : 'No game'
  const won = d.winnerId && `won by ${teamClubNameShort(d.winnerId) ?? 'unknown'}`
  const flags = [d.today && 'today', d.next && 'next game', d.maybe && 'if needed', won].filter(Boolean)
  return [what, when, ...flags].filter(Boolean).join(', ')
}

export function ScheduleStrip({ days }) {
  return (
    <ol className="ww-cal" aria-label="Series schedule">
      {days.map((d, i) => {
        const cls = [
          'ww-cal__day',
          `ww-cal__day--${d.kind}`,
          d.today && 'ww-cal__day--today',
          d.next && 'ww-cal__day--next',
          d.maybe && 'ww-cal__day--maybe',
        ]
        return (
          <li key={d.key} className={cls.filter(Boolean).join(' ')} style={{ '--i': i }} aria-current={d.today ? 'date' : undefined}>
            <span className="sr-only">{spoken(d)}</span>
            <span className="ww-cal__wk" aria-hidden="true">
              {d.weekday}
            </span>
            <span className="ww-cal__date" aria-hidden="true">
              {d.day ?? '—'}
            </span>
            <span className="ww-cal__game" aria-hidden="true">
              {d.gameNumber != null ? `G${d.gameNumber}` : ''}
            </span>
            <span className="ww-cal__flag" aria-hidden="true">
              {d.winnerId ? <TeamLogo teamId={d.winnerId} name="" size={20} className="ww-cal__winner" /> : d.today ? 'Today' : d.next ? 'Next' : ''}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
