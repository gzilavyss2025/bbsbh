import { useState } from 'react'
import { spanCell } from '../../lib/ledger.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Ledger } from './Ledger.jsx'

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
      <h3 className="section__title section__title--bar section__title--aside">
        <span>Career stats</span>
        {canFilter && (
          <button type="button" className="mastheadpill" aria-pressed={mlbOnly} onClick={() => setMlbOnly(!mlbOnly)}>
            <span className="mastheadpill__dot" aria-hidden="true" />
            MLB only
          </button>
        )}
      </h3>
      <Ledger
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
