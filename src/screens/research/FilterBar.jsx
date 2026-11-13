import { useId } from 'react'
import { FILTERS, FILTER_BY_KEY } from '../../api/research/filters.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// THE FILTER BAR (/research, #2234): one card per active chip filter, an "Add a
// filter" picker for the rest, and the people and club pickers. It holds no state:
// the query lives in the URL and comes in as `q`; every change calls onChange(q).
// A card the season range cannot answer is listed under `blocked` and stays off.

function Field({ label, children }) {
  const id = useId()
  return (
    <Stack gap="tight" className="research__field">
      <label className="t-label" htmlFor={id}>{label}</label>
      {children(id)}
    </Stack>
  )
}

function PersonField({ label, value, people, onChange }) {
  const listId = useId()
  const names = Object.entries(people).sort((a, b) => a[1].localeCompare(b[1]))
  return (
    <Field label={label}>
      {(id) => (
        <>
          <input
            id={id}
            list={listId}
            defaultValue={value ? people[value] ?? '' : ''}
            placeholder="Anyone"
            onChange={(e) => {
              const hit = names.find(([, n]) => n === e.target.value)
              if (hit || !e.target.value) onChange(hit ? Number(hit[0]) : null)
            }}
          />
          <datalist id={listId}>
            {names.map(([pid, n]) => <option key={pid} value={n} />)}
          </datalist>
        </>
      )}
    </Field>
  )
}

function ClubField({ label, value, clubs, onChange }) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">Any</option>
          {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </Field>
  )
}

export function FilterBar({ q, people, clubs, blocked, onChange }) {
  const addId = useId()
  const setChip = (key, chip) => {
    const chips = { ...q.chips }
    if (chip) chips[key] = chip
    else delete chips[key]
    onChange({ ...q, chips })
  }
  const blockedKeys = new Set(blocked.map((b) => b.key))
  const active = Object.keys(q.chips).filter((k) => !blockedKeys.has(k))
  const addable = FILTERS.filter((f) => !q.chips[f.key] && !blockedKeys.has(f.key))
  return (
    <Stack>
      <Cluster>
        <PersonField label="Batter" value={q.batter} people={people} onChange={(batter) => onChange({ ...q, batter })} />
        <PersonField label="Pitcher" value={q.pitcher} people={people} onChange={(pitcher) => onChange({ ...q, pitcher })} />
        <ClubField label="Batting club" value={q.team} clubs={clubs} onChange={(team) => onChange({ ...q, team })} />
        <ClubField label="Ballpark (home club)" value={q.park} clubs={clubs} onChange={(park) => onChange({ ...q, park })} />
      </Cluster>
      {active.map((key) => {
        const f = FILTER_BY_KEY[key]
        const chip = q.chips[key]
        return (
          <Card key={key} frame="ledger">
            <Stack gap="tight">
              <Cluster>
                <span className="t-label t-label--bold">{f.label}</span>
                {!f.single && (
                  <Button size="control" pressed={chip.inv} onClick={() => setChip(key, { ...chip, inv: !chip.inv })}>
                    Invert
                  </Button>
                )}
                <Button size="control" skin="ghost" onClick={() => setChip(key, null)}>Remove</Button>
              </Cluster>
              <Chips
                label={f.label}
                layout="wrap"
                multiple={!f.single}
                options={f.options.map(([value, label]) => ({ value, label }))}
                value={f.single ? chip.vals[0] : chip.vals}
                onChange={(v) => {
                  const vals = f.single ? [v] : v
                  setChip(key, vals.length ? { ...chip, vals } : null)
                }}
              />
            </Stack>
          </Card>
        )
      })}
      {addable.length > 0 && (
        <Stack gap="tight" className="research__field">
          <label className="t-label" htmlFor={addId}>Add a filter</label>
          <select
            id={addId}
            value=""
            onChange={(e) => {
              const f = FILTER_BY_KEY[e.target.value]
              if (f) setChip(f.key, { vals: [f.options[0][0]], inv: false })
            }}
          >
            <option value="">Choose…</option>
            {addable.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </Stack>
      )}
    </Stack>
  )
}
