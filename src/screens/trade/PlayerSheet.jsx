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

const DASH = '—'

// Everything about one player the row has no room for: every number, how he
// joined the club and his draft pick (a traded player's opens the trade), his
// contract year by year, retained salary when he is in the deal, and Add or
// Remove. Same .scrim/.sheet contract as the app's other sheets.
export function PlayerSheet({ p, teamId, nextYear, farm, warSeason = null, picked, onToggle, onClose, children = null }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const [trade, setTrade] = useState(false)
  if (trade) return <TradeSheet player={p} toId={teamId} onClose={() => setTrade(false)} />
  const pedigree = pedigreeLine(p.how, p.draft, (id) => (isMlbTeamId(id) ? teamAbbr({ id }) : null))

  return (
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet tradesheet" role="dialog" aria-modal="true" aria-label={p.name}>
          <div className="tradesheet__head">
            <div className="playersheet__id">
              <Headshot personId={p.id} name={p.name} teamId={teamId} isMlb={p.onForty} className="tradecard__face" />
              <div>
                <h2 className="sheet__title"><PlayerLink id={p.id} name={p.name}>{p.name}</PlayerLink></h2>
                <p className="t-label tradecard__meta">
                  {p.pos || DASH}{p.age != null ? ` · ${p.age} yrs` : ''}
                  {p.topRank ? ` · No. ${p.topRank} MLB prospect` : p.orgRank ? ` · No. ${p.orgRank} club prospect` : ''}
                </p>
              </div>
            </div>
            <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
          </div>

          <p className="tradecard__nums playersheet__nums"><Numbers p={p} nextYear={nextYear} farm={farm} warSeason={warSeason} full /></p>

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
  if (!c) return <p className="tradecard__none">No contract on file yet.</p>
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
    <div className="tradecard__detail">
      <p className="tradecard__summary">{summary}</p>
      {years.length > 0 && (
        <table className="tradecard__years">
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
      {ahead.some((x) => x.rough) && <p className="tradecard__facts">~ estimated from service time</p>}
      {status && <p className="tradecard__facts">{status}</p>}
    </div>
  )
}
