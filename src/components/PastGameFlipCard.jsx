import { useEffect, useState } from 'react'
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
import { gamePath } from '../lib/route.js'
import { GameCard } from './GameCard.jsx'
import { FlipCard } from './FlipCard.jsx'
import { GameResultFace } from './GameResultFace.jsx'
import { Loader } from './Loader.jsx'

// A past, Final game's slate card, wrapped in a blackjack-style flip: the
// front is the ordinary spoiler-free GameCard; the back — only fetched once
// revealed, via the shared usePastGameSignals cache — is a result summary
// (final line, decisions, play of the game). Fully controlled by `revealed`
// (the slate's page-level "Reveal all results" action — see GameSelect.jsx);
// tapping the card itself always navigates to the real game, same as any
// other slate card.
export function PastGameFlipCard({
  game,
  dateStr,
  revealed,
  pinnedTeamId,
  uniformsReady,
  prospectCount,
  onSelect,
  onBoxScore,
}) {
  const getSignals = usePastGameSignals()
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

  return (
    <FlipCard
      flipped={revealed}
      renderFront={() => (
        <GameCard
          game={game}
          pinnedTeamId={pinnedTeamId}
          uniformsReady={uniformsReady}
          prospectCount={prospectCount}
          onSelect={onSelect}
          onBoxScore={onBoxScore}
        />
      )}
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
