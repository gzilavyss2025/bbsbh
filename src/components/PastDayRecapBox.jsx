import { useEffect, useState } from 'react'
import { computeTopPerformers } from '../api/topPerformers.js'
import { rankDayHighlights } from '../api/dayHighlights.js'
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
import { useNav } from '../lib/nav.js'
import { LinkScope } from '../lib/nav.jsx'
import { SealBox } from './SealBox.jsx'
import { Loader } from './Loader.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// THIN PREVIEW NOTE: this is the live-data preview version of the recap box
// the plan describes — it fans out its own Day Highlights fetch separately
// from computeTopPerformers' fetch rather than sharing one cache-backed fetch
// between the two (that unification is real-implementation work, not this
// preview's job; see the plan's "data layer" phase). The single-seal shape —
// one tap revealing both Top Performers and Day Highlights — is the real
// thing being judged here.

function DayHighlightRow({ entry }) {
  const navigate = useNav()
  return (
    <li className="dayhl__row">
      <button type="button" className="dayhl__rowBtn" onClick={() => navigate(entry.boxScorePath)}>
        {entry.headline}
      </button>
    </li>
  )
}

function PerformerMini({ entry }) {
  return (
    <li className="dayhl__perf">
      <TeamLogo teamId={entry.teamId} name={entry.teamAbbr} size={18} />
      <PlayerLink id={entry.id} className="dayhl__perfName">
        {entry.name}
      </PlayerLink>
      <span className="dayhl__perfStat">{entry.stat}</span>
    </li>
  )
}

function RecapPanel({ games, prospects, dateStr, sportId }) {
  const getSignals = usePastGameSignals()
  const [state, setState] = useState({ loading: true, error: false, data: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: false, data: null })
    Promise.all([
      computeTopPerformers({ games, prospects, dateStr }),
      Promise.all(
        games.map((game) =>
          getSignals(game.gamePk)
            .then(({ feed, winProb }) => ({ gamePk: game.gamePk, game, feed, winProb, dateStr }))
            .catch(() => null),
        ),
      ),
    ])
      .then(([topPerformers, entries]) => {
        if (cancelled) return
        setState({
          loading: false,
          error: false,
          data: { topPerformers, highlights: rankDayHighlights(entries) },
        })
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: true, data: null })
      })
    return () => {
      cancelled = true
    }
  }, [games, prospects, dateStr, getSignals])

  if (state.loading) {
    return <Loader size="inline" message="Crunching this day's games…" />
  }
  if (state.error) {
    return <p className="hint hint--error">Couldn&apos;t load this day&apos;s recap.</p>
  }
  if (!state.data) return null

  const { topPerformers, highlights } = state.data
  const hasPerformers = topPerformers.batters.length > 0 || topPerformers.pitchers.length > 0

  return (
    <LinkScope asOf={dateStr} sportId={sportId}>
      <div className="pastdayrecap__body">
        {hasPerformers && (
          <section className="dayhl__section">
            <h3 className="dayhl__title">Top Performers</h3>
            {topPerformers.batters.length > 0 && (
              <ul className="dayhl__perfList">
                {topPerformers.batters.map((e) => (
                  <PerformerMini key={e.id} entry={e} />
                ))}
              </ul>
            )}
            {topPerformers.pitchers.length > 0 && (
              <ul className="dayhl__perfList">
                {topPerformers.pitchers.map((e) => (
                  <PerformerMini key={e.id} entry={e} />
                ))}
              </ul>
            )}
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
        {!hasPerformers && highlights.length === 0 && (
          <p className="hint hint--prose">Nothing to recap for this day yet.</p>
        )}
      </div>
    </LinkScope>
  )
}

// The past-day replacement for TopPerformersBox: one SealBox, keyed on
// date+level like ADR-0011, whose single reveal renders both Top Performers
// and Day Highlights stacked underneath — one tap, one recap, since both are
// the same "flavor" of sealed daily digest.
export function PastDayRecapBox({ dateStr, sportId, games, prospectsData }) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => setRevealed(false), [dateStr, sportId])

  return (
    <div className="pastdayrecap">
      {!revealed && <h2 className="topperf__banner">Day Recap</h2>}
      <SealBox
        key={`${dateStr}-${sportId}`}
        label="Tap to reveal this day's recap"
        onReveal={() => setRevealed(true)}
      >
        {() => (
          <RecapPanel games={games} prospects={prospectsData} dateStr={dateStr} sportId={sportId} />
        )}
      </SealBox>
    </div>
  )
}
