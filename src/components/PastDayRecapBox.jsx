import { useEffect, useState } from 'react'
import { computeTopPerformersByResult } from '../api/topPerformers.js'
import { rankDayHighlights } from '../api/dayHighlights.js'
import { computeDaySuperlatives } from '../api/daySuperlatives.js'
import { fetchCallouts } from '../api/callouts.js'
import { fetchDayRecap, recapForSport } from '../api/dayRecap.js'
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
import { useNav } from '../lib/nav.js'
import { apiDateToUrl } from '../lib/route.js'
import { LinkScope } from '../lib/nav.jsx'
import { SealBox } from './SealBox.jsx'
import { Loader } from './Loader.jsx'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// Final dates normally read one precomputed day-recap artifact. The per-game
// signal path remains as a fallback for dates not yet generated, and shares the
// same cache as a flipped slate card so revealing both never double-fetches a
// gamePk. Top Performers' fallback uses the lighter boxscore endpoint instead.

// "Face the Story": a row shows the winning signal's protagonist (headshot +
// name + team + stat, "baseball card" idiom matching Top Performers/Statcast
// Leaders) when dayHighlights.js resolved one, or falls back to a lighter
// team-logo-pair row for the signals with no single protagonist (margin/
// length storylines, the win-probability comeback) — see dayHighlights.js's
// `performer` field. The box-score link lives on the headline text itself, a
// button, rather than wrapping the whole row: the performer variant also
// needs its own PlayerLink/TeamLink buttons alongside, and HTML disallows
// nesting interactive elements inside a button.
function DayHighlightRow({ entry }) {
  const navigate = useNav()
  const goToBox = () => navigate(entry.boxScorePath)

  if (entry.performer) {
    const { performer } = entry
    return (
      <li className="dayhl__row dayhl__row--performer">
        <span className="dayhl__rowShotwrap">
          <Headshot
            personId={performer.id}
            name={performer.name}
            teamId={performer.teamId}
            className="dayhl__rowShot"
          />
          {performer.position && <span className="playercard__posbadge">{performer.position}</span>}
        </span>
        <div className="dayhl__rowBody">
          <button type="button" className="dayhl__rowHeadlineBtn" onClick={goToBox}>
            {entry.headline}
          </button>
          <div className="dayhl__rowMeta">
            <PlayerLink id={performer.id}>{performer.name}</PlayerLink>
            <TeamLogo teamId={performer.teamId} name={performer.teamAbbr} size={14} />
            <TeamLink id={performer.teamId}>{performer.teamAbbr}</TeamLink>
            {entry.subCaption && <span className="dayhl__rowSub">· {entry.subCaption}</span>}
          </div>
        </div>
      </li>
    )
  }

  const { teams } = entry
  return (
    <li className="dayhl__row">
      <button type="button" className="dayhl__rowBtn dayhl__rowBtn--teams" onClick={goToBox}>
        <span className="dayhl__rowLogos">
          <TeamLogo teamId={teams?.winner?.id} name={teams?.winner?.abbr} size={20} />
          <TeamLogo teamId={teams?.loser?.id} name={teams?.loser?.abbr} size={20} />
        </span>
        <span className="dayhl__rowText">{entry.headline}</span>
      </button>
    </li>
  )
}

// "Tyler Tolbert" -> ["Tyler", "Tolbert"] (everything after the first space).
// Used so the name wraps to two lines next to the bigger headshot, without a
// fixed split table.
function splitFirstLast(full) {
  const i = (full ?? '').indexOf(' ')
  return i === -1 ? [full ?? '', ''] : [full.slice(0, i), full.slice(i + 1)]
}

// One "baseball card" tile: headshot (with position floated on it as a small
// badge, same idiom as the former-teammates cards' .teammatecard__posbadge),
// name (a clickable PlayerLink), team logo + abbreviation, stat line
// underneath.
function PerformerCard({ entry }) {
  const [first, last] = splitFirstLast(entry.name)
  return (
    <li className="playercard">
      <span className="playercard__shotwrap">
        <Headshot personId={entry.id} name={entry.name} teamId={entry.parentOrgId ?? entry.teamId} className="playercard__shot" />
        {entry.position && <span className="playercard__posbadge">{entry.position}</span>}
      </span>
      <div className="playercard__body">
        <div className="playercard__name">
          <PlayerLink id={entry.id}>
            {first} {last && <br className="playercard__namebreak" />}
            {last}
          </PlayerLink>
        </div>
        <div className="playercard__team">
          <TeamLogo teamId={entry.teamId} name={entry.teamAbbr} size={16} />
          <TeamLink id={entry.teamId}>{entry.teamAbbr}</TeamLink>
        </div>
        <div className="playercard__stat">{entry.stat}</div>
      </div>
    </li>
  )
}

