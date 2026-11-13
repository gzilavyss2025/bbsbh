import { useState } from 'react'
import { ASKS, FILTER_BY_KEY } from '../../api/research/filters.js'
import { rate3 } from '../../api/person/shared.js'
import { gamePath, playerPath } from '../../lib/route.js'
import { ordinal as nth } from '../../lib/format.js'
import { labelDate as shortDate } from '../../lib/time/standingsDates.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'

// THE ANSWER (/research, #2234): `AnswerCard` is the sentence and the summary line,
// set as the page's payoff; `MatchList` is the matches (two-line rows on a phone,
// a table at the wide step) plus the leaders or outcome table the question asks for.
// Every date opens that game's box score, sealed (ADR-0101); every name opens the
// player page. Nothing here computes: `a` is answer.js's result.

const PAGE = 20
const resultLabel = (ev) => Object.fromEntries(FILTER_BY_KEY.res.options)[ev] ?? ev.replaceAll('_', ' ')
const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const boxHref = (m) => gamePath(m.date, m.away, m.home, 'boxscore', m.gameNumber)

function Name({ id, people }) {
  return <a href={playerPath(id)}>{people[id] ?? `#${id}`}</a>
}

function Sentence({ ask, a, people }) {
  const n = a.matches.length
  if (!n) return 'No plate appearance on file matches.'
  const last = a.matches[0]
  if (ask === 'last') {
    return (
      <>
        <Name id={last.batter} people={people} /> off <Name id={last.pitcher} people={people} />, <a href={boxHref(last)}>{shortDate(last.date)}</a>
      </>
    )
  }
  if (ask === 'often') return `${plural(n, 'time', 'times')} in ${plural(a.games, 'game', 'games')}`
  if (ask === 'most') return <><Name id={a.batters[0].id} people={people} /> leads with {a.batters[0].n}</>
  return `${a.outcomes[0].label}: ${a.outcomes[0].n} of ${n.toLocaleString()}`
}

// One result filter gives every match the same event, so its slash line says nothing new.
function summary(a, ask) {
  const n = a.matches.length
  const parts = []
  if (ask !== 'often') parts.push(plural(n, 'match', 'matches'))
  if (a.base) parts.push(`${((100 * n) / a.base).toFixed(1)}% of ${plural(a.base, 'PA', 'PAs')} with these filters and any result`)
  const kinds = new Set(a.matches.map((m) => m.event)).size
  const t = a.totals
  if (kinds > 1) parts.push(`${rate3(t.avg)}/${rate3(t.obp)}/${rate3(t.slg)}`)
  return parts.join(' · ')
}

export function AnswerCard({ ask, a, people }) {
  return (
    <Card frame="stamped" label={ASKS.find((x) => x.key === ask)?.label}>
      <Stack gap="tight" aria-live="polite">
        <p className="research__answer"><Sentence ask={ask} a={a} people={people} /></p>
        {a.matches.length > 0 && <p className="research__summary">{summary(a, ask)}</p>}
      </Stack>
    </Card>
  )
}

function Leaders({ title, rows, people }) {
  return (
    <Table label={title} className="research__table">
      <thead><tr><th>{title}</th><th className="research__num">Times</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td><Name id={r.id} people={people} /></td><td className="research__num">{r.n}</td></tr>)}</tbody>
    </Table>
  )
}

function Rows({ rows, people }) {
  return (
    <ul className="research__rows">
      {rows.map((m) => (
        <li key={m.key} className="research__row">
          <a className="research__date" href={boxHref(m)}>{shortDate(m.date)}</a>
          <span className="research__result">{resultLabel(m.event)}</span>
          <span><Name id={m.batter} people={people} /> v <Name id={m.pitcher} people={people} /> · {m.top ? '▲' : '▼'}{m.inning}</span>
          <span className="research__ord">{nth(m.ordinal)} in {m.date.slice(0, 4)}</span>
        </li>
      ))}
    </ul>
  )
}

function MatchTable({ rows, people }) {
  return (
    <Table label="Matches" className="research__table">
      <thead><tr><th>Date</th><th>Batter</th><th>Pitcher</th><th>Result</th><th>Inn</th><th className="research__num">His</th></tr></thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.key}>
            <td><a href={boxHref(m)}>{shortDate(m.date)}</a></td>
            <td><Name id={m.batter} people={people} /></td>
            <td><Name id={m.pitcher} people={people} /></td>
            <td>{resultLabel(m.event)}</td>
            <td>{m.top ? '▲' : '▼'}{m.inning}</td>
            <td className="research__num">{nth(m.ordinal)} in {m.date.slice(0, 4)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function MatchList({ a, people, wide }) {
  const [shown, setShown] = useState(PAGE)
  if (!a.matches.length) return null
  const rows = a.matches.slice(0, shown)
  return (
    <Stack>
      {wide ? <MatchTable rows={rows} people={people} /> : <Rows rows={rows} people={people} />}
      {a.matches.length > shown && (
        <Button size="control" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, a.matches.length - shown)} more · {a.matches.length - shown} left
        </Button>
      )}
    </Stack>
  )
}

export function AskTables({ ask, a, people }) {
  if (!a.matches.length) return null
  if (ask === 'most') return <><Leaders title="Batters" rows={a.batters} people={people} /><Leaders title="Pitchers" rows={a.pitchers} people={people} /></>
  if (ask === 'what') {
    return (
      <Table label="Results" className="research__table">
        <thead><tr><th>Result</th><th className="research__num">Times</th><th className="research__num">Share</th></tr></thead>
        <tbody>{a.outcomes.map((o) => <tr key={o.label}><td>{o.label}</td><td className="research__num">{o.n}</td><td className="research__num">{((100 * o.n) / a.matches.length).toFixed(1)}%</td></tr>)}</tbody>
      </Table>
    )
  }
  return null
}
