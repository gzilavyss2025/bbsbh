import { Fragment } from 'react'
import { ComparisonLedger } from '../../../components/worldseries/cards/scouting/ComparisonLedger.jsx'
import { NO_FIGURE, PairAffix, PairFigure, PairLedger, PairLegend } from '../../../components/ui/table/PairLedger.jsx'
import { Grid } from '../../../components/ui/layout/Grid.jsx'
import { ordinalSuffix } from '../../../lib/format.js'
import { pairLead } from '../../../lib/design/ledger/pairLead.js'

// THE PAIR LEDGER (#2455, Design A): the layout for any two-team analysis table.
// The real PairLedger and the real adapter the World Series home uses, on invented
// figures. No feed, no live data. The rules (when to use it, what it needs) are in
// docs/design-system-pair-ledger.md.
//
// States covered: a rank table (lower is better) with a tie, a missing figure, a
// failed-but-leading rank and a long label; a grouped mixed-unit table with a
// negative figure, a tie and a missing figure; long club names; and sides that are
// not clubs. Check at 390, 740 and 1180 px.
const CLUBS = [147, 119] // The invented figures below belong to no real club.
const LONG_CLUBS = [109, 141]
const BAR = 15

const RANKS = [
  { label: 'Starting pitching', ranks: [4, 9] },
  { label: 'Bullpen workload and recent leverage across the postseason', ranks: [18, 22] }, // leads and fails
  { label: 'Lineup depth', ranks: [8, 8] }, // tie
  { label: 'Late-inning defense', ranks: [null, 12] }, // missing
  { label: 'Baserunning', ranks: [27, 11] }, // the other side leads
]

const MIXED = [
  { group: 'Defense', label: 'Outs above average', digits: 0, vals: [-3, 5], text: (v) => (v < 0 ? `−${-v}` : `+${v}`) },
  { group: 'Defense', label: 'Fielding percentage', digits: 3, vals: [0.9871, 0.9871], text: (v) => v.toFixed(3).replace(/^0/, '') }, // tie
  { group: 'Running', label: 'Sprint speed', digits: 1, vals: [28.4, null], text: (v) => v.toFixed(1), unit: 'ft/s' },
  { group: 'Running', label: 'Stolen-base success', digits: 3, vals: [0.801, 0.774], text: (v) => v.toFixed(3).replace(/^0/, '') },
]

function RankTable({ clubIds, title = 'Rank table' }) {
  return (
    <ComparisonLedger
      title={title}
      note="League ranks · lower is better"
      clubIds={clubIds}
      measureLabel="Rank / 30"
      footer={<PairLegend lead="Better rank" failed={`Outside top ${BAR}`} />}
    >
      {RANKS.map((r) => {
        const lead = pairLead(...r.ranks, { lowerWins: true })
        return (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            {r.ranks.map((rank, i) => (
              <td key={clubIds[i]}>
                {rank == null ? NO_FIGURE : (
                  <PairFigure lead={lead === (i === 0 ? 'a' : 'b')} failed={rank > BAR}>
                    {rank}<PairAffix>{ordinalSuffix(rank)}</PairAffix>
                  </PairFigure>
                )}
              </td>
            ))}
          </tr>
        )
      })}
    </ComparisonLedger>
  )
}

function MixedTable() {
  return (
    <ComparisonLedger
      title="Mixed units"
      note="Defense and running · higher is better"
      clubIds={CLUBS}
      measureLabel="Measure"
      footer={<PairLegend lead="Highlighted figure leads" />}
    >
      {MIXED.map((m, i) => {
        const lead = pairLead(...m.vals, { digits: m.digits })
        return (
          <Fragment key={m.label}>
            {MIXED[i - 1]?.group !== m.group && (
              <tr><th scope="colgroup" colSpan={3}>{m.group}</th></tr>
            )}
            <tr>
              <th scope="row">{m.label}{m.unit && <PairAffix> ({m.unit})</PairAffix>}</th>
              {m.vals.map((v, j) => (
                <td key={j}>{v == null ? NO_FIGURE : <PairFigure lead={lead === (j === 0 ? 'a' : 'b')}>{m.text(v)}</PairFigure>}</td>
              ))}
            </tr>
          </Fragment>
        )
      })}
    </ComparisonLedger>
  )
}

// Sides need not be clubs: any two identities with a label and an optional mark.
function SeasonTable() {
  const sides = [{ key: 's25', label: '2025', kicker: 'Last year' }, { key: 's26', label: '2026', kicker: 'This year' }]
  return (
    <PairLedger
      title="Two seasons"
      note="Team rates · higher is better"
      period="Regular season"
      sides={sides}
      measureLabel="Measure"
      footer={<PairLegend lead="Highlighted figure leads" />}
    >
      {[['Runs per game', [4.4, 4.9], 1], ['Strikeout rate', [0.221, 0.221], 3]].map(([label, v, digits]) => {
        const lead = pairLead(...v, { digits })
        return (
          <tr key={label}>
            <th scope="row">{label}</th>
            {v.map((x, i) => (
              <td key={i}><PairFigure lead={lead === (i === 0 ? 'a' : 'b')}>{digits === 3 ? x.toFixed(3).replace(/^0/, '') : x.toFixed(1)}</PairFigure></td>
            ))}
          </tr>
        )
      })}
    </PairLedger>
  )
}

export function PairLedgerLab() {
  return (
    <Grid min="20rem" gap="loose">
      <RankTable clubIds={CLUBS} />
      <MixedTable />
      <RankTable clubIds={LONG_CLUBS} title="Long club names" />
      <SeasonTable />
    </Grid>
  )
}
