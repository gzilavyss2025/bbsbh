import { useEffect, useState } from 'react'
import { computeTopPerformers } from '../api/topPerformers.js'
import { fetchDayRecap, recapForSport } from '../api/dayRecap.js'
import { useAsync } from '../hooks/useAsync.js'
import { LinkScope } from '../lib/nav.jsx'
import { SealBox } from './SealBox.jsx'
import { PerformerCard } from './PastDayRecapBox.jsx'
import { Loader } from './Loader.jsx'

// The slate's hidden "kraft box": the day's top 5 batters and top 5 pitchers
// by win-probability added, across every in-progress/final game at the
// current level. Score-revealing (see src/api/topPerformers.js), so the whole
// thing — including the fact it has anything to show — sits behind a SealBox,
// keyed on date+level so switching either reseals it (same remount-to-reseal
// pattern InningViewer uses for its own SealBoxes). Renders the same
// .playercard tile (PerformerCard, src/components/PastDayRecapBox.jsx) as the
// past-day recap's Winners/Losers and the box score's Insights card, so all
// three "baseball card" surfaces stay one idiom rather than drifting apart.

// Mounted only after reveal → the artifact read starts on reveal, never before.
// Older dates without an artifact retain the original on-demand fallback.
function TopPerformersPanel({ games, prospects, dateStr, sportId }) {
  const load = async () => {
    const recap = recapForSport(await fetchDayRecap(dateStr), sportId)
    if (recap?.topPerformers) return recap.topPerformers
    return computeTopPerformers({ games, prospects, dateStr })
  }
  const { loading, error, data, reload } = useAsync(
    load,
    [games, prospects, dateStr, sportId],
  )

  if (loading) {
    return (
      <Loader
        size="inline"
        message="Crunching win probability across this day’s games…"
      />
    )
  }
  if (error) {
    return (
      <div className="topperf__state">
        <p className="hint hint--error">Couldn&apos;t load today&apos;s top performers.</p>
        <button type="button" className="btn" onClick={reload}>
          Retry
        </button>
      </div>
    )
  }
  if (!data || (data.batters.length === 0 && data.pitchers.length === 0)) {
    return (
      <p className="hint hint--prose">
        Win probability isn&apos;t available for this day&apos;s games — common at
        minor-league parks.
      </p>
    )
  }

  return (
    <LinkScope asOf={dateStr} sportId={sportId}>
      <div className="topperf__sections">
        {data.batters.length > 0 && (
          <section className="topperf__section">
            <h3 className="topperf__title">Top Batters</h3>
            <ul className="playercard__list">
              {data.batters.map((e) => (
                <PerformerCard key={e.id} entry={e} />
              ))}
            </ul>
          </section>
        )}
        {data.pitchers.length > 0 && (
          <section className="topperf__section">
            <h3 className="topperf__title">Top Pitchers</h3>
            <ul className="playercard__list">
              {data.pitchers.map((e) => (
                <PerformerCard key={e.id} entry={e} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </LinkScope>
  )
}

// `games`: this slate's non-Preview games (each needs a `gamePk`).
// `prospectsData`: the app-wide snapshot (fetchTopProspects(), already fetched
// by GameSelect) — passed down rather than re-fetched.
export function TopPerformersBox({ dateStr, sportId, games, prospectsData }) {
  // The "TOP PERFORMERS" banner rides above the seal so the day's leaderboard
  // announces itself while still sealed, then steps aside the moment it's
  // revealed (the revealed panel carries its own Top Batters/Top Pitchers
  // headings). Reset when the date/level changes, since that reseals the box.
  const [revealed, setRevealed] = useState(false)
  useEffect(() => setRevealed(false), [dateStr, sportId])

  return (
    <div className="topperfbox">
      {!revealed && <h2 className="topperf__banner">Top Performers</h2>}
      <SealBox
        key={`${dateStr}-${sportId}`}
        label="Tap to reveal today's top performers"
        onReveal={() => setRevealed(true)}
        compact
      >
        {() => (
          <TopPerformersPanel
            games={games}
            prospects={prospectsData}
            dateStr={dateStr}
            sportId={sportId}
          />
        )}
      </SealBox>
    </div>
  )
}
