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

// Where this salary sits among the players he is actually compared to — his
// position's pool, precomputed nightly by scripts/lib/contract-pay-rank.mjs.
//
// Its own line, under the figure it ranks, and no "#" before the number: a rank
// is a fact about the salary, not a decoration on it. Absent for anyone the
// generator could not place — a pool under MIN_POOL, an unresolved position, or
// a shard written before pay ranks existed — because "unranked" and "ranked
// last" are different statements and only one of them is true.
function PayRankLine({ rank }) {
  if (!rank || !Number.isFinite(rank.rank) || !Number.isFinite(rank.of)) return null
  return (
    <span className="contractcard__payrank">
      {rank.tied ? 'Tied ' : ''}
      {rank.rank} of {rank.of}
      <span className="contractcard__payrank-pool"> among {rank.pos}</span>
    </span>
  )
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
            <PayRankLine rank={contract.payRank} />
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
    </section>
  )
}
