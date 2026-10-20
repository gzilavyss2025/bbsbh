import { careerSeasons, recordWith } from '../../api/history/umpireHistory.js'
import { loadUmpireGames } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { umpireCareer } from '../../lib/umpire/career.js'
import { teamClubName } from '../../lib/teams.js'
import { Card } from '../ui/frame/Card.jsx'
import { Meter } from '../ui/frame/Meter.jsx'

// The career card: plate games by season, and the favorite club's record with
// this umpire behind the plate. Career figures: the same on every season view.
// Open surface, no SealBox (ADR-0034).
export function UmpireCareer({ id }) {
  const { favoriteTeamId } = useFavoriteTeam()
  const { data } = useAsync(async () => {
    const [history, record, rows] = await Promise.all([
      careerSeasons(id),
      recordWith(id, favoriteTeamId),
      loadUmpireGames(id),
    ])
    return umpireCareer({
      history,
      record,
      rows,
      teamId: favoriteTeamId,
      clubName: teamClubName(favoriteTeamId) ?? 'The club',
    })
  }, [id, favoriteTeamId])
  if (!data?.seasons.length) return null
  const { seasons, showChart, peakText, record, label } = data
  const first = seasons[0].season
  const last = seasons.at(-1).season
  return (
    <Card body="flush" className="umpage__card umcareer">
      <h2 className="umpage__cardtitle">Career behind the plate</h2>
      {showChart && (
        <div className="umcareer__plot" style={{ '--n': seasons.length }}>
          <div className="umcareer__bars" aria-hidden="true">
            {seasons.map((s) => (
              <span
                key={s.season}
                className={`umcareer__bar${s.partial ? ' umcareer__bar--partial' : ''}`}
                style={{ height: `${Math.max(s.share * 100, s.plate ? 4 : 0)}%` }}
              />
            ))}
          </div>
          <div className="umcareer__axis" aria-hidden="true">
            <span>{first}</span>
            <span>{last}</span>
          </div>
        </div>
      )}
      <p className="umcareer__peak">{peakText}</p>
      <ul className="sr-only">
        {seasons.map((s) => (
          <li key={s.season}>
            {s.season}: {s.plate} games behind the plate{s.partial ? ', season in progress' : ''}
          </li>
        ))}
      </ul>
      {record && (
        <div className="umcareer__record">
          <span className="umptend__tilel">{label}</span>
          <span className="umptend__tilev">
            {record.wins}–{record.losses}
          </span>
          {record.showBar && (
            <Meter
              className="umcareer__meter"
              label={`${record.wins} wins, ${record.losses} losses`}
              parts={[
                { code: 'W', share: record.wins, tone: 'good', figure: record.wins },
                { code: 'L', share: record.losses, tone: 'bad', figure: record.losses },
              ]}
            />
          )}
        </div>
      )}
    </Card>
  )
}
