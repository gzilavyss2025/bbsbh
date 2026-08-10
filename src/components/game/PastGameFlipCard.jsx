import { lazy, Suspense, useEffect, useState } from 'react'
import { usePastGameSignals } from '../../hooks/usePastGameSignals.js'
import { gamePath } from '../../lib/route.js'
import { GameCard } from './GameCard.jsx'
import { FlipCard } from '../ui/FlipCard.jsx'
import { BoxScoreSkeleton } from './BoxScoreSkeleton.jsx'

// DYNAMIC ON PURPOSE — keep it that way. GameResultFace pulls api/boxscore.js
// and, under it, the play-by-play selectors (halfInningFeed, scorebookCode,
// entriesView, advanceCode, notificationCards, gameNotes, pitchers): ~40 KiB
// raw of scoring-flow code. Imported statically it rode in the ENTRY chunk, so
// every first visit to the slate downloaded and parsed the innings viewer's
// data layer before it could paint — on a screen that never scores a game.
//
// Nothing is lost by deferring it. FlipCard calls `renderBack` only while
// `flipped`, and the back face additionally waits on usePastGameSignals'
// fetch, so the chunk request overlaps a round trip the user is already
// waiting through, behind the skeleton that was already the loading state.
// Same reasoning as the Clerk-gated surfaces (see components/CLAUDE.md);
// converting this back to a static import would build cleanly and silently
// undo it, so check the built entry chunk, not just that the build passed.
const GameResultFace = lazy(() =>
  import('./GameResultFace.jsx').then((m) => ({ default: m.GameResultFace })),
)

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
  prospectCount,
  cardMeta = null,
  video = null,
  liveJerseys = null,
  national = '',
  eager = false,
  onSelect,
  onBoxScore,
}) {
  const getSignals = usePastGameSignals()
  const [state, setState] = useState({ loading: false, error: false, data: null })

  useEffect(() => {
    if (!revealed) return
    let cancelled = false
    // Kicking off the loading state before starting the fetch is the standard
    // data-fetching-effect shape (see React's own "Fetching data" example in
    // "You Might Not Need an Effect") — not the "adjusting state when a prop
    // changes" anti-pattern this rule is chiefly aimed at.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          prospectCount={prospectCount}
          liveJerseys={liveJerseys}
          national={national}
          eager={eager}
          onSelect={onSelect}
          onBoxScore={onBoxScore}
        />
      )}
      renderBack={() => {
        if (state.loading) {
          return <BoxScoreSkeleton cardMeta={cardMeta} />
        }
        if (state.error) {
          return <p className="hint hint--error">Couldn&apos;t load this game.</p>
        }
        if (!state.data) return null
        // The skeleton doubles as the Suspense fallback: on the rare visit
        // where the signals fetch beats the chunk, the card keeps showing the
        // same placeholder it already showed, rather than blinking to empty.
        return (
          <Suspense fallback={<BoxScoreSkeleton cardMeta={cardMeta} />}>
            <GameResultFace
              feed={state.data.feed}
              winProb={state.data.winProb}
              boxScorePath={boxScorePath}
              game={game}
              pinnedTeamId={pinnedTeamId}
              cardMeta={cardMeta}
              video={video}
            />
          </Suspense>
        )
      }}
    />
  )
}
