import { careerSeasons, recordWith } from '../../api/history/umpireHistory.js'
import { loadUmpire } from '../../api/umpires.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { umpireCareer } from '../../lib/umpire/career.js'
import { teamClubName } from '../../lib/teams.js'

// The career chart (plate games by season) and the favorite club's record with
// this umpire behind the plate. Career figures: the same on every season view.
// Open surface, no SealBox (ADR-0034).
export function UmpireCareer({ id, name }) {
  const { favoriteTeamId } = useFavoriteTeam()
  const { data } = useAsync(async () => {
    const [history, record, all] = await Promise.all([
      careerSeasons(id),
      recordWith(id, favoriteTeamId),
      loadUmpire(id, { seasonYear: 'all' }),
    ])
    return umpireCareer({
      history,
      record,
      rows: all?.games ?? [],
      teamId: favoriteTeamId,
      name,
      clubName: teamClubName(favoriteTeamId) ?? 'The club',
    })
  }, [id, name, favoriteTeamId])
  if (!data?.seasons.length) return null
  const { seasons, record, caption } = data
  const first = seasons[0].season
  const last = seasons.at(-1).season
  return (
    <section className="umcareer" aria-label="Career">
      <div
        className="umcareer__bars"
        role="img"
        aria-label={`Games behind the plate by season, ${first} to ${last}`}
      >
        {seasons.map((s) => (
          <span
            key={s.season}
            className="umcareer__bar"
            title={`${s.season}: ${s.plate}`}
            style={{ height: `${Math.max(s.share * 100, s.plate ? 4 : 0)}%` }}
          />
        ))}
      </div>
      <div className="umcareer__axis">
        <span>{first}</span>
        <span>{last}</span>
      </div>
      {record && (
        <>
          <div
            className="umcareer__split"
            role="img"
            aria-label={`${record.wins} wins, ${record.losses} losses`}
          >
            <span className="umcareer__wins" style={{ width: `${record.winShare * 100}%` }} />
          </div>
          <p className="hint umcareer__caption">
            {caption}: {record.wins}-{record.losses}
          </p>
        </>
      )}
    </section>
  )
}
