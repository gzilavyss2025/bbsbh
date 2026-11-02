import { useState } from 'react'
import './wirelab.css'
import { useAsync } from '../../../hooks/useAsync.js'
import { fetchLeagueMoves } from '../../../api/transactions/leagueFeed.js'
import { templateFor } from '../../../api/transactions/templates.js'
import { MoveRow } from '../../../components/transactions/MoveRow.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Segmented } from '../../../components/ui/control/Segmented.jsx'
import { isoToday } from '../../../lib/dates.js'

// THE WIRE LAB (/wire-lab) — unlisted. The last few weeks of real roster moves,
// grouped by the fact template each one gets (api/transactions/templates.js),
// each drawn as the offseason ledger draws it, with its type codes beside it.
// It is where the templates are tuned: a move in the wrong group, or a card
// whose line says something off, shows here first. Roster moves carry no score.
const TEMPLATES = [
  ['free-agency', 'Elected free agency'],
  ['cut', 'Outrighted, designated, released, claimed'],
  ['deal', 'Signings and trades'],
  ['fallback', 'Everything else (sheet only)'],
]
const SPAN = 3
// Windows worth tuning against. The 2026 deadline fell on Aug. 3 (136 trade
// rows that day); the window reads back from the day after.
const PRESETS = [
  { value: 'today', label: 'Latest', end: null },
  { value: 'deadline', label: 'Trade deadline', end: '2026-08-04' },
]

function shiftDay(day, n) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function WireLab() {
  const [windows, setWindows] = useState(4)
  const [preset, setPreset] = useState('today')
  // Every group starts folded; open the one you are tuning.
  const [opened, setOpened] = useState(() => new Set())
  const end = PRESETS.find((p) => p.value === preset).end ?? isoToday()
  const { data, loading } = useAsync(
    (signal) =>
      Promise.all(
        Array.from({ length: windows }, (_, i) => fetchLeagueMoves(shiftDay(end, -i * SPAN), undefined, { signal })),
      ).then((all) => all.flat()),
    [end, windows],
  )
  const groups = new Map(TEMPLATES.map(([key]) => [key, []]))
  for (const day of data ?? []) {
    for (const story of day.stories ?? []) groups.get(templateFor(story)).push({ story, date: day.date })
  }
  return (
    <div className="screen wirelab">
      <h1 className="wirelab__title">Wire Lab</h1>
      <Segmented
        label="Moves from"
        value={preset}
        onChange={(v) => {
          setPreset(v)
          setWindows(4)
        }}
        options={PRESETS.map(({ value, label }) => ({ value, label }))}
      />
      <p className="wirelab__meta">
        {loading ? 'Loading moves…' : `${[...groups.values()].reduce((n, g) => n + g.length, 0)} moves, the last ${windows * SPAN} days to ${end}`}
      </p>
      {TEMPLATES.map(([key, label]) => (
        <details
          key={key}
          className="wirelab__group"
          open={opened.has(key)}
          onToggle={(e) => {
            const isOpen = e.currentTarget.open
            setOpened((o) => {
              const next = new Set(o)
              if (isOpen) next.add(key)
              else next.delete(key)
              return next
            })
          }}
        >
          <summary className="wirelab__head">
            {label} <span className="wirelab__count">{groups.get(key).length}</span>
          </summary>
          {/* A closed group draws no cards, so it reads no player facts. */}
          {opened.has(key) && (
            <ul className="oseason__list wirelab__list">
              {groups.get(key).map(({ story, date }) => (
                <li key={story.id} className="wirelab__item">
                  <span className="wirelab__codes">{date} · {(story.codes ?? []).join(' ')}</span>
                  <ul className="wirelab__one">
                    <MoveRow story={story} marks date={date} />
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </details>
      ))}
      <Button size="control" onClick={() => setWindows((w) => w + 4)}>
        {SPAN * 4} more days
      </Button>
    </div>
  )
}
