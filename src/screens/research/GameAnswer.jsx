import { useState } from 'react'
import { ASKS, clubName } from '../../api/research/filters.js'
import { HOW, TOTALS, pitchingSide, totalOf } from '../../api/research/games.js'
import { ordinal as nth } from '../../lib/format.js'
import { labelDate as shortDate } from '../../lib/time/standingsDates.js'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { BoxDate, plural } from './AnswerView.jsx'

// THE GAME-MODE ANSWER (/research, #3137; wireframe v3, Gary 2026-11-17). The sentence
// reads from the picked club's side ("allowed" with a Pitching club). A row is the date
// (the sealed box score, ADR-0101), the game, the totals the query filtered on, and the
// club's ordinal over the searched seasons. Never the final score. `a` is games.js's answer.

const PAGE = 20
const UNITS = { r: ['run', 'runs'], h: ['hit', 'hits'], hr: ['home run', 'home runs'], bb: ['walk', 'walks'], so: ['strikeout', 'strikeouts'], pi: ['pitch', 'pitches'] }
const HOW_LABEL = Object.fromEntries(HOW.map(([k, label]) => [k, label]))

// The filtered totals, in TOTALS order.
const shownTotals = (q) => TOTALS.filter((t) => q.g?.totals?.[t.key])

const GameDate = ({ m }) => <BoxDate m={m}>{shortDate(m.date)}</BoxDate>

// "Milwaukee Brewers allowed 6 runs, all on solo home runs".
function gameLine(q, m) {
  const verb = pitchingSide(q) ? 'allowed' : 'had'
  const totals = shownTotals(q).map((t) => plural(totalOf(m, t.key), ...UNITS[t.key]))
  const how = (q.g?.how ?? []).map((k) => HOW_LABEL[k].toLowerCase()) // caps-js-exempt: mid-sentence clause
  const what = [totals.join(' and ') || null, ...how].filter(Boolean).join(', ')
  return what ? `${clubName(m.club)} ${verb} ${what}` : clubName(m.club)
}

const opponent = (q, m) => (pitchingSide(q) ? m.batTeam : m.fieldTeam)

function Sentence({ ask, q, a }) {
  const n = a.matches.length
  if (!n) return 'No game on file matches.'
  if (ask === 'often') return `${plural(n, 'game', 'games')} of ${a.base.toLocaleString()}`
  if (ask === 'most') return `${clubName(a.clubs[0].club)} lead with ${plural(a.clubs[0].n, 'game', 'games')}`
  const m = a.matches[0]
  return <>{gameLine(q, m)} · <GameDate m={m} /></>
}

function summary(ask, q, a) {
  const n = a.matches.length
  const m = a.matches[0]
  if (ask === 'last') return `vs ${clubName(opponent(q, m))} · ${plural(n, 'game', 'games')}`
  if (ask === 'often' && a.base) {
    const of = q.pitchTeam && q.team ? `${clubName(q.pitchTeam)} v ${clubName(q.team)} ` : q.pitchTeam ?? q.team ? `${clubName(q.pitchTeam ?? q.team)} ` : 'club '
    return `${((100 * n) / a.base).toFixed(2)}% of ${of}games in range`
  }
  return plural(n, 'game', 'games')
}

export function GameAnswerCard({ ask, q, a }) {
  return (
    <Card frame="stamped" label={ASKS.find((x) => x.key === ask)?.label}>
      <Stack gap="tight" aria-live="polite">
        <p className="research__answer"><Sentence ask={ask} q={q} a={a} /></p>
        {a.matches.length > 0 && <p className="research__summary">{summary(ask, q, a)}</p>}
      </Stack>
    </Card>
  )
}

const possessive = (name) => (name.endsWith('s') ? `${name}’` : `${name}’s`)
const ord = (m, since) => `${possessive(clubName(m.club))} ${nth(m.ordinal)}${since ? ` since ${since}` : ''}`
const totalsText = (q, m) => shownTotals(q).map((t) => `${totalOf(m, t.key)} ${t.short}${pitchingSide(q) ? ' allowed' : ''}`).join(' · ')

function Rows({ rows, q, since }) {
  return (
    <ul className="research__rows">
      {rows.map((m) => (
        <li key={m.key} className="research__row">
          <span className="research__date"><GameDate m={m} /></span>
          <span>{m.away} at {m.home}{totalsText(q, m) && <span className="research__result"> · {totalsText(q, m)}</span>}</span>
          <span className="research__ord">{ord(m, since)}</span>
        </li>
      ))}
    </ul>
  )
}

function GameTable({ rows, q, since }) {
  const totals = shownTotals(q)
  return (
    <Table label="Matching games" className="research__table">
      <thead><tr><th>Date</th><th>Game</th>{totals.map((t) => <th key={t.key} className="research__num">{pitchingSide(q) ? t.allowed : t.label}</th>)}<th className="research__num">Club’s</th></tr></thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.key}>
            <td><GameDate m={m} /></td>
            <td>{m.away} at {m.home}</td>
            {totals.map((t) => <td key={t.key} className="research__num">{totalOf(m, t.key)}</td>)}
            <td className="research__num">{ord(m, since)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

// The matches, or for "Who most" the clubs with the most such games.
export function GameMatches({ ask, q, a, wide, since }) {
  const [shown, setShown] = useState(PAGE)
  if (!a.matches.length) return null
  if (ask === 'most') {
    return (
      <Table label="Clubs" className="research__table">
        <thead><tr><th>Club</th><th className="research__num">Games</th></tr></thead>
        <tbody>{a.clubs.map((c) => <tr key={c.club}><td>{clubName(c.club)}</td><td className="research__num">{c.n}</td></tr>)}</tbody>
      </Table>
    )
  }
  const rows = a.matches.slice(0, shown)
  return (
    <Stack>
      {wide ? <GameTable rows={rows} q={q} since={since} /> : <Rows rows={rows} q={q} since={since} />}
      {a.matches.length > shown && (
        <Button size="control" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, a.matches.length - shown)} more · {a.matches.length - shown} left
        </Button>
      )}
    </Stack>
  )
}
