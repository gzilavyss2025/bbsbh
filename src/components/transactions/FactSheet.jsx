import { useEffect, useState } from 'react'
import { fetchScopeRows } from '../../api/transactions/playerFacts.js'
import { draftSentence } from '../../api/transactions/templates.js'
import { teamAbbr } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Ledger } from '../player/Ledger.jsx'
import { Segmented } from '../ui/control/Segmented.jsx'
import { Stepper } from '../ui/control/Stepper.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Card } from '../ui/frame/Card.jsx'

// One player's full sheet under a wire move, drawn as the player page's
// Season stats card draws its register: the same switch (MLB, Minors,
// Postseason) over the same Ledger in a stamped card, every season by club
// with its logo, and the total. Clubs are marks, never abbreviations; the
// abbreviation stays for screen readers. MLB comes with the facts; the other
// two views are read the first time one is chosen. The player's name heads the
// card; a story with several players steps between them (‹ name ›), each with
// his note above his table.
const COLUMNS = {
  pitching: [
    ['G', (l) => l.games],
    ['GS', (l) => l.starts],
    ['IP', (l) => l.ip],
    ['ERA', (l) => l.era],
    ['K', (l) => l.k],
    ['WHIP', (l) => l.whip],
  ],
  hitting: [
    ['G', (l) => l.games],
    ['PA', (l) => l.pa],
    ['AVG', (l) => l.avg],
    ['OBP', (l) => l.obp],
    ['SLG', (l) => l.slg],
    ['HR', (l) => l.hr],
    ['RBI', (l) => l.rbi],
  ],
}
const SCOPES = [
  { value: 'mlb', label: 'MLB', total: 'MLB', none: 'Has not reached the majors.' },
  { value: 'milb', label: 'Minors', total: 'MiLB', none: 'No minor-league seasons on file.' },
  { value: 'post', label: 'Postseason', total: 'Postseason', none: 'Has not played in the postseason.' },
]

// A big-league club is its logo; a minor-league stop adds the team's own name
// ("Delmarva Shorebirds"), its level having a column of its own.
function Club({ teamId, name = null }) {
  return (
    <span className="factsheet__club">
      <TeamLogo teamId={teamId} size={20} />
      {name ? <span className="factsheet__teamname">{name}</span> : <span className="sr-only">{teamAbbr({ id: teamId })}</span>}
    </span>
  )
}

// Out of the sentence that named him, the note names him again: "The
// 26-year-old is…" reads "Graham Pauley, the 26-year-old, is…".
function namedNote(note, name) {
  if (!name) return note
  const age = note.match(/^The (\d+)-year-old\b/)
  if (age) return `${name}, the ${age[1]}-year-old,${note.slice(age[0].length)}`
  return note.replace(/^He\b/, name)
}

