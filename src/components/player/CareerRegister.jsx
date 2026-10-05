import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { loadPostseasonRegister } from '../../api/player/postseasonRegister.js'
import { spanCell } from '../../lib/ledger.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Ledger } from './Ledger.jsx'
import { Pill } from '../ui/control/Pill.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'

const DASH = '—'
const NARROW_HIDE_COLS = new Set(['GS', 'K', 'BB'])

// The unified MLB + MiLB career table (see api/person/careerRegister.js). MLB
// rows are inked and MiLB rows carry level pills. A same-level multi-team
// season gets an N TM subtotal after that season's chronological stints;
// MLB and MiLB career totals remain separate in the footer.
export function CareerRegister({ register }) {
  const { columns, rows, totals } = register
  // A big leaguer with a long option/rehab history can hide the penciled MiLB
  // rows and their career footer. For a prospect, those rows are the register,
  // so the filter is offered only when both tiers exist.
  const [mlbOnly, setMlbOnly] = useState(false)
  const canFilter = rows.some((r) => r.tier === 'mlb') && rows.some((r) => r.tier === 'milb')
  const keep = (r) => !(mlbOnly && canFilter) || r.tier !== 'milb'
  const hideNarrow = columns
    .map((column, index) => (NARROW_HIDE_COLS.has(column) ? index + 2 : -1))
    .filter((index) => index >= 0)

  const ledgerRows = rows.filter(keep).map((row) => ({
    key: row.key,
    className: [
      row.tier === 'mlb' ? 'reg-mlb' : row.tier === 'gap' ? 'reg-gap' : 'reg-milb',
      row.subtotal && 'reg-subtotal',
    ].filter(Boolean).join(' '),
    allStar: row.allStar,
    cells: row.gap
      ? [
          <>{row.year}</>,
          spanCell(<span className="reg-gap__note">{row.note}</span>),
        ]
      : [
          <>
            {row.year}
            {row.allStar && <span className="ledger__allstar" title="All Star">★</span>}
          </>,
          <>
            {row.team || DASH}
            {row.pill && (
              <span className={`reg-pill${row.pillTeamId ? ' reg-pill--marked' : ''}`}>
                {row.pillTeamId && (
                  <TeamLogo
                    teamId={row.pillTeamId}
                    name={row.team}
                    size={16}
                    className="reg-pill__logo"
                  />
                )}
                {row.pill}
              </span>
            )}
          </>,
          ...row.cells,
        ],
  }))

  return (
    <>
      <SectionHead
        look="band"
        club
        bleed
        action={
          canFilter && (
            <Pill role="control" fill="paper" className="mastheadpill" pressed={mlbOnly} onClick={() => setMlbOnly(!mlbOnly)}>
              <span className="mastheadpill__dot" aria-hidden="true" />
              MLB only
            </Pill>
          )
        }
      >
        Career stats
      </SectionHead>
      <Ledger
        label="Career stats"
        leftCols={2}
        head={['Year', 'Team', ...columns]}
        rows={ledgerRows}
        hideNarrow={hideNarrow}
        totals={totals.filter(keep).map((total) => ({
          label: total.label,
          cells: total.cells,
          className: total.tier === 'mlb' ? 'reg-mlb' : 'reg-milb',
        }))}
      />
    </>
  )
}

// The register's October half: one row per postseason year, then the career line.
// A sibling export rather than a file of its own, because it is the same table
// over the same columns and this folder is at its file budget. It fetches for
// itself and draws nothing until it has a row, so a player who never reached
// October (or has not debuted) has no card and no empty heading. `showSaves` is
// the closer test, so a closer's two tables read alike.
export function PostseasonRegister({ personId, group, hasDebuted, asOf, showSaves }) {
  const { data } = useAsync(
    () => loadPostseasonRegister(personId, group, { hasDebuted, asOf, showSaves }),
    [personId, group, hasDebuted, asOf, showSaves],
  )
  if (!data) return null
  const { columns, rows, totals } = data
  const hideNarrow = columns
    .map((column, index) => (NARROW_HIDE_COLS.has(column) ? index + 2 : -1))
    .filter((index) => index >= 0)
  return (
    <>
      <SectionHead look="band" club bleed>
        Postseason stats
      </SectionHead>
      <Ledger
        label="Postseason stats"
        leftCols={2}
        head={['Year', 'Team', ...columns]}
        rows={rows.map((row) => ({
          key: row.key,
          className: 'reg-mlb',
          cells: [<>{row.year}</>, <>{row.team || DASH}</>, ...row.cells],
        }))}
        hideNarrow={hideNarrow}
        totals={totals.map((total) => ({ label: total.label, cells: total.cells, className: 'reg-mlb' }))}
      />
    </>
  )
}
