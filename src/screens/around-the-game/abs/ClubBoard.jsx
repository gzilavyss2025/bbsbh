import { Fragment, useMemo, useState } from 'react'
import { teamBoard, TEAM_SORTS } from '../../../api/around-the-game/absChallenges.js'
import { clubShort } from '../../../api/around-the-game/clubs.js'
import { useFavoriteTeam } from '../../../hooks/preferences/useFavoriteTeam.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { Table } from '../../../components/ui/table/Table.jsx'
import { BarCell } from '../../../components/around-the-game/BroadcastBar.jsx'
import { ClubCell } from '../../../components/around-the-game/ClubCell.jsx'
import { commas, num2, pct1 } from './format.js'
import { boardCompare } from '../../../lib/seasons/view.js'

// THE CLUBS — every club that has called for one, sorted by the chip you pick.
//
// The sort lives here rather than on the page because nothing else on the page
// reads it: the chips, the ranking they produce and the column the bar is drawn
// in are one mechanism, and splitting them across two files would let the bar
// point at a column the board is no longer sorted by.

// The club board's numeric columns, held as data so the header row and the
// body cannot fall out of step.
// `format` is the column's unit for a season compare (lib/seasons/view.js).
const TEAM_COLUMNS = [
  { key: 'n', label: 'Called', format: 'count', render: (r) => commas(r.n) },
  { key: 'perGame', label: 'Per game', format: 'dec2', render: (r) => num2(r.perGame) },
  { key: 'success', label: 'Won', format: 'count', render: (r) => commas(r.success) },
  { key: 'rate', label: 'Success', format: 'pct', render: (r) => pct1(r.rate) },
  { key: 'ranOut', label: 'Ran out', format: 'count', render: (r) => commas(r.ranOut) },
]

// A SEASON COMPARE (#1202): `prev` is the same level's summary in the `vs`
// season, and one more column, beside the column the board is sorted by (the
// one the bar is drawn in), compares that column: the chip picks it. A club
// with no row that season gets the dash.
export function ClubBoard({ summary, clubs, prev = null, vs = null, mode = 'change' }) {
  const [teamSort, setTeamSort] = useState('rate')
  const { favoriteTeamId } = useFavoriteTeam()

  const teams = useMemo(() => (summary ? teamBoard(summary, teamSort) : []), [summary, teamSort])

  const teamSortKey = TEAM_SORTS.find((s) => s.key === teamSort)?.key ?? 'rate'
  const teamValues = teams.map((r) => r[teamSortKey]).filter((v) => v != null)
  const teamMin = teamValues.length ? Math.min(...teamValues) * 0.9 : 0
  const teamMax = teamValues.length ? Math.max(...teamValues) : 1
  const prevByTeam = new Map((prev?.byTeam ?? []).map((r) => [r.teamId, r]))
  const sorted = TEAM_COLUMNS.find((c) => c.key === teamSortKey)
  const compare = prev
    ? boardCompare({
        vs,
        mode,
        format: sorted?.format ?? 'count',
        value: (r) => r[teamSortKey],
        prevOf: (r) => prevByTeam.get(r.teamId),
      })
    : null

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

      <Table sticky label="Challenge board, every club" className="rpt">
        <thead>
          <tr>
            <th className="team">Club</th>
            {TEAM_COLUMNS.map((c) => (
              <Fragment key={c.key}>
                <th>{c.label}</th>
                {c.key === teamSortKey && compare && <th>{compare.head}</th>}
              </Fragment>
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
                note={`${commas(r.games)} games`}
              />
              {TEAM_COLUMNS.map((c) =>
                c.key === teamSortKey ? (
                  <Fragment key={c.key}>
                    <td>
                      <BarCell value={r[c.key]} min={teamMin} max={teamMax}>
                        {c.render(r)}
                      </BarCell>
                    </td>
                    {compare && <td>{compare.cell(r)}</td>}
                  </Fragment>
                ) : (
                  <td key={c.key}>{c.render(r)}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </BroadcastSection>
  )
}
