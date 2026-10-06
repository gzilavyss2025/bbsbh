import { Cluster } from '../ui/layout/Cluster.jsx'
import { Pill } from '../ui/control/Pill.jsx'

// Which part of a season a season-store page shows: the regular season or the
// postseason, which the store keeps BESIDE it, never blended (ADR-0102, ADR-0103). Pill
// controls, as SeasonPicker's are: it filters the content under it. Page
// state, not an address. The page shows it only once a postseason game is on
// file (`hasPostseason`, src/api/fouls.js).
export function PartOfSeason({ postseason, onChange }) {
  return (
    <Cluster gap="tight" align="center" role="group" aria-label="Part of the season">
      {[['Regular season', false], ['Postseason', true]].map(([label, post]) => (
        <Pill key={label} role="control" fill="paper" pressed={postseason === post} onClick={() => onChange(post)}>
          {label}
        </Pill>
      ))}
    </Cluster>
  )
}
