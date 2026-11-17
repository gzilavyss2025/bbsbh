import { useId, useState } from 'react'
import { rateLeaders } from '../../api/research/answer.js'
import { ASKS, parseMin, resultName } from '../../api/research/filters.js'
import { rate3 } from '../../api/person/shared.js'
import { gamePath } from '../../lib/route.js'
import { useRouteLink } from '../../lib/nav.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { ordinal as nth } from '../../lib/format.js'
import { labelDate as shortDate } from '../../lib/time/standingsDates.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'

// THE ANSWER (/research, #2234): `AnswerCard` is the sentence and the summary line,
// set as the page's payoff; `MatchList` is the matches (two-line rows on a phone,
// a table at the wide step) plus the leaders or outcome table the question asks for.
// Every date opens that game's box score, sealed (ADR-0101); every name opens the
// player page. Nothing here computes: `a` is answer.js's result.

const PAGE = 20

export const plural = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const pct = (r) => `${(100 * r).toFixed(1)}%`
const boxHref = (m) => gamePath(m.date, m.away, m.home, 'boxscore', m.gameNumber)

// A name opens the player page the app's own way (PlayerLink: the canonical
// /player/{name-id} address, in-app navigation, the desktop hover card).
function Name({ id, people }) {
  return <PlayerLink id={id} name={people[id] ?? ''}>{people[id] ?? `#${id}`}</PlayerLink>
}

// A date opens that game's box score, sealed (ADR-0101), without a full page load.
export function BoxDate({ m, children }) {
  const link = useRouteLink()
  return <a {...link(boxHref(m))}>{children}</a>
}

// "Who most" ranks by rate only with a PA-result card (#3147): without one every rate is 100%.
const byRate = (q, a) => q.rank === 'rate' && Boolean(a.baseBy)
const leaderRows = (q, a, who) => (byRate(q, a) ? rateLeaders(a, who, q.min) : who === 'batter' ? a.batters : a.pitchers)

function Sentence({ ask, q, a, people }) {
  const n = a.matches.length
  if (!n) return 'No plate appearance on file matches.'
  const last = a.matches[0]
  if (ask === 'last') {
    return (
      <>
        <Name id={last.batter} people={people} /> off <Name id={last.pitcher} people={people} />, <BoxDate m={last}>{shortDate(last.date)}</BoxDate>
      </>
    )
  }
  if (ask === 'often') return `${plural(n, 'time', 'times')} in ${plural(a.games, 'game', 'games')}`
  if (ask === 'most') {
    const top = leaderRows(q, a, 'batter')[0]
    if (!top) return `No batter has ${plural(q.min, 'PA', 'PAs')} here.`
    return byRate(q, a) ? <><Name id={top.id} people={people} /> leads at {pct(top.rate)}</> : <><Name id={top.id} people={people} /> leads with {top.n}</>
  }
  return `${a.outcomes[0].label}: ${a.outcomes[0].n} of ${n.toLocaleString()}`
}

// One result filter gives every match the same event, so its slash line says nothing new.
function summary(a, ask, q) {
  const n = a.matches.length
  const parts = []
  if (ask !== 'often') parts.push(plural(n, 'match', 'matches'))
  if (a.base) parts.push(`${((100 * n) / a.base).toFixed(1)}% of ${plural(a.base, 'PA', 'PAs')} with these filters and any result`)
  const kinds = new Set(a.matches.map((m) => m.event)).size
  const t = a.totals
  if (kinds > 1) parts.push(`${rate3(t.avg)}/${rate3(t.obp)}/${rate3(t.slg)}`)
  if (ask === 'most' && byRate(q, a)) parts.push(`rate, min ${plural(q.min, 'PA', 'PAs')}`)
  return parts.join(' · ')
}

export function AnswerCard({ ask, q, a, people, note }) {
  return (
    <Card frame="stamped" label={ASKS.find((x) => x.key === ask)?.label}>
      <Stack gap="tight" aria-live="polite">
        <p className="research__answer"><Sentence ask={ask} q={q} a={a} people={people} /></p>
        {a.matches.length > 0 && <p className="research__summary">{summary(a, ask, q)}</p>}
        {note && <p className="research__summary">{note}</p>}
      </Stack>
    </Card>
  )
}

function Leaders({ title, rows, rate, min, people }) {
  if (!rows.length) return <p className="t-label t-label--nocaps">{title}: none with {plural(min, 'PA', 'PAs')} here.</p>
  return (
    <Table label={title} className="research__table">
      <thead><tr><th>{title}</th>{rate ? <><th className="research__num">Rate</th><th className="research__num">Of PA</th></> : <th className="research__num">Times</th>}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><Name id={r.id} people={people} /></td>
            {rate ? <><td className="research__num">{pct(r.rate)}</td><td className="research__num">{r.n} of {r.pa}</td></> : <td className="research__num">{r.n}</td>}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// Count or Rate, and the rate's PA minimum (#3147). Both live in the URL (rank, min).
function RankBar({ q, onChange }) {
  const id = useId()
  const [draft, setDraft] = useState(String(q.min))
  // The minimum applies on blur or Enter, not per keystroke: typing 120 never ranks by 1 or 12.
  const commit = () => {
    const min = parseMin(draft)
    if (min && min !== q.min) onChange({ ...q, min })
    setDraft(String(min ?? q.min))
  }
  return (
    <Cluster className="research__rank">
      <Segmented label="Rank by" options={[{ value: 'count', label: 'Count' }, { value: 'rate', label: 'Rate' }]} value={q.rank} onChange={(rank) => onChange({ ...q, rank })} />
      {q.rank === 'rate' && (
        <span className="research__min">
          <label className="t-label" htmlFor={id}>Min PA</label>
          <input id={id} type="number" inputMode="numeric" min="1" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
        </span>
      )}
    </Cluster>
  )
}

function Rows({ rows, people }) {
  return (
    <ul className="research__rows">
      {rows.map((m) => (
        <li key={m.key} className="research__row">
          <span className="research__date"><BoxDate m={m}>{shortDate(m.date)}</BoxDate></span>
          <span className="research__result">{resultName(m.event)}</span>
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
            <td><BoxDate m={m}>{shortDate(m.date)}</BoxDate></td>
            <td><Name id={m.batter} people={people} /></td>
            <td><Name id={m.pitcher} people={people} /></td>
            <td>{resultName(m.event)}</td>
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

export function AskTables({ ask, q, a, people, onChange }) {
  if (!a.matches.length) return null
  if (ask === 'most') {
    const rate = byRate(q, a)
    return (
      <>
        {a.baseBy && <RankBar q={q} onChange={onChange} />}
        <Leaders title="Batters" rows={leaderRows(q, a, 'batter')} rate={rate} min={q.min} people={people} />
        <Leaders title="Pitchers" rows={leaderRows(q, a, 'pitcher')} rate={rate} min={q.min} people={people} />
      </>
    )
  }
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
