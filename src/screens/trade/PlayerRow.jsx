import { useState } from 'react'
import { money } from '../../lib/trade/deal.js'
import { ordinal } from '../../lib/trade/levelPct.js'
import { Button } from '../../components/ui/control/Button.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { PlayerSheet } from './PlayerSheet.jsx'
import { Numbers } from './Numbers.jsx'

const DASH = '—'

// One player on the trade card. The row is one tap target: face, name, the
// attribute line and one line of numbers open the player sheet (contract,
// pedigree, the trade that brought him, retained salary). Add or Remove is the
// row's only other control.
export function PlayerRow({ p, teamId, picked, onToggle, nextYear, farm, warSeason = null, enter = false, rank = null, compact = false, children = null }) {
  const [open, setOpen] = useState(false)
  const sheet = open && (
    <PlayerSheet p={p} teamId={teamId} nextYear={nextYear} farm={farm} warSeason={warSeason} picked={picked} onToggle={onToggle} onClose={() => setOpen(false)}>
      {children}
    </PlayerSheet>
  )
  if (compact) {
    // A player already in the deal: one line of who he is, his WAR as the
    // figure to read, and a small remove. The sheet holds the rest.
    const contract = p.payUsd != null ? money(p.payUsd) : p.payLabel
    return (
      <li className={enter ? 'tradedesk__sent tradedesk__row--enter' : 'tradedesk__sent'}>
        <button type="button" className="tradedesk__open" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradedesk__face" />
          <span className="tradedesk__who">
            <span className="tradedesk__name">{p.name}</span>
            <span className="t-label tradedesk__meta">
              {[p.pos, p.age != null ? `${p.age} yrs` : null, contract, p.thru ? `thru ${p.controlRough ? '~' : ''}${p.thru}` : null].filter(Boolean).join(' · ')}
              {p.retainedUsd ? ` · keeps ${money(p.retainedUsd)}` : ''}
            </span>
          </span>
          <span className="tradedesk__sentwar">
            <span className="tradedesk__k">{warSeason ? `${warSeason} WAR` : 'WAR'}</span>
            <span className="tradedesk__sentfig">{p.war != null ? p.war.toFixed(1) : (farm?.ops ?? farm?.era ?? '—')}</span>
          </span>
        </button>
        <IconButton mark="md" onClick={() => onToggle(p.id)} label={`Remove ${p.name} from the deal`}>✕</IconButton>
        {sheet}
      </li>
    )
  }
  return (
    <li className={enter ? 'tradedesk__row tradedesk__row--enter' : 'tradedesk__row'}>
      <button type="button" className="tradedesk__open" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {/* A prospect off the 40-man has only a minor-league photo: isMlb={false} lets Headshot try that rung. */}
        <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradedesk__face" />
        <span className="tradedesk__who">
          <span className="tradedesk__name">{p.name}</span>
          <span className="t-label tradedesk__meta">
            {p.pos || DASH}{p.age != null ? ` · ${p.age} yrs` : ''}
            {p.topRank ? ` · No. ${p.topRank} MLB prospect` : p.orgRank ? ` · No. ${p.orgRank} club prospect` : ''}
            {rank ? <span className="tradedesk__rank">{ordinal(rank.pct)} · {rank.level}</span> : null}
          </span>
          <span className="tradedesk__nums">
            <Numbers p={p} nextYear={nextYear} farm={farm} warSeason={warSeason} />
          </span>
          {p.retainedUsd ? <span className="tradedesk__kept">Keeps {money(p.retainedUsd)}</span> : null}
        </span>
      </button>
      <Button size="tap" skin={picked ? 'ink' : 'outline'} pressed={picked} onClick={() => onToggle(p.id)}>
        {picked ? 'Remove' : 'Add'}
      </Button>
      {sheet}
    </li>
  )
}