function RecapPanel({ games, prospects, dateStr, sportId }) {
  const getSignals = usePastGameSignals()
  const [state, setState] = useState({ loading: true, error: false, data: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: false, data: null })
    ;(async () => {
      const artifact = recapForSport(await fetchDayRecap(dateStr), sportId)
      if (artifact) {
        if (!cancelled) {
          setState({ loading: false, error: false, data: artifact })
        }
        return
      }

      const [performersByResult, entries, calloutsData] = await Promise.all([
        computeTopPerformersByResult({ games, prospects, dateStr }),
        Promise.all(
          games.map((game) =>
            getSignals(game.gamePk)
              .then(({ feed, winProb }) => ({ gamePk: game.gamePk, game, feed, winProb, dateStr }))
              .catch(() => null),
          ),
        ),
        // Same nightly bundle the pre-half strip/play cards read — one fetch
        // for the whole date, cached in-memory by fetchCallouts itself. Feeds
        // Day Highlights' protagonist sub-captions (dayHighlights.js); degrades
        // to {games:{}} on any failure or an un-generated date, same as every
        // other callouts consumer.
        fetchCallouts(apiDateToUrl(dateStr)),
      ])
      if (cancelled) return
        setState({
          loading: false,
          error: false,
          data: {
            performersByResult,
            highlights: rankDayHighlights(entries, calloutsData),
            superlatives: computeDaySuperlatives(entries),
          },
        })
    })().catch(() => {
        if (!cancelled) setState({ loading: false, error: true, data: null })
    })
    return () => {
      cancelled = true
    }
  }, [games, prospects, dateStr, sportId, getSignals])

  if (state.loading) {
    return <Loader size="inline" message="Crunching this day's games…" />
  }
  if (state.error) {
    return <p className="hint hint--error">Couldn&apos;t load this day&apos;s recap.</p>
  }
  if (!state.data) return null

  const { performersByResult, highlights, superlatives } = state.data
  const { winners, losers } = performersByResult
  const hasPerformers = winners.length > 0 || losers.length > 0
  const statcastCards = [
    { label: 'Longest Home Run', entry: superlatives.longestHomeRun },
    { label: 'Hardest Base Hit', entry: superlatives.hardestBaseHit },
    { label: 'Fastest Strikeout', entry: superlatives.fastestStrikeout },
  ].filter((c) => c.entry)

  return (
    <LinkScope asOf={dateStr} sportId={sportId}>
      <div className="pastdayrecap__body">
        {hasPerformers && (
          <section className="dayhl__section">
            <h3 className="dayhl__title">Top Performers</h3>
            {winners.length > 0 && (
              <>
                <h4 className="playercard__bucket">In a Win</h4>
                <ul className="playercard__list">
                  {winners.map((e) => (
                    <PerformerCard key={e.id} entry={e} />
                  ))}
                </ul>
              </>
            )}
            {losers.length > 0 && (
              <>
                <h4 className="playercard__bucket">In a Loss</h4>
                <ul className="playercard__list">
                  {losers.map((e) => (
                    <PerformerCard key={e.id} entry={e} />
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
        {statcastCards.length > 0 && (
          <section className="dayhl__section">
            <h3 className="dayhl__title">Statcast Leaders</h3>
            {statcastCards.map(({ label, entry }) => (
              <div key={label}>
                <h4 className="playercard__bucket">{label}</h4>
                <ul className="playercard__list">
                  <PerformerCard entry={entry} />
                </ul>
              </div>
            ))}
          </section>
        )}
        {highlights.length > 0 && (
          <section className="dayhl__section">
            <h3 className="dayhl__title">Day Highlights</h3>
            <ol className="dayhl__list">
              {highlights.map((h) => (
                <DayHighlightRow key={h.gamePk} entry={h} />
              ))}
            </ol>
          </section>
        )}
        {!hasPerformers && highlights.length === 0 && statcastCards.length === 0 && (
          <p className="hint hint--prose">Nothing to recap for this day yet.</p>
        )}
      </div>
    </LinkScope>
  )
}

// The past-day replacement for TopPerformersBox: one SealBox, keyed on
// date+level like ADR-0011, whose single reveal renders both Top Performers
// (split into Winners/Losers) and Day Highlights stacked underneath — one
// tap, one recap, since both are the same "flavor" of sealed daily digest.
//
// `revealedAll`/`onRevealAll` link this box's own seal to the page-level
// "Reveal all results" control (see PastPreview.jsx): tapping THIS seal also
// flips every game card (via onRevealAll), and tapping the OTHER control
// force-reveals this box too (via `forceRevealed`) — both buttons do the same
// thing. SealBox's onReveal fires either way shown becomes true, whether from
// this box's own tap or an external forceRevealed flip.
export function PastDayRecapBox({ dateStr, sportId, games, prospectsData, revealedAll, onRevealAll }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => setRevealed(false), [dateStr, sportId])
  const shown = revealed || revealedAll

  return (
    <div className="pastdayrecap">
      {!shown && <h2 className="topperf__banner">Day Recap</h2>}
      <SealBox
        key={`${dateStr}-${sportId}`}
        label="Tap to reveal this day's recap"
        forceRevealed={revealedAll}
        onReveal={() => {
          setRevealed(true)
          onRevealAll?.()
        }}
      >
        {() => (
          <RecapPanel games={games} prospects={prospectsData} dateStr={dateStr} sportId={sportId} />
        )}
      </SealBox>
    </div>
  )
}
