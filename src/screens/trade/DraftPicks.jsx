import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'

// A club's Competitive Balance picks, the only MLB draft picks a club may trade
// (docs/trade-draft-picks-research.html). The roster card lists them over the
// players with the same + / −; the deal card lists the ones coming in.
export function DraftPicks({ picks, chosen, onToggle, partner = null, compact = false }) {
  if (!picks.length) return null
  return (
    <div className="tradedesk__picks">
      {!compact && (
        <p className="tradedesk__pickshead">
          <span className="t-label t-label--bold">Draft picks</span>
          <InfoPopover label="Which draft picks can be traded">
            Only Competitive Balance picks (Round A after the first round, Round B after the second) can be
            traded, once, by the club that was given them. A first-rounder moved into Round A as a tax penalty,
            or a pick given for an unsigned pick, cannot be traded; this list does not mark those.
          </InfoPopover>
        </p>
      )}
      <ul className="tradedesk__list">
        {picks.map((pk) => {
          const on = chosen.has(pk.key)
          return (
            <li key={pk.key} className={['tradedesk__row', 'tradedesk__pickrow', on && !compact && 'tradedesk__row--going'].filter(Boolean).join(' ')}>
              <span className="tradedesk__open tradedesk__pick">
                <span className="tradedesk__pickbadge">{pk.round}</span>
                <span className="tradedesk__who">
                  <span className="tradedesk__name">{pk.year} Round {pk.round} pick</span>
                  <span className="t-label tradedesk__meta">Competitive Balance · No. {pk.number} overall</span>
                </span>
              </span>
              {on && !compact && partner ? <span className="tradedesk__going">Being traded to {partner}</span> : null}
              {compact ? (
                <IconButton mark="md" onClick={() => onToggle(pk.key)} label={`Remove the ${pk.year} Round ${pk.round} pick from the deal`}>✕</IconButton>
              ) : (
                <IconButton mark="sm" className={on ? 'tradedesk__pm tradedesk__pm--on' : 'tradedesk__pm'} onClick={() => onToggle(pk.key)}
                  label={on ? `Take the ${pk.year} Round ${pk.round} pick out of the deal` : `Add the ${pk.year} Round ${pk.round} pick to the deal`}>
                  <span className={on ? 'tradedesk__pmglyph tradedesk__pmglyph--minus' : 'tradedesk__pmglyph'} aria-hidden="true" />
                </IconButton>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
