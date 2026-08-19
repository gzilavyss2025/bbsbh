import '../../styles/70-contracts-grid.css'
import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate, AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { commitmentCliff, payrollScale } from '../../api/salaries.js'
import { CommitmentCliff } from '../../components/salaries/CommitmentCliff.jsx'
import { ContractGrid, ContractKey } from '../../components/salaries/ContractGrid.jsx'
import { SourceLine } from '../../components/salaries/SourceLine.jsx'
import { moneyLabel } from '../../components/salaries/Money.jsx'
import { ordinal } from '../../lib/format.js'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadContracts } from './data/loadContracts.js'
import { hiddenTeamTabs } from './data/shared.js'

// The club's book: what it owes, to whom, and for how long — players down the
// page, seasons across it. Its own tab rather than a card on Numbers, because a
// ledger that has to be scrolled sideways needs the width, and because money is
// a different question from performance.
//
// NOT SEALED, and that is the scope half of the spoiler rule rather than an
// exception to it: a salary is season-long identity context, the same class of
// fact as a stat line or a standings row (ADR-0034). Nothing on this page reads
// a linescore.
function Tile({ label, value, note, tone }) {
  return (
    <div className={`ctr__tile${tone ? ` ctr__tile--${tone}` : ''}`}>
      <span className="ctr__tilelabel">{label}</span>
      <span className="ctr__tilevalue">{value}</span>
      {note && <span className="ctr__tilenote">{note}</span>}
    </div>
  )
}

export function ContractsTab({ id, asOf, sportId }) {
  const teamId = Number(id)
  const identity = useAsync(() => loadTeamIdentity(teamId, asOf), [teamId, asOf])
  // Deliberately not keyed on `asOf`: a contract ledger is a season's book, not
  // a day's standing, so a dated visit shows the same figures a live one does.
  const contracts = useAsync(() => loadContracts(teamId), [teamId])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: identity.loading,
    error: identity.error,
    data: identity.data,
    screenClass: 'team-hub',
    noun: 'team',
    onBack: back,
  })
  if (gate) return gate

  const { team, record, manager } = identity.data
  const data = contracts.data
  const ledger = data?.ledger
  const cliff = ledger ? commitmentCliff(ledger.totals) : null

  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="contracts"
      hiddenTabs={hiddenTeamTabs(team)}
    >
      <AsyncStatus
        loading={contracts.loading}
        error={contracts.error}
        hasData={data != null}
        errorMessage="Couldn’t load the contract ledger. Try again."
      />

      {data?.isMilb && (
        <p className="hint">
          Contract terms are published for the major leagues only, so this club has no ledger.
        </p>
      )}

      {data && !data.isMilb && !ledger && (
        <p className="hint">This club’s contract ledger has not been published yet.</p>
      )}

      {ledger && (
        <section className="ctr">
          <div className="ctr__wall">
            <Tile
              label={`${ledger.season} payroll`}
              value={moneyLabel(ledger.payroll)}
              note={
                data.standing
                  ? `${ordinal(data.standing.rank)} of ${data.clubCount}`
                  : `${ledger.totals[0]?.players ?? 0} players`
              }
            />
            <Tile
              label={`Committed after ${ledger.season}`}
              value={moneyLabel(ledger.committedAfter)}
              note={`Through ${ledger.years[ledger.years.length - 1]}`}
            />
            <Tile
              label="Option years"
              value={String(ledger.counts.option)}
              note="Not yet exercised"
              tone={ledger.counts.option > 0 ? null : 'good'}
            />
            <Tile
              label="Arbitration years"
              value={String(ledger.counts.arbitration)}
              note="Figure not yet set"
            />
          </div>

          <CommitmentCliff totals={ledger.totals} scale={payrollScale(ledger.totals)} />

          <ContractGrid ledger={ledger} />
          <ContractKey />

          {cliff && cliff.drop > 0 && (
            <p className="hint">
              The book falls {moneyLabel(cliff.drop)} between {cliff.from} and {cliff.to}.
            </p>
          )}

          <SourceLine
            meta={ledger.meta}
            note="Pre-arbitration figures are estimates."
          />
        </section>
      )}
    </TeamHubShell>
  )
}
