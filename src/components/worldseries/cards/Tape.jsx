import { octRecord } from '../../../lib/postseason/worldseries/homeRoad.js'
import { franchiseHistory } from '../../../lib/postseason/worldseries/franchiseHistory.js'
import { tapeRows } from '../../../lib/postseason/worldseries/tape.js'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Card } from '../../ui/frame/Card.jsx'

// TALE OF THE TAPE: the away club on the left, the home club on the right, the
// label between. Wins and run differential are mirrored bars. Every figure is
// through the day before the slate date (the regular-season table is final; the
// October record, the meetings and the Series history are cut at the slate
// date by their selectors).
function Bar({ value, peak, side }) {
  const pct = peak ? (Math.abs(value) / peak) * 100 : 0
  return <span className={`ww-tape__bar ww-tape__bar--${side}${value < 0 ? ' ww-tape__bar--neg' : ''}`} style={{ width: `${pct}%` }} />
}

// `labelAs`: the tab's heading level, 'h3' on the series pages (under their h2 group bands).
// A run differential reads signed, "+214" (Gary, 2026-10-28); the bar keeps the number.
const shown = (r, v) => (v == null ? '' : r.key === 'runDiff' && v > 0 ? `+${v}` : v)

export function Tape({ awayId, homeId, data, slateDate, labelAs = 'h2' }) {
  const side = (id) => {
    const { wins: octW, losses: octL } = octRecord(data.clubGames?.[id], id, slateDate)
    const runDiff = Number(data.standings?.[id]?.runDiff)
    return {
      wins: data.standings?.[id]?.wins ?? null,
      runDiff: Number.isFinite(runDiff) ? runDiff : null,
      octW,
      octL,
      ...franchiseHistory(data.seriesHistory, id, { before: slateDate }),
    }
  }
  const meetingWins = {
    away: data.meetings.filter((g) => g.winnerId === awayId).length,
    home: data.meetings.filter((g) => g.winnerId === homeId).length,
  }
  const rows = tapeRows({ away: side(awayId), home: side(homeId), meetingDates: data.meetings.map((g) => g.date), meetingWins })
  return (
    <Card frame="stamped" label="Tale of the tape" labelAs={labelAs} className="ww-tape">
      <div className="ww-tape__heads">
        <span className="ww-tape__club">
          <TeamLogo teamId={awayId} name={teamClubNameShort(awayId)} size={28} />
          {teamClubNameShort(awayId)}
        </span>
        <span className="ww-tape__club ww-tape__club--home">
          {teamClubNameShort(homeId)}
          <TeamLogo teamId={homeId} name={teamClubNameShort(homeId)} size={28} />
        </span>
      </div>
      <ul className="ww-tape__rows">
        {rows.map((r) => {
          const peak = r.bar ? Math.max(Math.abs(r.away ?? 0), Math.abs(r.home ?? 0)) : 0
          return (
            <li key={r.key} className="ww-tape__row">
              <span className="ww-tape__val">{shown(r, r.away)}</span>
              <span className="ww-tape__label">{r.label}</span>
              <span className="ww-tape__val ww-tape__val--home">{shown(r, r.home)}</span>
              {r.bar && (
                <span className="ww-tape__bars" aria-hidden="true">
                  <Bar value={r.away ?? 0} peak={peak} side="away" />
                  <Bar value={r.home ?? 0} peak={peak} side="home" />
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
