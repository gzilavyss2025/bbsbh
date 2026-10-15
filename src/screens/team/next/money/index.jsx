import { useEffect, useState } from 'react'
import '../../../../styles/70-contracts-grid.css'
import '../../../../styles/team-next/money.css'
import { commitmentCliff, payrollScale } from '../../../../api/salaries.js'
import { hasSeen, markSeen, viewKey } from '../../../../lib/motion/inViewOnce.js'
import { CommitmentCliff } from '../../../../components/salaries/CommitmentCliff.jsx'
import { ContractGrid, ContractKey } from '../../../../components/salaries/ContractGrid.jsx'
import { SourceLine } from '../../../../components/salaries/SourceLine.jsx'
import { moneyLabel } from '../../../../components/salaries/Money.jsx'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { EmptyState } from '../../../../components/ui/state/EmptyState.jsx'
import { loadContracts } from '../../data/loadContracts.js'
import { useBandData } from '../useBandData.js'
import { MONEY_NOTE, moneyCount, moneyTiles } from './moneyData.js'

// Money: the Contracts tab's cards on stamped frames (#1107, row 6e). Same loader, same
// grid, cliff and source line; only the frames change. Not keyed on `asOf`: a season's book,
// so the note below says the page's date does not move it (ADR-0082). Open surface (ADR-0052).
export default function Money({ team, onReady, onCount }) {
  const contracts = useBandData(() => loadContracts(team.id), [team.id], { onReady, onCount, count: moneyCount })
  // Motion plays once per page visit (docs/motion.md, "The one-shot gate"); a return shows it at rest.
  const seenKey = viewKey(team.id, 'money')
  const [still] = useState(() => hasSeen(seenKey))
  useEffect(() => {
    markSeen(seenKey)
  }, [seenKey])

  const { data } = contracts
  const ledger = data?.ledger
  const cliff = ledger ? commitmentCliff(ledger.totals) : null
  const stamp = (i) => ({ stampIn: !still, style: { '--stamp-delay': `calc(var(--stagger-step) * ${i})` } })

  return (
    <div className={`tnext__money${still ? ' tnext__money--still' : ''}`}>
      <h2 className="tnext__bandhead">Money</h2>
      <AsyncStatus
        loading={contracts.loading}
        error={contracts.error}
        hasData={data != null}
        errorMessage="Couldn’t load the contract ledger. Try again."
      />
      {data && !ledger && <EmptyState>This club’s contract ledger has not been published yet.</EmptyState>}
      {ledger && (
        <>
          <div className="tnext__tiles">
            {moneyTiles(data, moneyLabel).map((t, i) => (
              <StatTile key={t.label} look="band" className="stattile--compact" tone={t.lead ? 'ink' : 'plain'} {...t} {...stamp(i)} />
            ))}
          </div>
          <Card frame="stamped" label="The commitment cliff" count={`${ledger.totals.length} seasons`} className="tnext__cliff" {...stamp(4)}>
            <CommitmentCliff totals={ledger.totals} scale={payrollScale(ledger.totals)} />
            {cliff?.drop > 0 && (
              <p className="tnext__reading">
                The book falls {moneyLabel(cliff.drop)} between {cliff.from} and {cliff.to}.
              </p>
            )}
          </Card>
          <Card frame="stamped" label="Contracts" count={moneyCount(data)} body="flush" className="tnext__grid" {...stamp(5)}>
            <ContractGrid ledger={ledger} />
            <div className="tnext__key">
              <ContractKey />
            </div>
          </Card>
          <SourceLine meta={ledger.meta} note={MONEY_NOTE} />
        </>
      )}
    </div>
  )
}
