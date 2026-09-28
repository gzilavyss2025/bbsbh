// The full bracket behind "Open the bracket" (#1224, slice 5) — Concept D's
// picked look for it, Concept A's "back page": each league's Wild Card ->
// Division -> Championship tree, boxes and connector lines, the World
// Series centered below both. Every value comes from
// src/api/postseason/bracket.js's derived shape (docs/api/postseason.md);
// this file draws it and reads no feed of its own.
import { useRouteLink } from '../../lib/nav.js'
import { seriesHref } from '../../lib/route.js'
import { recordLine } from '../../api/postseason/text.js'
import { feederSeries, isBoldMoment, isDecidingGame } from '../../lib/postseason/bracketDisplay.js'
import { BlankSlot, ClubMark, Pips, Trophy } from './bracketParts.jsx'
import { SectionMasthead } from '../ui/SectionMasthead.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

function ClubRow({ slot, series, bracket }) {
  if (!slot.club) {
    const feeder = feederSeries(bracket, slot.from)
    // `feeder.label` ("NLDS 'A'") tells two same-round feeders apart; `name`
    // alone ("NL Division Series") would name both of a league's feeders
    // identically. Display only — nothing here wires by it (docs/api/postseason.md).
    const label = feeder ? `Winner of ${feeder.label || feeder.name}, to come` : 'To come'
    return (
      <span className="pbkt-row pbkt-row--empty">
        <ClubMark club={null} size={16} />
        <BlankSlot label={label} />
      </span>
    )
  }
  const isOut = series.eliminated?.id === slot.club.id
  return (
    <span className={`pbkt-row${isOut ? ' pbkt-row--out' : ''}`}>
      <ClubMark club={slot.club} eliminated={isOut} size={16} />
      <span className="pbkt-row__abbr">{slot.club.abbreviation}</span>
      <Pips winsNeeded={series.winsNeeded} wins={slot.wins} />
    </span>
  )
}

// The brief's one bold moment, or the plain "Today · Game N" note, for a
// series playing on the cutoff date — null otherwise.
function noteFor(series) {
  if (!series.playsOnCutoff) return null
  if (isBoldMoment(series)) return isDecidingGame(series) ? 'Winner take all' : 'One loss from out'
  return `Today · Game ${series.cutoffGame.gameNumber}`
}

// The whole box's screen-reader label — the round, each club's pips (the
// brief's "Cubs 1 win, Brewers 0, best of 3"), and the note, all in one
// string. `aria-label` on the wrapper replaces its visible content for
// assistive tech, so the note has to be folded in here rather than left as a
// sibling that would otherwise go unheard.
function seriesLabel(series, note) {
  const sides = series.slots
    .map((slot) => (slot.club ? `${slot.club.name} ${slot.wins} ${slot.wins === 1 ? 'win' : 'wins'}` : 'to come'))
    .join(', ')
  const tail = note ? ` ${note}.` : ''
  return `${series.name}. ${sides}, best of ${series.bestOf}.${tail}`
}

// One series box: two club rows and, playing today, a note — "Today · Game
// N", or the brief's one bold moment ("Winner take all" / "One loss from
// out"). A decided series shrinks to a one-line finished strip instead
// (ADR-0087's theme: ink goes over the pencil once a series is settled).
function SeriesBox({ series, bracket, cutoff, historyIds }) {
  const linkProps = useRouteLink()
  const href = series.id ? seriesHref(series, cutoff, historyIds) : null
  const Wrapper = href ? 'a' : 'div'
  const wrapperProps = href ? linkProps(href) : { role: 'group' }

  if (series.decided) {
    return (
      <Wrapper className="pbkt-box pbkt-box--compact" aria-label={recordLine(series)} {...wrapperProps}>
        <span className="pbkt-box__done">{recordLine(series)}</span>
      </Wrapper>
    )
  }

  const note = noteFor(series)
  return (
    <Wrapper
      className={`pbkt-box${isBoldMoment(series) ? ' pbkt-box--bold' : ''}`}
      aria-label={seriesLabel(series, note)}
      {...wrapperProps}
    >
      {series.slots.map((slot, i) => (
        <ClubRow key={i} slot={slot} series={series} bracket={bracket} />
      ))}
      {note && <span className="pbkt-box__note">{note}</span>}
    </Wrapper>
  )
}

