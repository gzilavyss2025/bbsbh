// The folded view above the slate cards (#1224, slice 5) — Concept B's
// ticket fold, picked look for the phone-width default. One ticket per
// series playing on the cutoff date; the champion band once the World
// Series is decided; a quiet note on an off day. "Open the bracket" reveals
// FullBracket.jsx underneath.
import { useRouteLink } from '../../lib/nav.js'
import { seriesHref } from '../../lib/route.js'
import { recordLine, roundLine } from '../../api/postseason/text.js'
import { seriesPlayingToday } from '../../lib/postseason/bracketDisplay.js'
import { ClubMark, Pips, Trophy } from './bracketParts.jsx'
import { Door } from '../ui/control/Door.jsx'

function ticketLabel(series) {
  const sides = series.slots
    .map((slot) => `${slot.club.abbreviation} ${slot.wins} ${slot.wins === 1 ? 'win' : 'wins'}`)
    .join(', ')
  return `${roundLine(series)}. ${sides}.`
}

// A series playing today: the round and its length, and both clubs' pips.
function SeriesTicket({ series, cutoff, historyIds }) {
  const linkProps = useRouteLink()
  const href = series.id ? seriesHref(series, cutoff, historyIds) : null
  const Wrapper = href ? 'a' : 'div'
  const wrapperProps = href ? linkProps(href) : { role: 'group' }
  return (
    <Wrapper className="pbkt-ticket" aria-label={ticketLabel(series)} {...wrapperProps}>
      <span className="pbkt-ticket__head">{roundLine(series)}</span>
      {series.slots.map((slot, i) => (
        <span key={i} className="pbkt-ticket__row">
          <ClubMark club={slot.club} size={20} />
          <span className="pbkt-ticket__abbr">{slot.club.abbreviation}</span>
          <Pips winsNeeded={series.winsNeeded} wins={slot.wins} />
        </span>
      ))}
    </Wrapper>
  )
}

export function BracketFold({ bracket, cutoff, slateDate = null, historyIds, open, onToggle, showDoor = true }) {
  const champion = bracket.champion
  const today = seriesPlayingToday(bracket, slateDate)
  // A slate day after today: the bracket is still today's (its cutoff never
  // passes today), and the words say so.
  const ahead = Boolean(slateDate && cutoff && slateDate > cutoff)
  return (
    <section className="pbkt-fold" aria-label="Postseason bracket">
      {champion ? (
        <div className="pbkt-fold__champ">
          <ClubMark club={champion} size={48} />
          <div className="pbkt-fold__champtext">
            <span className="pbkt-fold__champname">{champion.name}</span>
            <span className="pbkt-fold__champsub">
              World Series champions · {recordLine(bracket.worldSeries)}
            </span>
          </div>
          <Trophy size={56} />
        </div>
      ) : today.length > 0 ? (
        <ul className="pbkt-fold__tickets">
          {today.map((s) => (
            <li key={s.key}>
              <SeriesTicket series={s} cutoff={cutoff} historyIds={historyIds} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="pbkt-fold__quiet">
          {/* Gary, 2026-09-28: the words stay short, and the full bracket
              opens by itself below (PostseasonBracket.jsx). */}
          <p className="pbkt-fold__quiethead">{ahead ? 'The bracket as of today' : 'No games today'}</p>
        </div>
      )}
      {showDoor && (
        <Door layout="block" className="pbkt-fold__door" onClick={onToggle} aria-expanded={open}>
          {open ? 'Close the bracket' : 'Open the bracket'}
        </Door>
      )}
    </section>
  )
}