// The players he was traded for become links (and the desktop hover card).
function linkNames(text, ids) {
  const names = Object.keys(ids ?? {})
  if (!names.length) return text
  const parts = text.split(new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`))
  return parts.map((part, i) => (ids[part] ? <PlayerLink key={i} id={ids[part]}>{part}</PlayerLink> : part))
}

// `warByYear` ({ season: WAR }, optional) adds a WAR column to the MLB view:
// the trade simulator's player sheet passes it; the wire does not. A season
// split between two clubs carries its WAR on its first row only, since the
// figure is the season's, not one club's.
// `frame` is the Card's frame: the wire's stamped card by default; the trade
// simulator's player sheet, already a framed sheet, asks for the flat ledger.
export function FactSheet({ people, warByYear = null, frame = 'stamped' }) {
  const [at, setAt] = useState(0)
  const [scope, setScope] = useState(people[0].facts.rows.length ? 'mlb' : 'milb')
  const [read, setRead] = useState({})
  const { facts, note } = people[Math.min(at, people.length - 1)]
  // Each player opens on his own first view: a prospect who has not reached
  // the majors opens on the minors.
  const step = (i) => {
    setAt(i)
    setScope(people[i].facts.rows.length ? 'mlb' : 'milb')
  }
  const cols = COLUMNS[facts.pitcher ? 'pitching' : 'hitting']
  const key = `${facts.id}|${scope}`
  useEffect(() => {
    if (scope === 'mlb' || read[key]) return undefined
    let live = true
    fetchScopeRows(facts.id, scope, facts.pitcher).then((got) => live && setRead((r) => ({ ...r, [key]: got })))
    return () => {
      live = false
    }
  }, [scope, key, read, facts.id, facts.pitcher])
  // Postseason rows load up front (one cached call), so a player who never
  // played in October gets a dimmed tab instead of an empty table.
  const postKey = `${facts.id}|post`
  useEffect(() => {
    if (read[postKey]) return undefined
    let live = true
    fetchScopeRows(facts.id, 'post', facts.pitcher).then((got) => live && setRead((r) => ({ ...r, [postKey]: got })))
    return () => {
      live = false
    }
  }, [postKey, read, facts.id, facts.pitcher])
  const empty = (value) => scope !== value && (value === 'mlb' ? !facts.rows?.length : value === 'post' ? read[postKey]?.rows?.length === 0 : false)
  const view = scope === 'mlb' ? { rows: facts.rows, total: facts.careerLine } : read[key]
  const meta = SCOPES.find((s) => s.value === scope)
  const milb = scope === 'milb'
  const withWar = scope === 'mlb' && warByYear && Object.keys(warByYear).length > 0
  const warTotal = withWar ? Object.values(warByYear).reduce((t, w) => t + (Number.isFinite(w) ? w : 0), 0).toFixed(1) : null
  // A note that already says where he was drafted keeps its own wording.
  const draft = note && /-round pick|draft pick|drafted/.test(note) ? null : draftSentence(facts)
  const who = <PlayerLink id={facts.id} className="factsheet__name">{facts.name}</PlayerLink>
  return (
    <Card frame={frame} className="factsheet">
      <div className="factsheet__head">
        <Segmented
          label="Show seasons for"
          value={scope}
          onChange={setScope}
          // A scope with no seasons (no big-league games, no postseason) is dimmed.
          options={SCOPES.map(({ value, label }) => ({ value, label, disabled: empty(value) }))}
        />
        {people.length > 1 ? (
          <Stepper
            label={who}
            prevLabel="Previous player"
            nextLabel="Next player"
            onPrev={() => step(at - 1)}
            onNext={() => step(at + 1)}
            prevDisabled={at === 0}
            nextDisabled={at === people.length - 1}
            className="factsheet__step"
          />
        ) : (
          who
        )}
      </div>
      {(note || draft) && <p className="factsheet__note">{linkNames(namedNote([note, draft].filter(Boolean).join(' '), facts.name), facts.tradeIds)}</p>}
      {!view ? (
        <p className="factsheet__none" aria-busy="true">Loading…</p>
      ) : view.rows.length ? (
        <Ledger
          label={`${facts.name}'s ${meta.label} seasons`}
          leftCols={milb ? 3 : 2}
          head={['Year', ...(milb ? ['Lvl'] : []), 'Team', ...cols.map(([head]) => head), ...(withWar ? ['WAR'] : [])]}
          rows={view.rows.map((r, i) => ({
            key: `${r.season}-${r.teamId}`,
            cells: [
              r.season,
              // The level reads down its own column, so a climb shows at a glance.
              ...(milb ? [r.level ?? '—'] : []),
              <Club key="club" teamId={r.teamId} name={milb ? r.teamName : null} />,
              ...cols.map(([, get]) => get(r.line)),
              ...(withWar ? [view.rows.findIndex((x) => x.season === r.season) === i && Number.isFinite(warByYear[r.season]) ? warByYear[r.season].toFixed(1) : ''] : []),
            ],
          }))}
          total={view.total ? [...cols.map(([, get]) => get(view.total)), ...(withWar ? [warTotal] : [])] : null}
          totalLabel={meta.total}
        />
      ) : (
        <p className="factsheet__none">{meta.none}</p>
      )}
    </Card>
  )
}
