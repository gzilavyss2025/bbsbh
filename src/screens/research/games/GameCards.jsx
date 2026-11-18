import { useId, useState } from 'react'
import { HOW, HOW_INFO, TOTALS, pitchingSide } from '../../../api/research/games.js'
import { Chips } from '../../../components/ui/control/Chips.jsx'
import { IconButton } from '../../../components/ui/control/IconButton.jsx'
import { InfoPopover } from '../../../components/ui/InfoPopover.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { Cluster } from '../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'

// THE GAME-MODE CARDS (/research, #3137): a From/To card per total and the "How runs
// scored" card. A total's label reads from the picked side ("Runs allowed" with a Pitching
// club). Either end of a range may be blank; a field applies on blur or Enter, the way the
// "Who most" PA minimum does, so typing 12 never searches for 1.

// `signed`: a bound may be negative (the play cards' Launch angle).
const toNum = (v, signed) => ((signed ? /^-?\d{1,3}$/ : /^\d{1,3}$/).test(v) ? Number(v) : null)

function Bound({ label, value, onCommit, signed = false }) {
  const id = useId()
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  const commit = () => {
    const n = toNum(draft.trim(), signed)
    if (n !== value) onCommit(n)
    setDraft(n == null ? '' : String(n))
  }
  return (
    <span className="research__min">
      <label className="t-label" htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode={signed ? 'text' : 'numeric'} min={signed ? undefined : '0'} placeholder="Any" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
    </span>
  )
}

export function RangeCard({ label, range, onRange, signed = false }) {
  // Clearing both ends keeps the card open with no bound, like an emptied chip card.
  const set = (i) => (n) => {
    const next = [...range]
    next[i] = n
    onRange(next)
  }
  return (
    <Card frame="ledger">
      <Stack gap="tight">
        <Cluster className="research__cardhead">
          <span className="t-label t-label--bold">{label}</span>
          <IconButton label={`Remove ${label}`} mark="sm" onClick={() => onRange(null)}>✕</IconButton>
        </Cluster>
        <Cluster>
          <Bound key={`f${range[0]}`} label="From" value={range[0]} onCommit={set(0)} signed={signed} />
          <Bound key={`t${range[1]}`} label="To" value={range[1]} onCommit={set(1)} signed={signed} />
        </Cluster>
        <p className="t-label t-label--nocaps">Leave either end blank for “or more” or “or fewer”.</p>
      </Stack>
    </Card>
  )
}

function HowCard({ how, onHow }) {
  return (
    <Card frame="ledger">
      <Stack gap="tight">
        <Cluster className="research__cardhead">
          <span className="t-label t-label--bold">How runs scored</span>
          <InfoPopover label="About How runs scored" className="infopop--paper infopop--down">{HOW_INFO}</InfoPopover>
          <IconButton label="Remove How runs scored" mark="sm" onClick={() => onHow(null)}>✕</IconButton>
        </Cluster>
        <Chips label="How runs scored" layout="wrap" multiple options={HOW.map(([value, label]) => ({ value, label }))} value={how} onChange={onHow} />
      </Stack>
    </Card>
  )
}

export const totalLabel = (q, t) => (pitchingSide(q) ? t.allowed : t.label)

// The open game cards. `g.how` null-vs-[]: an open, emptied card is [] with `howOpen`.
export function GameCards({ q, onChange }) {
  const g = q.g
  const setG = (next) => onChange({ ...q, g: { ...g, ...next } })
  return (
    <>
      {TOTALS.filter((t) => g.totals[t.key]).map((t) => (
        <RangeCard
          key={t.key}
          label={totalLabel(q, t)}
          range={g.totals[t.key]}
          onRange={(r) => {
            const totals = { ...g.totals }
            if (r) totals[t.key] = r
            else delete totals[t.key]
            setG({ totals })
          }}
        />
      ))}
      {g.howOpen || g.how.length ? <HowCard how={g.how} onHow={(how) => setG(how ? { how, howOpen: true } : { how: [], howOpen: false })} /> : null}
    </>
  )
}

// The "Add a filter" options the game cards add: [value, label], and how to open one.
export function gameAddOptions(q) {
  const g = q.g
  const out = TOTALS.filter((t) => !g.totals[t.key]).map((t) => [`g:${t.key}`, totalLabel(q, t)])
  if (!g.how.length && !g.howOpen) out.push(['g:how', 'How runs scored'])
  return out
}
export function openGameCard(q, value) {
  const key = value.slice(2)
  if (key === 'how') return { ...q, g: { ...q.g, howOpen: true } }
  return { ...q, g: { ...q.g, totals: { ...q.g.totals, [key]: [1, null] } } }
}
