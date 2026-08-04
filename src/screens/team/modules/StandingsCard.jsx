import { useState } from 'react'
import { favoriteAccentColor } from '../../../lib/teams.js'
import { TeamLink } from '../../../components/TeamLink.jsx'
import { TeamLogo } from '../../../components/TeamLogo.jsx'
import { PostseasonOddsModal } from '../../../components/PostseasonOddsModal.jsx'

export function StandingsCard({ team, standings, asOf, divisionPostseasonOdds }) {
  // Postseason Odds modal — a plain boolean rather than the team-keyed
  // pattern used elsewhere on this page is fine here: it's a transient
  // dialog, not persisted per-team UI state, so it's safe (and correct) for
  // it to close on any client-side team nav same as every other modal in the
  // app.
  const [showPostseasonOdds, setShowPostseasonOdds] = useState(false)

  return (
    <>
      <div className="thub-card">
        <div className="thub-card__head">
          <span>{team.division?.name || 'Standings'}</span>
          {asOf && <em>entering today</em>}
          {divisionPostseasonOdds.length > 0 && (
            <button
              type="button"
              className="psodds-pill"
              onClick={() => setShowPostseasonOdds(true)}
            >
              Postseason Odds
            </button>
          )}
        </div>
        <div className="thub-card__body">
        <div className="ledger-wrap">
          <table className="standings">
            <thead>
              <tr>
                <th className="team">Team</th>
                <th>W</th><th>L</th><th>GB</th><th>Streak</th><th>L10</th>
                <th className="standings__wide">Home</th>
                <th className="standings__wide">Away</th>
                <th>RD</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s) => (
                <tr
                  key={s.id}
                  className={s.isMe ? 'is-me' : ''}
                  style={s.isMe ? { '--fav-accent': favoriteAccentColor(s.id) } : undefined}
                >
                  <td className="team">
                    <TeamLink id={s.isMe ? null : s.id}>
                      <TeamLogo teamId={s.id} name={s.name} size={18} />{s.name}
                    </TeamLink>
                  </td>
                  <td>{s.wins}</td><td>{s.losses}</td><td>{s.gb}</td>
                  <td>{s.streak}</td><td>{s.l10}</td>
                  <td className="standings__wide">{s.home}</td>
                  <td className="standings__wide">{s.away}</td>
                  <td className={s.diffTone}>{s.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {showPostseasonOdds && (
        <PostseasonOddsModal
          divisionName={team.division?.name || 'Standings'}
          rows={divisionPostseasonOdds}
          onClose={() => setShowPostseasonOdds(false)}
        />
      )}
    </>
  )
}