// One league's tree: Wild Card and Division side by side (a lane per
// Division series, fed by whichever Wild Card series names it — never by
// slot position), the Championship Series centered against both lanes.
function LeagueBracket({ league, leagueId, name, bracket, cutoff, historyIds }) {
  const { wildcard, division, lcs, byes } = league
  const wcFor = (ds) => wildcard.find((w) => w.feeds === ds.key) ?? null
  return (
    <section className="pbkt-league" aria-label={name}>
      <SectionMasthead
        title={name}
        as="h3"
        logo={<TeamLogo teamId={leagueId} name={name} variant="mono" crop="bar" className="sectionhead__mark" />}
      />
      {byes.length > 0 && (
        <p className="pbkt-byes">
          Bye: {byes.map((c) => c.abbreviation).join(', ')}
        </p>
      )}
      <div className="pbkt-grid">
        {division.map((ds) => {
          const wc = wcFor(ds)
          return (
            <div className="pbkt-lane" key={ds.key}>
              {wc && (
                <div className="pbkt-cell pbkt-cell--wc">
                  <SeriesBox series={wc} bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
                </div>
              )}
              <div className="pbkt-cell pbkt-cell--ds">
                <SeriesBox series={ds} bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
              </div>
            </div>
          )
        })}
        {lcs && (
          <div className="pbkt-cell pbkt-cell--lcs">
            <SeriesBox series={lcs} bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
          </div>
        )}
      </div>
    </section>
  )
}

// The World Series taps through like any other series (seriesHref), but it
// is always drawn full — never the finished rounds' compact strip — since
// it's the one band that also carries the champion treatment.
function WorldSeriesBand({ bracket, cutoff, historyIds }) {
  const linkProps = useRouteLink()
  const ws = bracket.worldSeries
  if (!ws) return null
  const champion = bracket.champion
  const note = champion ? null : noteFor(ws)
  const href = ws.id ? seriesHref(ws, cutoff, historyIds) : null
  const Wrapper = href ? 'a' : 'div'
  const wrapperProps = href ? linkProps(href) : { role: 'group' }
  return (
    <Wrapper
      className={`pbkt-ws${champion ? ' pbkt-ws--champ' : ''}${isBoldMoment(ws) ? ' pbkt-ws--bold' : ''}`}
      aria-label={seriesLabel(ws, champion ? recordLine(ws) : note)}
      {...wrapperProps}
    >
      <div className="pbkt-ws__head">
        <div>
          <h3 className="pbkt-ws__name">{champion ? champion.name : 'World Series'}</h3>
          <span className="pbkt-ws__sub">
            {champion ? `World Series champions · won it in ${ws.gamesPlayed}` : 'Best of 7'}
          </span>
        </div>
        <Trophy size={champion ? 56 : 40} />
      </div>
      <div className="pbkt-ws__rows">
        {ws.slots.map((slot, i) => (
          <ClubRow key={i} slot={slot} series={ws} bracket={bracket} />
        ))}
      </div>
      {note && <p className="pbkt-box__note">{note}</p>}
    </Wrapper>
  )
}

export function FullBracket({ bracket, cutoff, historyIds }) {
  return (
    <div className="pbkt-full">
      <LeagueBracket league={bracket.leagues.AL} leagueId={159} name="American League" bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
      <LeagueBracket league={bracket.leagues.NL} leagueId={160} name="National League" bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
      <WorldSeriesBand bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
    </div>
  )
}
