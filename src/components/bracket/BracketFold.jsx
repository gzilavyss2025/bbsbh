// The folded view above the slate cards (#1224, slice 5) — Concept B's
// ticket fold, picked look for the phone-width default. One ticket per
// series playing on the cutoff date; the champion band once the World
// Series is decided; a quiet note on an off day. "Open the bracket" reveals
// FullBracket.jsx underneath.
import { useRouteLink } from '../../lib/nav.js'
import { seriesHref } from '../../lib/route.js'
import { recordLine, seriesLine } from '../../api/postseason/text.js'
import { isBoldMoment, isDecidingGame, seriesPlayingToday } from '../../lib/postseason/bracketDisplay.js'
import { humanDate } from '../../lib/dates.js'
import { ClubMark, Pips, Trophy } from './bracketParts.jsx'
import { Door } from '../ui/control/Door.jsx'

function ticketLabel(series, note) {
  const sides = series.slots
    .map((slot) => `${slot.club.abbreviation} ${slot.wins} ${slot.wins === 1 ? 'win' : 'wins'}`)
    .join(', ')
  const line = seriesLine(series, series.cutoffGame.gameNumber)
  return `${line}. ${sides}, best of ${series.bestOf}.${note ? ` ${note}.` : ''}`
}

// A series playing today: the round + game number, both clubs' pips, and —
// the brief's one bold moment — "Winner take all" or "One loss from out".
function SeriesTicket({ series, cutoff, historyIds }) {
  const linkProps = useRouteLink()
  const href = series.id ? seriesHref(series, cutoff, historyIds) : null
  const Wrapper = href ? 'a' : 'div'
  const wrapperProps = href ? linkProps(href) : { role: 'group' }
  const bold = isBoldMoment(series)
  const note = bold ? (isDecidingGame(series) ? 'Winner take all' : 'One loss from out') : null
  return (
    <Wrapper
      className={`pbkt-ticket${bold ? ' pbkt-ticket--bold' : ''}`}
      aria-label={ticketLabel(series, note)}
      {...wrapperProps}
    >
      <span className="pbkt-ticket__head">{seriesLine(series, series.cutoffGame.gameNumber)}</span>
      {series.slots.map((slot, i) => (
        <span key={i} className="pbkt-ticket__row">
          <ClubMark club={slot.club} size={20} />
          <span className="pbkt-ticket__abbr">{slot.club.abbreviation}</span>
          <Pips winsNeeded={series.winsNeeded} wins={slot.wins} />
        </span>
      ))}
      {note && <span className="pbkt-ticket__note">{note}</span>}
    </Wrapper>
  )
}

// A series not playing today and not decided — waiting for its next game,
// or (a swept-early series) for the other half of its round to finish.
function waitingLine(series) {
  const [a, b] = series.slots
  const next = series.upcoming.find((u) => u.date)?.date
  return `${recordLine(series)} in the ${series.name}${next ? ` — next ${humanDate(next)}` : ''} (${a.club.abbreviation} ${a.wins}, ${b.club.abbreviation} ${b.wins})`
}

export function BracketFold({ bracket, cutoff, historyIds, open, onToggle }) {
  const champion = bracket.champion
  const today = seriesPlayingToday(bracket)
  const waiting = bracket.series.filter(
    (s) => !s.decided && !s.playsOnCutoff && s.slots.every((slot) => slot.club),
  )
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
          <p className="pbkt-fold__quiethead">No games today</p>
          {waiting.length > 0 && (
            <ul className="pbkt-fold__waiting">
              {waiting.map((s) => (
                <li key={s.key}>{waitingLine(s)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Door layout="block" className="pbkt-fold__door" onClick={onToggle} aria-expanded={open}>
        {open ? 'Close the bracket' : 'Open the bracket'}
      </Door>
    </section>
  )
}
