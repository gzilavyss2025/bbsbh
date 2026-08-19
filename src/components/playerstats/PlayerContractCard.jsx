import { SourceLine } from '../salaries/SourceLine.jsx'
import '../../styles/26b-player-contract.css'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const exactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
function Money({ value }) {
  if (value == null) return '—'
  return <data value={value} title={exactMoney.format(value)}>{money.format(value)}</data>
}

function serviceLabel(service) {
  if (service?.years == null && service?.days == null) return null
  const parts = []
  if (service.years != null) parts.push(`${service.years} yr`)
  if (service.days != null) parts.push(`${service.days} d`)
  return `${service.approximate ? '~' : ''}${parts.join(' ')}`
}

function statusLabel(status) {
  if (typeof status === 'number') return <Money value={status} />
  const arbitration = status?.match(/^A(\d+)$/i)
  if (arbitration) return `Arbitration ${arbitration[1]}`
  if (status === 'FA') return 'Free agent'
  if (status === 'OPT') return 'Option'
  return status
}

export function PlayerContractCard({ contract }) {
  if (!contract) return null
  const service = serviceLabel(contract.service)
  const scorebugFacts = [
    contract.contractTotalUsd != null && { label: 'Guaranteed', value: <Money value={contract.contractTotalUsd} /> },
    contract.aavUsd != null && { label: 'AAV', value: <Money value={contract.aavUsd} /> },
  ].filter(Boolean)
  return (
    <section className="contractcard" aria-labelledby="player-contract-title">
      <div className="contractcard__frame">
        <header className="contractcard__header">
          <div>
            <span className="contractcard__eyebrow">Player compensation</span>
            <h2 id="player-contract-title">Contract</h2>
          </div>
          <span className="contractcard__regime">
            {contract.estimated ? 'Estimated' : contract.regime}
          </span>
        </header>

        <div className={`contractcard__hero${scorebugFacts.length ? '' : ' contractcard__hero--solo'}`}>
          <div className="contractcard__salary">
            <span>{contract.season} salary</span>
            <strong><Money value={contract.salaryUsd} /></strong>
          </div>
          {scorebugFacts.length > 0 && (
            <dl className="contractcard__scorebug">
              {scorebugFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <dl className="contractcard__ticker">
          {service && <div><dt>MLB service</dt><dd>{service}</dd></div>}
          {contract.options && (
            <div><dt>Options left</dt><dd>{contract.options.remaining} of {contract.options.total}</dd></div>
          )}
          {contract.terms && <div><dt>Terms</dt><dd>{contract.terms}</dd></div>}
          {contract.agent && <div><dt>Agent</dt><dd>{contract.agent}</dd></div>}
        </dl>

        {contract.outYears?.length > 0 && (
          <div className="contractcard__control">
            <div className="contractcard__controlhead">
              <h3>Club control</h3>
              <span>Looking ahead</span>
            </div>
            <ol>
              {contract.outYears.map((entry) => (
                <li key={entry.year}>
                  <span>{entry.year}</span>
                  <strong>{statusLabel(entry.cash ?? entry.cbt)}</strong>
                  {entry.cbt != null && entry.cbt !== entry.cash && (
                    <em>Tax {statusLabel(entry.cbt)}</em>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      {/* Cot's and Fever get named HERE too, not only on /salaries and the club
          ledger. This card renders the same figures under the same terms, and
          `fetchPlayerContract` has always attached the shard's `meta` as
          `source` for exactly this purpose — nothing was reading it. */}
      <SourceLine meta={contract.source} note="Pre-arbitration figures are estimates." />
    </section>
  )
}
