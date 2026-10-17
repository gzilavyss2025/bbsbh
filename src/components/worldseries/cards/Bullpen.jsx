import { bullpenGrid } from '../../../lib/postseason/worldseries/bullpen.js'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { Grid } from '../../ui/layout/Grid.jsx'
import { Table } from '../../ui/table/Table.jsx'

// BULLPEN: per club, the top relievers by October pitches, one column per
// postseason game (the last six, numbered 1 to 6), an ink cell with the pitch
// count when he pitched, and a Tot column. Box scores of games dated before the
// slate date only (bullpenGrid re-applies the cutoff).
function Club({ clubId, boxscores, slateDate, relievers }) {
  const grid = bullpenGrid(boxscores, clubId, { slateDate, relievers })
  if (grid.rows.length === 0) return null
  const club = teamClubNameShort(clubId)
  return (
    <section className="ww-bull" aria-label={`${club} bullpen`}>
      <div className="ww-bull__club">
        <TeamLogo teamId={clubId} name={club} size={24} />
        {club}
      </div>
      <Table frame="bare" density="keep" className="ww-bulltable" label={`${club} bullpen pitches by game`}>
        <thead>
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

export function Bullpen({ clubIds, boxscoresByClub, slateDate, wide }) {
  const sides = clubIds.map((id) => (
    <Club key={id} clubId={id} boxscores={boxscoresByClub?.[id]} slateDate={slateDate} relievers={wide ? 4 : 3} />
  ))
  if (clubIds.every((id) => bullpenGrid(boxscoresByClub?.[id], id, { slateDate }).rows.length === 0)) return null
  return (
    <Card frame="stamped" label="Bullpen" count="Pitches per Oct game" className="ww-bullpen">
      <Grid min={300} gap="base">
        {sides}
      </Grid>
    </Card>
  )
}
