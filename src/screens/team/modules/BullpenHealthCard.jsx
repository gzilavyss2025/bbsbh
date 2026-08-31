import { useMemo } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'
import { fetchWorkload, staffGridFor } from '../../../api/workload.js'
import { StaffGrid } from '../../../components/workload/StaffGrid.jsx'

// THE CLUB'S PEN, on the club's own page.
//
// The availability board has only ever existed inside a game you are scoring —
// nested under the opposing starter card on a lineup page — so "how is my
// bullpen" had no address anywhere on /team/{id}. This is the same seven-day
// staff grid that board draws, off the same nightly file, on the Roster tab
// beside the roster it describes.
//
// Spoiler-free, inherited from api/workload.js: completed appearances only, and
// the as-of date excludes today, so nothing in progress can leak. No SealBox.
//
// MLB ONLY, and it degrades rather than explains: workload.json is built from
// the thirty active MLB rosters, so an affiliate's page finds no arms and the
// card does not render at all (the graceful-degradation convention). Same for
// a club whose arms have not pitched inside the file's window.
//
// It reads the FILE's own asOf rather than the page's `asOf` prop. The grid
// describes the pen as it stands now; pointing it at an archival date would
// draw a board of empty cells and call every arm available.
export function BullpenHealthCard({ teamId }) {
  const { data } = useAsync(fetchWorkload, [])
  const rows = useMemo(
    () => (data?.asOf ? staffGridFor(data, Number(teamId), data.asOf) : null),
    [data, teamId],
  )
  if (!rows || rows.length === 0) return null

  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Bullpen health</span>
      </div>
      <div className="thub-card__body">
        <StaffGrid rows={rows} />
      </div>
    </div>
  )
}
