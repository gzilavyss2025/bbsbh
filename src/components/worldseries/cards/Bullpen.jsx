import { ROUND_TAG } from '../../../lib/scout/format.js'
import { bullpenGrid } from '../../../lib/postseason/worldseries/bullpen.js'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { Grid } from '../../ui/layout/Grid.jsx'
import { Table } from '../../ui/table/Table.jsx'

// BULLPEN: per club, every pitcher who relieved in the postseason, one column
// per postseason game this year (numbered from 1, grouped under its round), an
// ink cell with the pitch count when he pitched, and a Tot column. The table
// scrolls sideways on a phone, name column fixed. Box scores of games dated
// before the slate date only (bullpenGrid re-applies the cutoff).

// Consecutive games of one round: [{ label, span }].
function rounds(games) {
  const out = []
  for (const g of games) {
    const label = ROUND_TAG[g.gameType] ?? ''
    if (out.at(-1)?.label === label) out.at(-1).span += 1
    else out.push({ label, span: 1 })
  }
  return out
}

function Club({ clubId, grid }) {
  if (grid.rows.length === 0) return null
  const club = teamClubNameShort(clubId)
  return (
    <section className="ww-bull" aria-label={`${club} bullpen`}>
      <div className="ww-bull__club">
        <TeamLogo teamId={clubId} name={club} size={24} />
        {club}
      </div>
      <Table frame="bare" density="keep" sticky className="ww-bulltable" label={`${club} bullpen pitches by game`}>
        <thead>
          <tr>
            <td />
            {rounds(grid.games).map((r, i) => (
              <th key={i} scope="colgroup" colSpan={r.span} className="ww-bulltable__round">
                {r.label}
              </th>
            ))}
            <td />
          </tr>
          <tr>
            <th scope="col">Pitcher</th>
            {grid.games.map((g, i) => (
              <th key={g.gamePk} scope="col">
                {i + 1}
              </th>
            ))}
            <th scope="col">Tot</th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="ww-bulltable__name">
                {r.name}
              </th>
              {r.cells.map((n, i) => (
                <td key={i} className={n ? 'ww-bulltable__on' : 'ww-bulltable__off'}>
                  {n ?? ''}
                </td>
              ))}
              <td>{r.total}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  )
}

export function Bullpen({ clubIds, boxscoresByClub, slateDate }) {
  const grids = clubIds.map((id) => bullpenGrid(boxscoresByClub?.[id], id, { slateDate }))
  if (grids.every((g) => g.rows.length === 0)) return null
  return (
    <Card frame="stamped" label="Bullpen" count="Pitches per Oct game" className="ww-bullpen">
      <Grid min={300} gap="base">
        {clubIds.map((id, i) => (
          <Club key={id} clubId={id} grid={grids[i]} />
        ))}
      </Grid>
    </Card>
  )
}
