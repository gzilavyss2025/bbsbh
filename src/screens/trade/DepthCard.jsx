import { useState } from 'react'
import { depthGrid, thinnest, needBy, LEVELS } from '../../lib/trade/depth.js'
import { teamClubName } from '../../lib/teams.js'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { Button } from '../../components/ui/control/Button.jsx'

const SLOT_LABEL = { C: 'C', '1B': '1B/DH', '2B': '2B', SS: 'SS', '3B': '3B', OF: 'OF', P: 'P' }
const NEEDS = [
  { value: 'count', label: 'Head count' },
  { value: 'war', label: 'WAR' },
  { value: 'starter', label: 'Starter' },
]
const one = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)}`
const VIEWS = [
  { value: 'grid', label: 'Grid' },
  { value: 'ladder', label: 'Ladder' },
]

// A player as the grid reads him: his slot from his position, his level from
// where he plays now. An arrival lands at the level he plays at today.
const asDepth = (p) => ({ id: p.id, name: p.name, pos: p.pos, level: p.levelCode, war: p.war })

// The organization's depth at every position and level, before and after the
// deal, for one club at a time (the reader picks which). OOTP's "team needs"
// read as a grid: what thins, what fills, and the thinnest spots near the
// majors. Two views of the same numbers: Grid (counts) and Ladder (names).
export function DepthCard({ clubs, onClose = null }) {
  const [which, setWhich] = useState(0)
  const [view, setView] = useState('grid')
  const [needMode, setNeedMode] = useState('count')
  const club = clubs[which]
  const other = clubs[1 - which]
  if (!club?.data) return null
  const rows = depthGrid(club.data.depth, { out: club.sends.map(asDepth), inn: other.sends.map(asDepth) })
  const beforeRows = depthGrid(club.data.depth)
  const before = thinnest(beforeRows).map((n) => n.slot)
  const beforeHave = (slot) => {
    const r = beforeRows.find((x) => x.slot === slot)
    return r.cells.MLB.before + r.cells.AAA.before
  }
  const after = thinnest(rows)
  const options = clubs.map((c, i) => ({ value: i, label: teamClubName(c.teamId) }))

  return (
    <Card frame="stamped" label="Organization depth" className="tradecard__depth">
      <div className="tradecard__depthbar">
        {onClose && <Button size="control" skin="ghost" onClick={onClose}>Hide</Button>}
        <Chips label="Club" options={options} value={which} onChange={setWhich} layout="wrap" />
        <Chips label="View" options={VIEWS} value={view} onChange={setView} layout="wrap" />
      </div>

      {view === 'grid' ? <Grid rows={rows} /> : <Ladder rows={rows} />}

      <div className="tradecard__needbar">
        <Chips label="Need by" options={NEEDS} value={needMode} onChange={setNeedMode} layout="wrap" />
      </div>
      <ul className="tradecard__needs" aria-live="polite">
        {needMode === 'count' && after.map((n) => (
          <li key={n.slot} className={before.includes(n.slot) ? '' : 'tradecard__need--new'}>
            <span className="t-label">{SLOT_LABEL[n.slot]}</span> {n.have} in MLB + AAA{beforeHave(n.slot) !== n.have ? ` (was ${beforeHave(n.slot)})` : ''}
          </li>
        ))}
        {needMode === 'war' && needBy(rows, 'war').map((n) => (
          <li key={n.slot}>
            <span className="t-label">{SLOT_LABEL[n.slot]}</span> {n.war.toFixed(1)} WAR in MLB + AAA
            {Math.abs(n.change) >= 0.05 && <span className={n.change < 0 ? 'tradecard__out' : 'tradecard__in'}> ({one(n.change)})</span>}
          </li>
        ))}
        {needMode === 'starter' && needBy(rows, 'starter').map((n) => (
          <li key={n.slot} className={n.starter ? '' : 'tradecard__need--new'}>
            <span className="t-label">{SLOT_LABEL[n.slot]}</span>{' '}
            {n.starter ? `${n.best.name}, ${n.best.war.toFixed(1)}` : n.best ? `No starter · best is ${n.best.name}, ${(n.best.war ?? 0).toFixed(1)}` : 'Nobody near the majors'}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Grid({ rows }) {
  return (
    <div className="tradecard__gridwrap">
      <table className="tradecard__grid">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Position</span></th>
            {LEVELS.map((l) => <th key={l} scope="col">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slot}>
              <th scope="row">{SLOT_LABEL[r.slot]}</th>
              {LEVELS.map((l) => {
                const c = r.cells[l]
                const moved = c.after !== c.before
                const tone = c.after > c.before ? 'up' : c.after < c.before ? 'down' : ''
                return (
                  // The key carries the count, so a change remounts the cell and its tick plays.
                  <td key={`${l}-${c.after}`} className={moved ? `tradecard__cell tradecard__cell--${tone}` : 'tradecard__cell'}>
                    {moved && <span className="tradecard__was">{c.before}<span aria-hidden="true"> → </span><span className="sr-only"> before, now </span></span>}
                    <span className={c.after ? '' : 'tradecard__zero'}>{c.after}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const SHOWN = 3

function Ladder({ rows }) {
  return (
    <ol className="tradecard__ladder">
      {rows.map((r) => (
        <li key={r.slot} className="tradecard__rung">
          <span className="t-label tradecard__rungslot">{SLOT_LABEL[r.slot]}</span>
          <div className="tradecard__rungrow">
            {LEVELS.filter((l) => r.cells[l].after || r.cells[l].out.length).map((l) => {
              const c = r.cells[l]
              const extra = c.stay.length - SHOWN
              return (
                <p key={l} className="tradecard__rungcell">
                  <span className="tradecard__k">{l}</span>{' '}
                  {c.in.map((p) => <span key={p.id} className="tradecard__in">+ {p.name}</span>)}
                  {c.out.map((p) => <s key={p.id} className="tradecard__out">{p.name}</s>)}
                  {c.stay.slice(0, SHOWN).map((p) => <span key={p.id}>{p.name}</span>)}
                  {extra > 0 && <span className="tradecard__more">+{extra} more</span>}
                </p>
              )
            })}
          </div>
        </li>
      ))}
    </ol>
  )
}
