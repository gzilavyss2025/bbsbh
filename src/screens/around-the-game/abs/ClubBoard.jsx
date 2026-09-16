import { useMemo, useState } from 'react'
import { teamBoard, TEAM_SORTS } from '../../../api/around-the-game/absChallenges.js'
import { clubShort } from '../../../api/around-the-game/clubs.js'
import { useFavoriteTeam } from '../../../hooks/preferences/useFavoriteTeam.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { BarCell } from '../../../components/around-the-game/BroadcastBar.jsx'
import { ClubCell } from '../../../components/around-the-game/ClubCell.jsx'
import { commas, num2, pct1 } from './format.js'

// THE CLUBS — every club that has called for one, sorted by the chip you pick.
//
// The sort lives here rather than on the page because nothing else on the page
// reads it: the chips, the ranking they produce and the column the bar is drawn
// in are one mechanism, and splitting them across two files would let the bar
// point at a column the board is no longer sorted by.

// The club board's numeric columns, held as data so the header row and the
// body cannot fall out of step.
const TEAM_COLUMNS = [
  { key: 'n', label: 'Called', render: (r) => commas(r.n) },
  { key: 'perGame', label: 'Per game', render: (r) => num2(r.perGame) },
  { key: 'success', label: 'Won', render: (r) => commas(r.success) },
  { key: 'rate', label: 'Success', render: (r) => pct1(r.rate) },
  { key: 'ranOut', label: 'Ran out', render: (r) => commas(r.ranOut) },
]

export function ClubBoard({ summary, clubs }) {
  const [teamSort, setTeamSort] = useState('rate')
  const { favoriteTeamId } = useFavoriteTeam()

  const teams = useMemo(() => (summary ? teamBoard(summary, teamSort) : []), [summary, teamSort])

  const teamSortKey = TEAM_SORTS.find((s) => s.key === teamSort)?.key ?? 'rate'
  const teamValues = teams.map((r) => r[teamSortKey]).filter((v) => v != null)
  const teamMin = teamValues.length ? Math.min(...teamValues) * 0.9 : 0
  const teamMax = teamValues.length ? Math.max(...teamValues) : 1

  return (
    <BroadcastSection title="The clubs">
      <div className="rpt-controls" role="group" aria-label="Sort the club board">
        {TEAM_SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`rpt-chip${s.key === teamSort ? ' is-on' : ''}`}
            aria-pressed={s.key === teamSort}
            onClick={() => setTeamSort(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <BoardScroller label="Challenge board, every club">
        <table className="standings rpt">
          <thead>
            <tr>
              <th className="team">Club</th>
              {TEAM_COLUMNS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((r) => (
              <tr
                key={r.teamId}
                className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
              >
                <ClubCell
                  teamId={r.teamId}
                  name={clubShort(clubs, r.teamId)}
                  rank={r.rank}
                  tied={r.tied}
                  sub={`${commas(r.games)} games`}
                />
                {TEAM_COLUMNS.map((c) =>
                  c.key === teamSortKey ? (
                    <td key={c.key}>
                      <BarCell value={r[c.key]} min={teamMin} max={teamMax}>
                        {c.render(r)}
                      </BarCell>
                    </td>
                  ) : (
                    <td key={c.key}>{c.render(r)}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </BoardScroller>
    </BroadcastSection>
  )
}
