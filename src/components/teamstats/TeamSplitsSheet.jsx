import { useRef } from 'react'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Table } from '../ui/table/Table.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { IconButton } from '../ui/control/IconButton.jsx'
import { Pill } from '../ui/control/Pill.jsx'

// A club's record in every split the standings feed carries, opened by tapping
// its row on /standings. `team.splits` is api/standings.js's teamSplits():
// three sections of { label, record }, each already stripped of splits the
// feed left out. Season W-L only; an open surface, no seal (ADR-0034).
const SECTIONS = [
  ['splits', 'Splits'],
  ['divisions', 'By division'],
  ['leagues', 'By league'],
]

function pctOf(record) {
  const [w, l] = String(record).split('-').map(Number)
  return w + l > 0 ? w / (w + l) : null
}

// Where this club's record in one split ranks among every club on the board,
// by winning percentage. Ties share a rank ("1224"), the standings' own rule.
function rankIn(teams, section, label, record) {
  const mine = pctOf(record)
  if (mine == null) return null
  const pcts = teams
    .map((t) => (t.splits?.[section] ?? []).find((r) => r.label === label))
    .filter(Boolean)
    .map((r) => pctOf(r.record))
    .filter((p) => p != null)
  return { rank: 1 + pcts.filter((p) => p > mine).length, of: pcts.length }
}

// "1st", "2nd", "3rd", "11th": the form ESPN and Baseball-Reference print a
// league rank in, read faster than "1 of 30" with the field size said once,
// in the column head.
function ordinal(n) {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`
}

// Top third green, bottom third red, the rest the plain tag: the same tiers
// and the same rank tag the Team page's WAR rank wears.
function tierClass({ rank, of }) {
  if (rank <= Math.ceil(of / 3)) return ' rank__tag--good'
  if (rank > of - Math.ceil(of / 3)) return ' rank__tag--bad'
  return ''
}

export function TeamSplitsSheet({ team, teams = [], onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const field = teams.length ? teams : [team]

  return (
    <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet splitsheet" role="dialog" aria-modal="true" aria-label={`${team.name} splits`}>
        <div className="gsmodal__head">
          <h2 className="sheet__title splitsheet__title">
            <TeamLogo teamId={team.id} name={team.name} size={22} />
            {team.name}
            <span className="splitsheet__record">
              {team.w}-{team.l}
            </span>
          </h2>
          <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">
            ✕
          </IconButton>
        </div>

        <div className="splitsheet__body">
          {SECTIONS.map(([key, title]) => {
            const rows = team.splits?.[key] ?? []
            if (rows.length === 0) return null
            const places = rows.map((r) => rankIn(field, key, r.label, r.record))
            // The field size, said once: every row of a table ranks among the
            // same clubs, except where the feed gives some clubs no record.
            const sizes = new Set(places.filter(Boolean).map((p) => p.of))
            const head = sizes.size === 1 ? `Rank of ${[...sizes][0]}` : 'Rank'
            return (
              <Table key={key} frame="stamped" label={`${team.name}, ${title}`} className="splitsheet__table">
                <thead>
                  <tr>
                    <th>{title}</th>
                    <th>W-L</th>
                    <th>{head}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const place = places[i]
                    return (
                      <tr key={r.label}>
                        <td>{r.label}</td>
                        <td>{r.record}</td>
                        <td className="splitsheet__rank">
                          {place ? <Pill className={`rank__tag${tierClass(place)}`}>{ordinal(place.rank)}</Pill> : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )
          })}
        </div>
      </div>
    </div>
  )
}
