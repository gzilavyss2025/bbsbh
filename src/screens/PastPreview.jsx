import { useEffect, useMemo, useState } from 'react'
import { fetchSchedule } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
import { useNav } from '../lib/nav.js'
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

// One past, Final game's flip card. The flip itself is fully controlled by
// the page-level `revealedAll` switch (see PastPreview below) — tapping the
// card itself always navigates to the real game (lineups → innings), same as
// today's slate. Only "Reveal all games" turns every card over at once, and
// only then does this card's own feed/win-probability fetch fire (via the
// shared usePastGameSignals cache, so it's a no-op if the Day Recap panel
// already pulled this same gamePk).
function PastGameFlipCard({ game, dateStr, revealed }) {
  const getSignals = usePastGameSignals()
  const navigate = useNav()
  const [state, setState] = useState({ loading: false, error: false, data: null })

  useEffect(() => {
    if (!revealed) return
    let cancelled = false
    setState({ loading: true, error: false, data: null })
    getSignals(game.gamePk).then(
      (data) => {
        if (!cancelled) setState({ loading: false, error: false, data })
      },
      () => {
        if (!cancelled) setState({ loading: false, error: true, data: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [revealed, game.gamePk, getSignals])

  const boxScorePath = gamePath(
    dateStr,
    game.away.abbreviation,
    game.home.abbreviation,
    'boxscore',
    game.gameNumber,
  )
  const lineupPath = gamePath(
    dateStr,
    game.away.abbreviation,
    game.home.abbreviation,
    'lineup1',
    game.gameNumber,
  )

  return (
    <FlipCard
      flipped={revealed}
      renderFront={() => <GameCard game={game} onSelect={() => navigate(lineupPath)} />}
      renderBack={() => {
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
          />
        )
      }}
    />
  )
}

// The single "reveal all results" control — a top button (wide layout) plus a
// mobile-only fixed bottom bar duplicate, the same floating-bar convention
// InningViewer already uses for "Reveal {half}" (.pagenav/.btn--reveal). One
// tap flips every card on the page AND force-reveals the Day Recap panel (see
// PastDayRecapBox's forceRevealed prop) — there's no per-card unlock, and the
// Day Recap's own seal does the same thing in reverse (see onRevealAll).
function RevealAllBar({ onReveal }) {
  return (
    <>
      <button type="button" className="btn btn--reveal revealall__top" onClick={onReveal}>
        <span className="btn__ball" aria-hidden="true">⚾️</span> Reveal all results
      </button>
      <div className="pagenav pagenav--revealall">
        <button type="button" className="btn btn--reveal" onClick={onReveal}>
          <span className="btn__ball" aria-hidden="true">⚾️</span> Reveal all results
        </button>
      </div>
    </>
  )
}

// `?date=YYYY-MM-DD` jumps straight to a specific day (e.g. a pinned test
// game from docs/test-games.md) instead of clicking Previous Day hundreds of
// times — dev/testing convenience only, not part of the real feature.
function anchorDate() {
  const q = new URLSearchParams(window.location.search).get('date')
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) {
    const [y, m, d] = q.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date()
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
  const [anchor] = useState(anchorDate)
  const hasDateParam = useMemo(
    () => new URLSearchParams(window.location.search).has('date'),
    [],
  )
  const [offset, setOffset] = useState(hasDateParam ? 0 : -1) // yesterday by default — likely has real Finals
  const [sportId, setSportId] = useState(SPORT_IDS.MLB)
  const [revealedAll, setRevealedAll] = useState(false)
  const dateStr = useMemo(() => toApiDate(addDays(anchor, offset)), [anchor, offset])

  // One-directional reveal, reset when the date/level changes (a fresh day
  // starts sealed again) — same reset pattern PastDayRecapBox uses.
  useEffect(() => setRevealedAll(false), [dateStr, sportId])

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
        <>
          {!revealedAll && <RevealAllBar onReveal={() => setRevealedAll(true)} />}
          <div className="slate-body">
            <ul className="gamelist">
              {finals.map((g) => (
                <li key={`${g.sportId}-${g.gamePk}`}>
                  <PastGameFlipCard game={g} dateStr={dateStr} revealed={revealedAll} />
                </li>
              ))}
            </ul>
            <PastDayRecapBox
              dateStr={dateStr}
              sportId={sportId}
              games={finals}
              prospectsData={null}
              revealedAll={revealedAll}
              onRevealAll={() => setRevealedAll(true)}
            />
          </div>
        </>
      )}
    </div>
  )
}
