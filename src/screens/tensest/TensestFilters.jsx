import { useId } from 'react'
import { Button } from '../../components/ui/control/Button.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'

// The league list's filters (#2981, Gary's option B): batter, pitcher, park, batting
// club and pitching club, which combine. Each set filter also shows as a chip that
// clears it, and "Clear all" clears them all. `value` holds ids (null = any); `options`
// is slices.js filterOptions plus `clubs`. Native selects: on an iPhone each is the
// system picker, which scrolls a long list well.
const FIELDS = [
  ['batter', 'Batter', 'batters', 'Any batter'],
  ['pitcher', 'Pitcher', 'pitchers', 'Any pitcher'],
  ['park', 'Park', 'parks', 'Any park'],
  ['batting', 'Batting club', 'clubs', 'Any club'],
  ['pitching', 'Pitching club', 'clubs', 'Any club'],
]

export function TensestFilters({ value, options, onChange }) {
  const uid = useId()
  const set = (key, v) => onChange({ ...value, [key]: v })
  const nameOf = (list, id) => options[list].find((o) => o.id === id)?.name ?? ''
  const active = FIELDS.filter(([key]) => value[key] != null)
  return (
    <Stack gap="snug" className="tensest__filters">
      <Cluster className="tensest__fields">
        {FIELDS.map(([key, label, list, any]) => (
          <Stack gap="tight" key={key} className="tensest__field">
            <label className="t-label" htmlFor={`${uid}-${key}`}>{label}</label>
            <select id={`${uid}-${key}`} value={value[key] ?? ''} onChange={(e) => set(key, e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{any}</option>
              {options[list].map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Stack>
        ))}
      </Cluster>
      {active.length > 0 && (
        <Cluster gap="tight" className="tensest__chips" role="group" aria-label="Filters on">
          {active.map(([key, label, list]) => (
            <Button key={key} size="control" aria-label={`Clear ${label}: ${nameOf(list, value[key])}`} onClick={() => set(key, null)}>
              {key === 'batting' || key === 'pitching' ? `${label}: ` : ''}{nameOf(list, value[key])} ✕
            </Button>
          ))}
          {active.length > 1 && <Button size="control" onClick={() => onChange({})}>Clear all</Button>}
        </Cluster>
      )}
    </Stack>
  )
}
