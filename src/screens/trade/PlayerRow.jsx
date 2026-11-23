import { useState } from 'react'
import { money, salaryText } from '../../lib/trade/deal.js'
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
    const fig = prospect ? null : figText(p, farm, warSeason)
    return (
      <li className={enter ? 'tradedesk__sent tradedesk__row--enter' : 'tradedesk__sent'}>
        <button type="button" className="tradedesk__open" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradedesk__face" />
          <span className="tradedesk__who">
            <span className="tradedesk__name">{p.name}</span>
            <span className="t-label tradedesk__meta">
              {[posText(p), p.age != null ? `${p.age} yrs` : null].filter(Boolean).join(' · ')}
              {p.retainedUsd ? ` · keeps ${money(p.retainedUsd)}` : ''}
            </span>
          </span>
          {/* The same columns and print as the roster rows: salary over years, then the figure. */}
          {prospect ? (
            <ProspectStamp p={p} teamId={teamId} />
          ) : (
            <>
              <span className="tradedesk__money">
                <span className={!p.onForty && p.payUsd == null ? 'tradedesk__salary tradedesk__salary--milb' : 'tradedesk__salary'}>{salaryText(p)}</span>
                <span className="tradedesk__years">{yearsText(p, true)}</span>
              </span>
              <span className="tradedesk__figcol">
                <span className="tradedesk__war">{fig.value}</span>
                {/* No column head here, so the figure keeps a quiet label: "WAR". */}
                <span className="tradedesk__warlabel">{fig.isWar ? 'WAR' : fig.label}</span>
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
  const fig = figText(p, farm, warSeason)
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
            {posText(p) || DASH}{p.age != null ? ` · ${p.age} yrs` : ''}
            {!stamped && (p.topRank ? ` · No. ${p.topRank} MLB` : p.orgRank ? ` · No. ${p.orgRank} org` : '')}
            {rank ? <span className="tradedesk__rank">{ordinal(rank.pct)} · {rank.level}</span> : null}
          </span>
          {p.retainedUsd ? <span className="tradedesk__kept">Keeps {money(p.retainedUsd)}</span> : null}
        </span>
        {/* A ranked prospect with no big-league record: the deal row's stamp, the same rule. */}
        {stamped ? <ProspectStamp p={p} teamId={teamId} /> : (
          <>
            {/* The list head names the columns, so a row prints only what differs:
                the years as a figure, and the label only for a minor-league line. */}
            <span className="tradedesk__money">
              <span className={!p.onForty && p.payUsd == null ? 'tradedesk__salary tradedesk__salary--milb' : 'tradedesk__salary'}>{salaryText(p)}</span>
              <span className="tradedesk__years">{yearsText(p, true)}</span>
            </span>
            <span className="tradedesk__figcol">
              <span className="tradedesk__war">{fig.value}</span>
              {!fig.isWar && <span className="tradedesk__warlabel">{fig.label}</span>}
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


// A pitcher's role (SP/RP/CL, the same one the roster filter uses) in place of a bare "P".
const posText = (p) => (p.pos === 'P' && p.line?.role) || p.pos

// The line under the salary, as the Trade Machine wrote it: "3 Years", how
// long the club holds him (a signed deal's years, or an arbitration or pre-arb
// player's years until free agency). A count past the ledger is estimated from service time.
// `short` is the roster row's form ("4 yrs"), under a list head that names the column.
function yearsText(p, short = false) {
  if (p.control == null || (!p.onForty && !p.contract)) return ''
  const n = p.control
  return short ? `${n} ${n === 1 ? 'yr' : 'yrs'}` : `${n} ${n === 1 ? 'Year' : 'Years'}`
}

// The one figure: WAR for the season war.json holds (this season until the next
// one starts), or a player with no big-league WAR's minor-league line, its level named.
function figText(p, farm, warSeason) {
  const war = warSeason ? `${warSeason} WAR` : 'WAR'
  // A season across levels ("AA · AAA") names the highest, to fit the column.
  const level = farm?.level?.split(' · ').at(-1)
  if (p.war != null) return { value: p.war.toFixed(1), label: war, isWar: true }
  if (farm?.ops) return { value: farm.ops, label: [level, 'OPS'].filter(Boolean).join(' ') }
  if (farm?.era) return { value: farm.era, label: [level, 'ERA'].filter(Boolean).join(' ') }
  return { value: '—', label: war, isWar: true }
}
