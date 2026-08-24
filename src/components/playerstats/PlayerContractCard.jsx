import '../../styles/26b-player-contract.css'
import { contractView } from '../../api/person/contract/view.js'

// WHAT THIS CARD LEADS WITH DEPENDS ON THE PLAYER, and that is the whole
// design. A pre-arbitration player's salary is the least interesting fact about
// his contract — his club sets it, it is near the league minimum, and it says
// nothing about how long the club holds him. So he gets a RUNWAY: the years
// between this season and free agency, one segment each. A signed player's
// money IS the story, so he keeps the broadcast figure and gains a schedule of
// what each season pays. Which reading a record gets, and every sentence under
// it, is decided in src/api/person/contract/view.js — this file only draws it.

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
// last" are different statements and only one of them is true. Absent as well
// for a pre-arbitration player, whose pool is bunched at the minimum: there the
// rank separates nobody, and the view model drops it before this line sees it.
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

function Ticker({ facts }) {
  if (!facts.length) return null
  return (
    <dl className="contractcard__ticker">
      {facts.map((fact) => (
        <div key={fact.key}>
          <dt>{fact.label}</dt>
          <dd>
            {fact.kind === 'money' ? <Money value={fact.value} /> : fact.value}
            {fact.tag && <span className="contractcard__tag">{fact.tag}</span>}
          </dd>
          {fact.caption && <span className="contractcard__factcaption">{fact.caption}</span>}
        </div>
      ))}
    </dl>
  )
}

// The years between this season and the market, one segment each. Consecutive
// years the club prices the same way are one segment, so the strip stays inside
// the column instead of scrolling out of sight.
function Runway({ view, lead = false }) {
  if (view.segments.length < 2) return null
  return (
    <div className={`contractcard__runway${lead ? ' contractcard__runway--lead' : ''}`}>
      <div className="contractcard__controlhead">
        <h3>{view.faYear ? 'Path to free agency' : 'Club control'}</h3>
        {view.controlThrough && <span>Club control through {view.controlThrough}</span>}
      </div>
      <ol className="contractcard__strip">
        {view.segments.map((seg) => (
          <li
            key={seg.key}
            className={`contractcard__seg contractcard__seg--${seg.kind}${seg.current ? ' contractcard__seg--now' : ''}`}
          >
            <span className="contractcard__segyear">{seg.label}</span>
            <strong>{seg.detail ?? '—'}</strong>
            {seg.current && <em>This season</em>}
          </li>
        ))}
      </ol>
    </div>
  )
}

// One bar per season the sheet PRICES, and one flat dashed zone for the years
// it does not. An option year carries no salary until somebody exercises it —
// often only a buyout — so it gets no height at all; a bar there would state a
// number nobody has.
function Schedule({ schedule }) {
  if (!schedule || schedule.bars.length < 2) return null
  const peak = Math.max(...schedule.bars.map((bar) => bar.salaryUsd))
  const openLabel = schedule.openYears.length > 1
    ? `${schedule.openYears[0]}–${schedule.openYears.at(-1)}`
    : schedule.openYears[0]
  return (
    <div className="contractcard__schedule">
      <div className="contractcard__controlhead">
        <h3>Salary schedule</h3>
        <span>Cash by season</span>
      </div>
      <div className="contractcard__bars">
        {schedule.bars.map((bar) => (
          <div key={bar.year} className={`contractcard__bar${bar.current ? ' contractcard__bar--now' : ''}`}>
            <span className="contractcard__barvalue"><Money value={bar.salaryUsd} /></span>
            <div className="contractcard__barwell">
              <div className="contractcard__barfill" style={{ height: `${Math.round((bar.salaryUsd / peak) * 100)}%` }} />
            </div>
            <span className="contractcard__baryear">{bar.year}</span>
          </div>
        ))}
        {schedule.openYears.length > 0 && (
          <div className="contractcard__open">
            <span className="contractcard__barvalue">See terms</span>
            <div className="contractcard__openzone" />
            <span className="contractcard__baryear">{openLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const PILL = {
  preArb: 'Club sets pay',
  arbYear: 'Arbitration',
  signed: 'Signed',
}

// The fallback card's pill still names the sheet's own regime, in words rather
// than in the feed's snake_case.
const PLAIN_PILL = {
  arbitration: 'Arbitration',
  free_agency: 'Free agency',
  pre_arb: 'Club sets pay',
  signed: 'Signed',
}

export function PlayerContractCard({ contract, optioned = false }) {
  if (!contract) return null
  const view = contractView(contract)
  const scorebugFacts = [
    contract.contractTotalUsd != null && { label: 'Guaranteed', value: <Money value={contract.contractTotalUsd} /> },
    contract.aavUsd != null && { label: 'AAV', value: <Money value={contract.aavUsd} /> },
  ].filter(Boolean)
  const showHero = view.regime !== 'preArb'
  const showScorebug = view.regime === 'signed' || view.regime === 'plain'

  return (
    <section className="contractcard" aria-labelledby="player-contract-title">
      <div className="contractcard__frame">
        <header className="contractcard__header">
          <div>
            <span className="contractcard__eyebrow">Player compensation</span>
            <h2 id="player-contract-title">Contract</h2>
          </div>
          <span className="contractcard__regime">
            {PILL[view.regime]
              ?? (contract.estimated ? 'Estimated' : PLAIN_PILL[contract.regime] ?? 'Contract')}
          </span>
        </header>

        {/* A player on the 40-man roster who is pitching or hitting in the
            minors is still paid on his major-league deal when he is up. The
            figure below is that deal, not what he is drawing this week. */}
        {optioned && <p className="contractcard__note">On the 40-man — optioned; MLB salary shown.</p>}

        {showHero && (
          <div className={`contractcard__hero${showScorebug && scorebugFacts.length ? '' : ' contractcard__hero--solo'}${view.regime === 'arbYear' ? ' contractcard__hero--mid' : ''}`}>
            <div className="contractcard__salary">
              <span>{contract.season} salary</span>
              <strong>
                <Money value={contract.salaryUsd} />
                {contract.estimated && <span className="contractcard__tag">Est.</span>}
              </strong>
              <PayRankLine rank={view.payRank} />
            </div>
            {showScorebug && scorebugFacts.length > 0 && (
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
        )}

        {(view.regime === 'preArb' || view.regime === 'arbYear') && (
          <Runway view={view} lead={view.regime === 'preArb'} />
        )}
        {view.regime === 'signed' && <Schedule schedule={view.schedule} />}

        {view.sentence && <p className="contractcard__sentence">{view.sentence}</p>}

        <Ticker facts={view.facts} />

        {view.footnote && <p className="contractcard__foot">{view.footnote}</p>}

        {view.regime === 'plain' && contract.outYears?.length > 0 && (
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
