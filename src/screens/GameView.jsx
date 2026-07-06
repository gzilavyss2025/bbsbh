import { useMemo, useState } from 'react'
import { fetchGameFeed, fetchManager } from '../api/mlb.js'
import { selectTeamMeta, selectHasStarted } from '../api/select.js'
import { useAsync } from '../hooks/useAsync.js'
import { TeamInfo } from './TeamInfo.jsx'
import { InningViewer } from './InningViewer.jsx'
import { RevealScoreButton } from '../components/RevealScoreButton.jsx'

const STEPS = ['away', 'home', 'innings']

// Container for a selected game. Fetches the feed (and both managers) once,
// then walks the user through away info → home info → inning viewer. Owns the
// global "reveal everything" flag.
export function GameView({ game, onBack }) {
  const [step, setStep] = useState(0)
  const [globalRevealed, setGlobalRevealed] = useState(false)

  const feedState = useAsync(() => fetchGameFeed(game.gamePk), [game.gamePk])
  const feed = feedState.data

  // Managers need a separate endpoint per team.
  const managers = useAsync(async () => {
    if (!feed) return { away: null, home: null }
    const awayMeta = selectTeamMeta(feed, 'away')
    const homeMeta = selectTeamMeta(feed, 'home')
    const [away, home] = await Promise.all([
      fetchManager(awayMeta.id),
      fetchManager(homeMeta.id),
    ])
    return { away, home }
  }, [feed])

  const started = useMemo(() => (feed ? selectHasStarted(feed) : false), [feed])

  if (feedState.loading) {
    return (
      <Frame game={game} onBack={onBack}>
        <p className="hint">Loading game…</p>
      </Frame>
    )
  }
  if (feedState.error || !feed) {
    return (
      <Frame game={game} onBack={onBack}>
        <p className="hint hint--error">
          Couldn’t load this game. Try again in a moment.
        </p>
        <button className="btn" onClick={feedState.reload}>
          Retry
        </button>
      </Frame>
    )
  }

  const currentStep = STEPS[step]

  return (
    <Frame
      game={game}
      onBack={step === 0 ? onBack : () => setStep((s) => s - 1)}
      backLabel={step === 0 ? 'Games' : 'Back'}
      action={
        currentStep === 'innings' ? (
          <RevealScoreButton
            revealed={globalRevealed}
            onReveal={() => setGlobalRevealed(true)}
          />
        ) : null
      }
    >
      {currentStep === 'away' && (
        <TeamInfo
          feed={feed}
          side="away"
          manager={managers.data?.away}
          onNext={() => setStep(1)}
          nextLabel="Home team ›"
        />
      )}
      {currentStep === 'home' && (
        <TeamInfo
          feed={feed}
          side="home"
          manager={managers.data?.home}
          onNext={() => setStep(2)}
          nextLabel="Innings ›"
        />
      )}
      {currentStep === 'innings' && (
        <InningViewer
          feed={feed}
          started={started}
          globalRevealed={globalRevealed}
          onReload={feedState.reload}
        />
      )}
    </Frame>
  )
}

function Frame({ game, onBack, backLabel = 'Back', action, children }) {
  return (
    <div className="screen">
      <header className="topbar topbar--game">
        <button className="topbar__back" onClick={onBack}>
          ‹ {backLabel}
        </button>
        <span className="topbar__match">
          {game.away.teamName} @ {game.home.teamName}
        </span>
        <span className="topbar__action">{action}</span>
      </header>
      {children}
    </div>
  )
}
