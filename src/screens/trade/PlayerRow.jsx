import { useState } from 'react'
import { money } from '../../lib/trade/deal.js'
import { ordinal } from '../../lib/format.js'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { PlayerSheet } from './PlayerSheet.jsx'
import { ProspectStamp } from './ProspectStamp.jsx'

const DASH = '—'

// One player on the trade card. The row is one tap target: face, name, the
// attribute line and one line of numbers open the player sheet (contract,
// pedigree, the trade that brought him, retained salary). Add or Remove is the
// row's only other control.
export function PlayerRow({ p, teamId, picked, onToggle, nextYear, farm, warSeason = null, enter = false, rank = null, compact = false, goingTo = null, children = null }) {
  const [open, setOpen] = useState(false)
  const sheet = open && (
    <PlayerSheet p={p} teamId={teamId} nextYear={nextYear} farm={farm} warSeason={warSeason} picked={picked} onToggle={onToggle} onClose={() => setOpen(false)}>
      {children}
    </PlayerSheet>
  )
  if (compact) {
    // A player already in the deal: one line of who he is, his WAR as the
    // figure to read, and a small remove. The sheet holds the rest.
    // The figure to read: WAR, or for a minor leaguer his OPS or ERA, labelled as what it is.
    // A prospect with no big-league record reads as one: his value by rank
    // (value.js) where the salary goes, and his rank where the WAR goes.
    const prospect = p.war == null && (p.topRank || p.orgRank)
    const fig = p.war != null ? { label: warSeason ? `${warSeason} WAR` : 'WAR', value: p.war.toFixed(1) }
      : prospect ? null
      : farm?.ops ? { label: `${farm.level} OPS`, value: farm.ops }
        : farm?.era ? { label: `${farm.level} ERA`, value: farm.era }
            : { label: warSeason ? `${warSeason} WAR` : 'WAR', value: '—' }
    return (
      <li className={enter ? 'tradedesk__sent tradedesk__row--enter' : 'tradedesk__sent'}>
        <button type="button" className="tradedesk__open" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradedesk__face" />
          <span className="tradedesk__who">
            <span className="tradedesk__name">{p.name}</span>
            <span className="t-label tradedesk__meta">
              {[p.pos, p.age != null ? `${p.age} yrs` : null].filter(Boolean).join(' · ')}
              {p.retainedUsd ? ` · keeps ${money(p.retainedUsd)}` : ''}
            </span>
          </span>
          {/* The same columns as the roster rows: salary over years, then the figure over its label. */}
          {prospect ? (
            <ProspectStamp p={p} teamId={teamId} />
          ) : (
            <>
              <span className="tradedesk__money">
                <span className={p.lastSalaryUsd == null && !p.onForty ? 'tradedesk__salary tradedesk__salary--milb' : 'tradedesk__salary'}>{salaryText(p)}</span>
                <span className="tradedesk__years">{yearsText(p)}</span>
              </span>
              <span className="tradedesk__figcol">
                <span className="tradedesk__war">{fig.value}</span>
                <span className="tradedesk__warlabel">{fig.label}</span>
              </span>
            </>
          )}
        </button>
        <IconButton mark="md" onClick={() => onToggle(p.id)} label={`Remove ${p.name} from the deal`}>✕</IconButton>
        {sheet}
      </li>
    )
  }
  const stamped = p.war == null && Boolean(p.topRank || p.orgRank)
  return (
    <li className={['tradedesk__row', enter && 'tradedesk__row--enter', goingTo && 'tradedesk__row--going'].filter(Boolean).join(' ')}>
      <button type="button" className="tradedesk__open" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {/* A prospect off the 40-man has only a minor-league photo: isMlb={false} lets Headshot try that rung. */}
        <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradedesk__face" />
        {/* The Trade Machine's roster line: name over position, salary over
            years, then the one figure (WAR here, PER there). */}
        <span className="tradedesk__who">
          <span className="tradedesk__name">{p.name}</span>
          <span className="t-label tradedesk__meta">
            {p.pos || DASH}{p.age != null ? ` · ${p.age} yrs` : ''}
            {!stamped && (p.topRank ? ` · No. ${p.topRank} MLB` : p.orgRank ? ` · No. ${p.orgRank} org` : '')}
            {rank ? <span className="tradedesk__rank">{ordinal(rank.pct)} · {rank.level}</span> : null}
          </span>
          {p.retainedUsd ? <span className="tradedesk__kept">Keeps {money(p.retainedUsd)}</span> : null}
        </span>
        {/* A ranked prospect with no big-league record: the deal row's stamp, the same rule. */}
        {stamped ? <ProspectStamp p={p} teamId={teamId} /> : (
          <>
            <span className="tradedesk__money">
              <span className={p.lastSalaryUsd == null && !p.onForty ? 'tradedesk__salary tradedesk__salary--milb' : 'tradedesk__salary'}>{salaryText(p)}</span>
              <span className="tradedesk__years">{yearsText(p)}</span>
            </span>
            <span className="tradedesk__figcol">
              <span className="tradedesk__war">{figText(p, farm).value}</span>
              <span className="tradedesk__warlabel">{figText(p, farm).label}</span>
            </span>
          </>
        )}
      </button>
      {/* + and − take less room than words, so the row keeps its figures. */}
      {goingTo ? <span className="tradedesk__going">Being traded to {goingTo}</span> : null}
      <IconButton mark="sm" className={picked ? 'tradedesk__pm tradedesk__pm--on' : 'tradedesk__pm'} onClick={() => onToggle(p.id)}
        label={picked ? `Take ${p.name} out of the deal` : `Add ${p.name} to the deal`}>
        <span className={picked ? 'tradedesk__pmglyph tradedesk__pmglyph--minus' : 'tradedesk__pmglyph'} aria-hidden="true" />
      </IconButton>
      {sheet}
    </li>
  )
}

// The salary column: the last salary he was paid (next season's is often not
// set yet: arbitration, pre-arb), or the minor-league level for a player with
// no big-league contract.
function salaryText(p) {
  if (p.lastSalaryUsd != null) return money(p.lastSalaryUsd)
  // A minor leaguer has no salary on file (MiLB pay is the level minimum, not
  // tracked per player), so the column says so rather than guessing a figure.
  if (!p.onForty) return 'MiLB'
  return '—'
}

// The line under the salary, as the Trade Machine wrote it: "3 Years", how
// long the club holds him (a signed deal's years, or an arbitration or pre-arb
// player's years until free agency). A count past the ledger is estimated from service time.
function yearsText(p) {
  if (p.control == null || (!p.onForty && !p.contract)) return ''
  const n = p.control
  return `${n} ${n === 1 ? 'Year' : 'Years'}`
}

// The one figure: last season's WAR, or a minor leaguer's OPS or ERA.
function figText(p, farm) {
  if (p.war != null) return { value: p.war.toFixed(1), label: 'WAR' }
  if (farm?.ops) return { value: farm.ops, label: 'OPS' }
  if (farm?.era) return { value: farm.era, label: 'ERA' }
  return { value: '—', label: 'WAR' }
}
