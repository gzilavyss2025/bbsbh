import { useRef, useState } from 'react'
import { CELL_LABELS } from '../../api/salaries.js'
import { money, contractYears, optionKind, optionStatus } from '../../lib/trade/deal.js'
import { pedigreeLine } from '../../lib/trade/pedigree.js'
import { isMlbTeamId, teamAbbr } from '../../lib/teams.js'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { ModalPortal } from '../../components/ui/ModalPortal.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { Numbers } from './Numbers.jsx'
import { TradeSheet } from './TradeSheet.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { fetchPlayerFacts } from '../../api/transactions/playerFacts.js'
import { FactSheet } from '../../components/transactions/FactSheet.jsx'
import { isoToday } from '../../lib/dates.js'

const DASH = '—'

// Everything about one player the row has no room for: every number, how he
// joined the club and his draft pick (a traded player's opens the trade), his
// contract year by year, retained salary when he is in the deal, and Add or
// Remove. Same .scrim/.sheet contract as the app's other sheets.
export function PlayerSheet({ p, teamId, nextYear, farm, warSeason = null, picked, onToggle, onClose, children = null }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const [trade, setTrade] = useState(false)
  // His seasons, the way the transactions wire's sheet draws them: MLB, Minors
  // and Postseason, each by club with a career total. One read, shared with the wire.
  const today = isoToday()
  const facts = useAsync(() => fetchPlayerFacts(p.id, { season: Number(today.slice(0, 4)), teamId, asOf: today }).catch(() => null), [p.id, teamId, today])
  if (trade) return <TradeSheet player={p} toId={teamId} onClose={() => setTrade(false)} />
  const pedigree = pedigreeLine(p.how, p.draft, (id) => (isMlbTeamId(id) ? teamAbbr({ id }) : null))

  return (
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet tradesheet" role="dialog" aria-modal="true" aria-label={p.name}>
          <div className="tradesheet__head">
            <div className="playersheet__id">
              <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradedesk__face" />
              <div>
                <h2 className="sheet__title"><PlayerLink id={p.id} name={p.name}>{p.name}</PlayerLink></h2>
                <p className="t-label tradedesk__meta">
                  {p.pos || DASH}{p.age != null ? ` · ${p.age} yrs` : ''}
                  {p.topRank ? ` · No. ${p.topRank} MLB prospect` : p.orgRank ? ` · No. ${p.orgRank} club prospect` : ''}
                </p>
              </div>
            </div>
            <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
          </div>

          <p className="tradedesk__nums playersheet__nums"><Numbers p={p} nextYear={nextYear} farm={farm} warSeason={warSeason} full /></p>

          {p.value && <ValueLine v={p.value} nextYear={nextYear} />}

          {facts.data && (
            <div className="playersheet__section">
              <h3 className="t-label">Seasons</h3>
              <FactSheet people={[{ facts: facts.data, note: null }]} />
            </div>
          )}

          {pedigree && (
            <div className="playersheet__section">
              <h3 className="t-label">How he got here</h3>
              <p className="playersheet__pedigree">{pedigree}</p>
              {p.how?.kind === 'trade' && <Button size="control" onClick={() => setTrade(true)}>See the trade</Button>}
            </div>
          )}

          {(p.contract || p.onForty) && (
            <div className="playersheet__section">
              <h3 className="t-label">Contract</h3>
              <ContractDetail c={p.contract} />
            </div>
          )}

          {children && (
            <div className="playersheet__section">
              <h3 className="t-label">Retained salary</h3>
              {children}
            </div>
          )}

          <div className="playersheet__actions">
            <Button skin={picked ? 'ink' : 'outline'} pressed={picked} onClick={() => onToggle(p.id)}>
              {picked ? 'Remove from deal' : 'Add to deal'}
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// What the new club takes on, from next season: the money still owed, when he
// reaches free agency, then one row per year. The season already played, the
// raw Cot's terms and service days are left out. The foot says whether he can
// be sent down (optionStatus).
function ContractDetail({ c }) {
  if (!c) return <p className="tradedesk__none">No contract on file yet.</p>
  const from = (c.cells[0]?.year ?? 0) + 1
  const ahead = contractYears(c, from)
  const free = ahead.find((x) => x.kind === 'free')
  const years = ahead.filter((x) => x.kind !== 'free')
  const owed = years.reduce((t, x) => t + (x.value ?? 0), 0)
  const unpriced = years.some((x) => x.value == null)
  const last = years.at(-1)?.year
  const summary = [
    years.length ? `${owed ? `${money(owed)}${unpriced ? '+' : ''} over` : ''} ${years.length} yr`.trim() : null,
    free ? `free agent in ${free.year}` : last ? `${c.regime === 'signed' ? 'signed' : 'control'} through ${last}` : 'free agent now',
  ].filter(Boolean).join(' · ')
  const status = optionStatus(c.service, c.options)
  return (
    <div className="tradedesk__detail">
      <p className="tradedesk__summary">{summary}</p>
      {years.length > 0 && (
        <table className="tradedesk__years">
          <tbody>
            {years.map((x) => (
              <tr key={x.year}>
                <th scope="row">{x.year}</th>
                <td>{x.rough ? '~' : ''}{x.value != null ? money(x.value) : x.kind === 'arbitration' ? `Arb ${x.code?.slice(1) ?? ''}`.trim() : x.kind === 'preArb' ? 'Pre-arb' : x.kind === 'option' ? (optionKind(c.terms) ?? 'Option') : CELL_LABELS[x.kind] ?? DASH}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {ahead.some((x) => x.rough) && <p className="tradedesk__facts">~ estimated from service time</p>}
      {status && <p className="tradedesk__facts">{status}</p>}
    </div>
  )
}

// What he is worth to a club that gets him (lib/trade/value.js): next
// season's projected WAR and his surplus value over his years of control,
// or a prospect's value by rank.
function ValueLine({ v, nextYear }) {
  const surplus = `${v.surplusUsd < 0 ? '−' : ''}${money(v.surplusUsd)}`
  return (
    <p className="playersheet__value">
      {v.projWar != null && <span><span className="tradedesk__k">{nextYear} proj. WAR</span> {v.projWar.toFixed(1)}</span>}
      <span><span className="tradedesk__k">{v.prospect ? 'Prospect value' : 'Surplus value'}</span> {surplus}</span>
      {v.years.length > 0 && <span><span className="tradedesk__k">Over</span> {v.years.length} {v.years.length === 1 ? 'year' : 'years'}</span>}
    </p>
  )
}
