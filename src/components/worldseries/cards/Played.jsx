import { useRouteLink } from '../../../lib/nav.js'
import { gamePath, logbookNewPath } from '../../../lib/route.js'
import { Door } from '../../ui/control/Door.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { Stack } from '../../ui/layout/Stack.jsx'

// PLAYED (phone, off day): one row per World Series game already played, with
// its date and park, a Box door (the existing box score route, sealed there as
// ever) and a Stamp door (the Game Log's stamp flow, ADR-0048). Wide puts the
// Stamp doors in the header instead: one stamp action per game on the page.
// rows: [{ gamePk, gameNumber, date, park, awayAbbr, homeAbbr }]. No score here.
export function Played({ rows }) {
  const link = useRouteLink()
  if (!rows.length) return null
  return (
    <Card frame="stamped" label="Played" className="ww-played">
      <Stack as="ul" gap="snug" className="ww-played__rows">
        {rows.map((r) => (
          <li key={r.gamePk} className="ww-played__row">
            <span className="ww-played__game">{`Game ${r.gameNumber}`}</span>
            <span className="ww-played__meta">{[r.date.slice(5).replace('-', '/'), r.park].filter(Boolean).join(' · ')}</span>
            <Door {...link(gamePath(r.date, r.awayAbbr, r.homeAbbr, 'boxscore'))}>Box</Door>
            <Door {...link(logbookNewPath(r.gamePk))}>Stamp</Door>
          </li>
        ))}
      </Stack>
    </Card>
  )
}
