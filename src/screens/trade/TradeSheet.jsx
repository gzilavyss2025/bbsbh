import { useRef } from 'react'
import { loadTrade } from '../../api/trade/history.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { teamClubName, isMlbTeamId } from '../../lib/teams.js'
import { ModalPortal } from '../../components/ui/ModalPortal.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'

const DASH = '—'
const club = (id) => (isMlbTeamId(id) ? teamClubName(id) : 'Other club')
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// What else moved in a trade, read from the wire's own sentence: the rows with
// no player carry no type, so "and cash" and "player to be named" are the record.
function extras(description) {
  const out = []
  if (/cash/i.test(description)) out.push('Cash')
  if (/to be named/i.test(description)) out.push('Player to be named later')
  return out
}

// The trade that brought a player to his club, as a two-column ledger: what
// each club got, each player with where he is now and last season's WAR, and
// each side's total. Facts only, no verdict. The wire's sentence closes it as
// the source. Same .scrim/.sheet contract as the app's other sheets: backdrop
// tap, close button or Escape; focus moves in and back.
export function TradeSheet({ player, toId, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const { loading, error, data } = useAsync(() => loadTrade(player.id, player.how, toId), [player.id, toId])
  const title = `How ${player.name} got here`
  const more = data ? extras(data.description) : []

  return (
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet tradesheet" role="dialog" aria-modal="true" aria-label={title}>
          <div className="tradesheet__head">
            <div>
              <h2 className="sheet__title">{title}</h2>
              {data && <p className="t-label tradesheet__date">Trade · {longDate(data.date)}</p>}
            </div>
            <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
          </div>

          {loading && !data && <p className="hint" role="status">Reading the wire…</p>}
          {(error || (!loading && !data)) && <p className="hint">The wire has no record of this trade.</p>}

          {data && (
            <>
              <div className="tradesheet__sides">
                <Side teamId={toId} players={data.got} warSeason={data.warSeason} highlight={player.id} />
                <Swap />
                <Side teamId={data.fromId} players={data.gave} warSeason={data.warSeason} extra={more} />
              </div>
              <p className="tradesheet__source">
                <span className="t-label">From the wire</span> {data.description}
              </p>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}

// A one-stroke arrow in ink, pointing right (or down, rotated by CSS on a phone).
function Arrow({ className = '' }) {
  return (
    <svg className={`tradesheet__arrow ${className}`} viewBox="0 0 32 12" aria-hidden="true">
      <path d="M1 6h28M23 1l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  )
}

// Between the two columns: the exchange, one arrow each way.
function Swap() {
  return (
    <div className="tradesheet__swap" aria-hidden="true">
      <Arrow className="tradesheet__arrow--back" />
      <Arrow />
    </div>
  )
}

function Side({ teamId, players, warSeason, extra = [], highlight = null }) {
  const total = players.reduce((t, p) => t + (p.war ?? 0), 0)
  return (
    <section className="tradesheet__side">
      <header className="tradesheet__club">
        {isMlbTeamId(teamId) && <TeamLogo teamId={teamId} size={36} />}
        <h3 className="t-label t-label--bold">{club(teamId)} got</h3>
      </header>
      <ul className="tradesheet__list">
        {players.map((p) => (
          <li key={p.id} className={p.id === highlight ? 'tradesheet__player tradesheet__player--this' : 'tradesheet__player'}>
            <Headshot personId={p.id} name={p.name} className="tradedesk__face" />
            <div className="tradedesk__who">
              <PlayerLink id={p.id} name={p.name} className="tradedesk__name">{p.name}</PlayerLink>
              <span className="t-label tradedesk__meta">{p.pos ?? DASH} · now {p.active === false ? 'retired or released' : p.nowTeam ?? DASH}</span>
            </div>
            <span className="tradesheet__war">
              <span className="tradedesk__k">{warSeason} WAR</span>
              <span className="tradesheet__num">{p.war != null ? p.war.toFixed(1) : DASH}</span>
            </span>
          </li>
        ))}
        {extra.map((e) => <li key={e} className="tradesheet__extra">+ {e}</li>)}
        {!players.length && !extra.length && <li className="tradesheet__extra">Nobody</li>}
      </ul>
      <p className="tradesheet__total">
        <span className="tradedesk__k">Total {warSeason} WAR</span>
        <span className="tradesheet__num">{total.toFixed(1)}</span>
      </p>
    </section>
  )
}
