import { useState } from 'react'
import { FILTER_BY_KEY } from '../../api/research/filters.js'
import { rate3 } from '../../api/person/shared.js'
import { gamePath, playerPath } from '../../lib/route.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'

// THE ANSWER (/research, #2234): a plain sentence, the summary line, and one view per
// question. Every date opens that game's box score, sealed (ADR-0101); every name
// opens the player page. It computes nothing: `a` is answer.js's result.

const PAGE = 20
const resultLabel = (ev) => Object.fromEntries(FILTER_BY_KEY.res.options)[ev] ?? ev.replaceAll('_', ' ')
const nth = (n) => {
  const teen = n % 100 >= 11 && n % 100 <= 13
  return `${n}${teen ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}
const shortDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function Name({ id, people }) {
  return <a href={playerPath(id)}>{people[id] ?? `#${id}`}</a>
}

function sentence(ask, a, people) {
  const n = a.matches.length
  if (!n) return 'No plate appearance on file matches.'
  const last = a.matches[0]
  if (ask === 'last') return `Last: ${people[last.batter] ?? 'a batter'} against ${people[last.pitcher] ?? 'a pitcher'}, ${shortDate(last.date)}.`
  if (ask === 'often') {
    const share = a.base ? ` That is ${((100 * n) / a.base).toFixed(1)}% of ${a.base.toLocaleString()} plate appearances with the same filters and any result.` : ''
    return `${n.toLocaleString()} times in ${a.games.toLocaleString()} games.${share}`
  }
  if (ask === 'most') return `${people[a.batters[0].id] ?? 'One batter'} leads with ${a.batters[0].n}.`
  return `${a.outcomes[0].label} is the most common result: ${a.outcomes[0].n} of ${n.toLocaleString()}.`
}

function Leaders({ title, rows, people }) {
  return (
    <Table label={title}>
      <thead><tr><th>{title}</th><th>Times</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td><Name id={r.id} people={people} /></td><td>{r.n}</td></tr>)}</tbody>
    </Table>
  )
}

export function AnswerView({ ask, a, people }) {
  const [shown, setShown] = useState(PAGE)
  const t = a.totals
  return (
    <Stack>
      <p className="research__answer">{sentence(ask, a, people)}</p>
      {a.matches.length > 0 && (
        <p className="t-label t-label--nocaps">
          {t.pa} PA · {t.h} H · {t.hr} HR · {t.bb} BB · {t.k} SO · {rate3(t.avg)}/{rate3(t.obp)}/{rate3(t.slg)}
        </p>
      )}
      {ask === 'most' && a.matches.length > 0 && (
        <>
          <Leaders title="Batters" rows={a.batters} people={people} />
          <Leaders title="Pitchers" rows={a.pitchers} people={people} />
        </>
      )}
      {ask === 'what' && a.matches.length > 0 && (
        <Table label="Results">
          <thead><tr><th>Result</th><th>Times</th><th>Share</th></tr></thead>
          <tbody>{a.outcomes.map((o) => <tr key={o.label}><td>{o.label}</td><td>{o.n}</td><td>{((100 * o.n) / a.matches.length).toFixed(1)}%</td></tr>)}</tbody>
        </Table>
      )}
      {a.matches.length > 0 && (
        <Table label="Matches" sticky>
          <thead><tr><th>Date</th><th>Batter</th><th>Pitcher</th><th>Result</th><th>Inn</th><th>His</th></tr></thead>
          <tbody>
            {a.matches.slice(0, shown).map((m) => (
              <tr key={m.key}>
                <td><a href={gamePath(m.date, m.away, m.home, 'boxscore', m.gameNumber)}>{shortDate(m.date)}</a></td>
                <td><Name id={m.batter} people={people} /></td>
                <td><Name id={m.pitcher} people={people} /></td>
                <td>{resultLabel(m.event)}</td>
                <td>{m.top ? '▲' : '▼'}{m.inning}</td>
                <td>{nth(m.ordinal)} in {m.date.slice(0, 4)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {a.matches.length > shown && (
        <Button size="control" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, a.matches.length - shown)} more · {a.matches.length - shown} left
        </Button>
      )}
    </Stack>
  )
}
