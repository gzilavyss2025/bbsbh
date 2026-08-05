import { useState } from 'react'
import { favoriteAccentColor } from '../../../lib/teams.js'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { PostseasonOddsModal } from '../../../components/teamstats/PostseasonOddsModal.jsx'

// The three rows a preview shows: the club's own, plus the team above and the
// team below it. A club at the top or bottom of its division still gets three
// (the window slides rather than shrinking), and a division the club somehow
// isn't listed in falls back to the top three rather than rendering nothing.
function previewRows(standings) {
  const me = standings.findIndex((s) => s.isMe)
  if (me < 0) return standings.slice(0, 3)
  const start = Math.min(Math.max(me - 1, 0), Math.max(standings.length - 3, 0))
  return standings.slice(start, start + 3)
}

// `preview` (the Overview's Standing door) cuts the table to the club's own row
// plus its two neighbours; the Postseason Odds modal still lists the whole
// division, since that pill is the Overview's, not the Numbers tab's (see the
// PRD's module table). Everything else — chrome, columns, tones — is identical
// in both modes: this is one module in two sizes, not two modules.
export function StandingsCard({ team, standings, asOf, divisionPostseasonOdds, preview = false }) {
  // Postseason Odds modal — a plain boolean rather than the team-keyed
  // pattern used elsewhere on this page is fine here: it's a transient
  // dialog, not persisted per-team UI state, so it's safe (and correct) for
  // it to close on any client-side team nav same as every other modal in the
  // app.
  const [showPostseasonOdds, setShowPostseasonOdds] = useState(false)
  const rows = preview ? previewRows(standings) : standings

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
              {rows.map((s) => (
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
