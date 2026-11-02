import { useEffect, useState } from 'react'
import { fetchScopeRows } from '../../api/transactions/playerFacts.js'
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

function Club({ teamId, level }) {
  return (
    <span className="factsheet__club">
      <TeamLogo teamId={teamId} size={20} />
      {level && <span className="factsheet__level">{level}</span>}
      <span className="sr-only">{teamAbbr({ id: teamId })}</span>
    </span>
  )
}

export function FactSheet({ people }) {
  const [at, setAt] = useState(0)
  const [scope, setScope] = useState(people[0].facts.rows.length ? 'mlb' : 'milb')
  const [read, setRead] = useState({})
  const { facts, note } = people[Math.min(at, people.length - 1)]
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
  const view = scope === 'mlb' ? { rows: facts.rows, total: facts.careerLine } : read[key]
  const meta = SCOPES.find((s) => s.value === scope)
  const who = <PlayerLink id={facts.id} className="factsheet__name">{facts.name}</PlayerLink>
  return (
    <Card frame="stamped" className="factsheet">
      <div className="factsheet__head">
        <Segmented
          label="Show seasons for"
          value={scope}
          onChange={setScope}
          options={SCOPES.map(({ value, label }) => ({ value, label }))}
        />
        {people.length > 1 ? (
          <Stepper
            label={who}
            prevLabel="Previous player"
            nextLabel="Next player"
            onPrev={() => setAt((i) => i - 1)}
            onNext={() => setAt((i) => i + 1)}
            prevDisabled={at === 0}
            nextDisabled={at === people.length - 1}
            className="factsheet__step"
          />
        ) : (
          who
        )}
      </div>
      {note && <p className="factsheet__note">{note}</p>}
      {!view ? (
        <p className="factsheet__none" aria-busy="true">Loading…</p>
      ) : view.rows.length ? (
        <Ledger
          label={`${facts.name}'s ${meta.label} seasons`}
          leftCols={2}
          head={['Year', 'Team', ...cols.map(([head]) => head)]}
          rows={view.rows.map((r) => ({
            key: `${r.season}-${r.teamId}`,
            cells: [r.season, <Club key="club" teamId={r.teamId} level={r.level} />, ...cols.map(([, get]) => get(r.line))],
          }))}
          total={view.total ? cols.map(([, get]) => get(view.total)) : null}
          totalLabel={meta.total}
        />
      ) : (
        <p className="factsheet__none">{meta.none}</p>
      )}
    </Card>
  )
}
