import { useMemo, useState } from 'react'
import { fetchSchedule } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { gamePath } from '../lib/route.js'
import { SPORT_IDS } from '../lib/teams.js'
import { GameCard } from '../components/GameCard.jsx'
import { FlipCard } from '../components/FlipCard.jsx'
import { GameResultFace } from '../components/GameResultFace.jsx'
import { PastDayRecapBox } from '../components/PastDayRecapBox.jsx'
import { LevelNav } from '../components/LevelNav.jsx'
import { Loader } from '../components/Loader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'

// One past, Final game's flip card, wired to the real feed + win-probability
// endpoints (see usePastGameSignals) — nothing is fetched until the card is
// actually flipped (FlipCard's `onReveal`), same spoiler-gated-fetch-timing
// convention TopPerformersBox already uses.
function PastGameFlipCard({ game, dateStr }) {
  const getSignals = usePastGameSignals()
  const [state, setState] = useState({ loading: false, error: false, data: null })

  const handleReveal = () => {
    setState({ loading: true, error: false, data: null })
    getSignals(game.gamePk).then(
      (data) => setState({ loading: false, error: false, data }),
      () => setState({ loading: false, error: true, data: null }),
    )
  }

  const boxScorePath = gamePath(
    dateStr,
    game.away.abbreviation,
    game.home.abbreviation,
    'boxscore',
    game.gameNumber,
  )

  return (
    <FlipCard
      onReveal={handleReveal}
      renderFront={({ flip }) => <GameCard game={game} onSelect={flip} />}
      renderBack={({ flipBack }) => {
        if (state.loading) {
          return <Loader size="inline" message="Pulling the box score…" />
        }
        if (state.error) {
          return <p className="hint hint--error">Couldn&apos;t load this game.</p>
        }
        if (!state.data) return null
        return (
          <GameResultFace
            feed={state.data.feed}
            winProb={state.data.winProb}
            boxScorePath={boxScorePath}
            onFlipBack={flipBack}
          />
        )
      }}
    />
  )
}

// THIN LIVE PREVIEW — reachable at /preview/pastday, not linked from any nav.
// Wired to the real MLB Stats API (a real past date's Final games) so the
// past-day redesign (flip cards, the two-column Day Recap layout) can be
// judged for real before GameSelect.jsx itself is touched. Deliberately not
// full-featured — no favorite-team pin, no uniforms/prospect readiness, no
// shared fetch cache between this screen's flip cards and the recap box's own
// fan-out — see the plan's "Order of work" for what this preview is (and
// isn't) for.
export function PastPreview({ onBack }) {
  const [offset, setOffset] = useState(-1) // yesterday — likely has real Finals
  const [sportId, setSportId] = useState(SPORT_IDS.MLB)
  const dateStr = useMemo(() => toApiDate(addDays(new Date(), offset)), [offset])

  const slate = useAsync(() => fetchSchedule(dateStr, sportId), [dateStr, sportId])
  const { loading, error, data } = slate

  const finals = useMemo(
    () => (data ?? []).filter((g) => g.abstractState === 'Final'),
    [data],
  )

  return (
    <div className="screen screen--slate">
      <div className="slatehead">
        <header className="topbar topbar--slate">
          <button type="button" className="topbar__title topbar__home" onClick={onBack}>
            ‹ Back
          </button>
          <LevelNav sportId={sportId} onChange={setSportId} />
        </header>

        <div className="datenav datenav--row">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous day">
            ‹
          </button>
          <span className="datenav__label">{humanDate(dateStr)} · preview</span>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Next day">
            ›
          </button>
        </div>
      </div>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={finals.length > 0}
        errorMessage="Couldn’t load games. Check your connection and try again."
        onRetry={slate.reload}
        emptyMessage="No Final games at this level/date — try a different day or level."
        emptyProse
      />

      {finals.length > 0 && (
        <div className="slate-body">
          <ul className="gamelist">
            {finals.map((g) => (
              <li key={`${g.sportId}-${g.gamePk}`}>
                <PastGameFlipCard game={g} dateStr={dateStr} />
              </li>
            ))}
          </ul>
          <PastDayRecapBox dateStr={dateStr} sportId={sportId} games={finals} prospectsData={null} />
        </div>
      )}
    </div>
  )
}
