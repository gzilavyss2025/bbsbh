import { useState } from 'react'
import { RUNS_INFO, STREAK_STATS } from '../../api/research/streaks.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { labelDate as shortDate } from '../../lib/time/standingsDates.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { BoxDate } from './AnswerView.jsx'
import { streakClub } from './useEraClubNames.js'
import { RangeCard } from './GameCards.jsx'
import { rangeWords } from '../../api/research/games.js'

// THE STREAKS MODE's cards and answer (/research, #3142; wireframe and critique, Gary
// 2026-11-17). Cards: a From/To card per stat of the picked side (GameCards' RangeCard)
// and, for pitchers, a Starts only toggle. The answer names the condition in its sentence
// on every width; the list is the top 25, tied lengths sharing a rank ("T-3"), a running
// streak marked "Active". Each date opens that game's sealed box score (ADR-0101).

const PAGE = 10
const statsOf = (q) => STREAK_STATS[q.s.side]

// "with 10+ strikeouts and ≤0 runs allowed" (empty with no bounded card).
export function streakCondition(q) {
  const parts = statsOf(q).filter((t) => q.s.totals[t.key]?.some((v) => v != null)).map((t) => {
    const r = q.s.totals[t.key]
    return `${rangeWords(r)} ${r[0] === 1 && r[1] === 1 ? t.units[0] : t.units[1]}`
  })
  return parts.length ? `with ${parts.join(' and ')}` : ''
}

const gameWord = (q, n) => (q.s.side === 'pit' && q.s.starts ? (n === 1 ? 'start' : 'starts') : n === 1 ? 'game' : 'games')

// The pills for the filter bar.
export const streakPills = (q) => [
  ...statsOf(q).filter((t) => q.s.totals[t.key]?.some((v) => v != null)).map((t) => `${t.label} ${rangeWords(q.s.totals[t.key])}`),
  ...(q.s.side === 'pit' && q.s.starts ? ['Starts only'] : []),
]

export function StreakCards({ q, onChange }) {
  const s = q.s
  const setS = (next) => onChange({ ...q, s: { ...s, ...next } })
  return (
    <>
      {s.side === 'pit' && (
        <Cluster>
          <Button size="control" pressed={s.starts} onClick={() => setS({ starts: !s.starts })}>Starts only</Button>
        </Cluster>
      )}
      {statsOf(q).filter((t) => s.totals[t.key]).map((t) => (
        <RangeCard
          key={t.key}
          label={t.label}
          range={s.totals[t.key]}
          onRange={(r) => {
            const totals = { ...s.totals }
            if (r) totals[t.key] = r
            else delete totals[t.key]
            setS({ totals })
          }}
        />
      ))}
      {s.side === 'bat' && s.totals.runsOn && <InfoPopover label="About runs driven in" className="infopop--paper infopop--down">{RUNS_INFO}</InfoPopover>}
    </>
  )
}

// The "Add a filter" options the streak cards add, and how to open one.
export const streakAddOptions = (q) => statsOf(q).filter((t) => !q.s.totals[t.key]).map((t) => [`s:${t.key}`, t.label])
export const openStreakCard = (q, value) => ({ ...q, s: { ...q.s, totals: { ...q.s.totals, [value.slice(2)]: [1, null] } } })

const Name = ({ id, people }) => <PlayerLink id={id} name={people[id] ?? ''}>{people[id] ?? `#${id}`}</PlayerLink>
const through = (s, asOf) => (s.active ? `Active through ${shortDate(asOf)}` : shortDate(s.last.date))
const rankText = (s, list) => (list.filter((x) => x.len === s.len).length > 1 ? `T-${s.rank}` : `${s.rank}`)

export function StreakAnswerCard({ q, a, people, asOf }) {
  const top = a.top[0]
  return (
    <Card frame="stamped" label="Longest streak">
      <Stack gap="tight" aria-live="polite">
        <p className="research__answer">
          {top ? <><Name id={top.player} people={people} />, {top.len} straight {gameWord(q, top.len)} {streakCondition(q)}</> : 'No streak of 2 or more games on file matches.'}
        </p>
        {top && (
          <p className="research__summary">
            <BoxDate m={top.first}>{shortDate(top.first.date)}</BoxDate> – {top.active ? through(top, asOf) : <BoxDate m={top.last}>{shortDate(top.last.date)}</BoxDate>}
          </p>
        )}
      </Stack>
    </Card>
  )
}

function Rows({ rows, all, people, asOf, q, name }) {
  return (
    <ul className="research__rows">
      {rows.map((s) => (
        <li key={`${s.player}-${s.first.gamePk}`} className="research__row">
          <span className="research__date"><BoxDate m={s.first}>{shortDate(s.first.date)}</BoxDate></span>
          <span><Name id={s.player} people={people} /> · {streakClub(s, name)}</span>
          <span className="research__ord">{rankText(s, all)} · {s.len} {gameWord(q, s.len)} · {s.active ? <span className="research__active">{through(s, asOf)}</span> : `through ${shortDate(s.last.date)}`}</span>
        </li>
      ))}
    </ul>
  )
}

function StreakTable({ rows, all, people, asOf, q, name }) {
  return (
    <Table label="Longest streaks" className="research__table">
      <thead><tr><th className="research__num">#</th><th>Player</th><th>Club</th><th className="research__num">{q.s.side === 'pit' && q.s.starts ? 'Starts' : 'Games'}</th><th>From</th><th>Through</th></tr></thead>
      <tbody>
        {rows.map((s) => (
          <tr key={`${s.player}-${s.first.gamePk}`}>
            <td className="research__num">{rankText(s, all)}</td>
            <td><Name id={s.player} people={people} /></td>
            <td>{streakClub(s, name)}</td>
            <td className="research__num">{s.len}</td>
            <td><BoxDate m={s.first}>{shortDate(s.first.date)}</BoxDate></td>
            <td>{s.active ? <span className="research__active">{through(s, asOf)}</span> : <BoxDate m={s.last}>{shortDate(s.last.date)}</BoxDate>}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function StreakMatches({ q, a, people, wide, asOf, name }) {
  const [shown, setShown] = useState(PAGE)
  if (!a.top.length) return null
  const rows = a.top.slice(0, shown)
  return (
    <Stack>
      {wide ? <StreakTable rows={rows} all={a.top} people={people} asOf={asOf} q={q} name={name} /> : <Rows rows={rows} all={a.top} people={people} asOf={asOf} q={q} name={name} />}
      {a.top.length > shown && <Button size="control" onClick={() => setShown(a.top.length)}>Show {a.top.length - shown} more</Button>}
    </Stack>
  )
}
