import { fetchPositionTags } from '../../../../api/person-fetch.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { seasonRuns } from '../../../../components/team/ladder/layout.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { SheetFrame } from './SheetFrame.jsx'

// Every player who played for both clubs (#2579), most recent first: name, position and the seasons
// with each club, the away club's column first. The positions load when the sheet opens; a failed
// call shows no tags. The Retrosheet and Chadwick credit lines sit at the foot (ADR-0100).
export function PlayedForBothSheet({ pfb, away, home, onClose }) {
  const ids = pfb.rows.map((r) => r.id)
  const { data: tags } = useAsync(() => fetchPositionTags(ids), [ids.join(',')])
  const n = pfb.rows.length
  return (
    <SheetFrame title="Played for both" onClose={onClose}>
      <p className="lpfb__summary">
        {n} {n === 1 ? 'player' : 'players'} who played in the majors for the {away.teamName} and the {home.teamName}, most recent first.
        {pfb.throughSeason && ` Through ${pfb.throughSeason}.`}
      </p>
      <table className="lpfb__table">
        <thead>
          <tr>
            <th scope="col">Player</th>
            {[away, home].map((club) => (
              <th key={club.id} scope="col">
                <span className="lpfb__club">
                  <TeamLogo teamId={club.id} name={club.teamName} size={20} />
                  {club.teamName}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pfb.rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">
                <PlayerLink id={r.id} name={r.name}>{r.name}</PlayerLink>
                {tags?.[r.id] && <span className="lpfb__pos">{tags[r.id]}</span>}
              </th>
              <td>{seasonRuns(r.seasons[away.id])}</td>
              <td>{seasonRuns(r.seasons[home.id])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pfb.credit.length > 0 && (
        <footer className="lpfb__credit">
          {pfb.credit.map((line) => <p key={line}>{line}</p>)}
        </footer>
      )}
    </SheetFrame>
  )
}
