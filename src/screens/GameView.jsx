import { useMemo, useState } from 'react'
import { fetchGameFeed, fetchManager } from '../api/mlb.js'
import { selectTeamMeta, selectHasStarted } from '../api/select.js'
import { useAsync } from '../hooks/useAsync.js'
import { sectionToStep, stepToSection } from '../lib/route.js'
import { TeamInfo } from './TeamInfo.jsx'
import { InningViewer } from './InningViewer.jsx'
import { BoxScore } from './BoxScore.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { LogoModal } from '../components/LogoModal.jsx'
import { DiamondGlyph } from '../components/DiamondGlyph.jsx'

// Container for a selected game. Fetches the feed (and both managers) once, then
// shows the section named by the URL: away info → home info → inning viewer.
// The chrome is two grayscale team marks (away @ home) that open the sketch
// modal; a small site mark up top returns to the slate. Which section shows is
// driven entirely by `section` / `onSection` so every step is a real URL.
export function GameView({ game, section, onSection, onHome }) {
  const { step, inning } = sectionToStep(section)
  const [sketching, setSketching] = useState(null) // 'away' | 'home' | null

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

  const sketchTeam = sketching ? game[sketching] : null

  return (
    <div className="screen">
      <div className="sitebar">
        <button className="sitebar__home" onClick={onHome} aria-label="Back to games">
          <DiamondGlyph size={20} bases={[false, true, false]} />
          <span className="sitebar__word">Scorebook</span>
        </button>
      </div>

      <Masthead away={game.away} home={game.home} onSketch={setSketching} />

      {sketchTeam && (
        <LogoModal
          teamId={sketchTeam.id}
          name={sketchTeam.name}
          onClose={() => setSketching(null)}
        />
      )}

      {feedState.loading && <p className="hint">Loading game…</p>}
      {(feedState.error || (!feedState.loading && !feed)) && (
        <>
          <p className="hint hint--error">
            Couldn’t load this game. Try again in a moment.
          </p>
          <button className="btn" onClick={feedState.reload}>
            Retry
          </button>
        </>
      )}

      {feed && step === 0 && (
        <TeamInfo
          feed={feed}
          side="away"
          manager={managers.data?.away}
          onNext={() => onSection('lineup2')}
          nextLabel="Home team ›"
        />
      )}
      {feed && step === 1 && (
        <TeamInfo
          feed={feed}
          side="home"
          manager={managers.data?.home}
          onNext={() => onSection('inning1')}
          nextLabel="Innings ›"
        />
      )}
      {feed && step === 2 && (
        <InningViewer
          feed={feed}
          started={started}
          inning={inning}
          onInning={(n) => onSection(stepToSection(2, n))}
          onBoxScore={() => onSection('boxscore')}
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 3 && (
        <BoxScore feed={feed} onInnings={() => onSection('inning1')} />
      )}
    </div>
  )
}

// The game's masthead: two grayscale marks — away on the left, home on the
// right, an @ between — sized like the logos on the lineup pages. Tapping a mark
// opens it enlarged for pencil sketching.
function Masthead({ away, home, onSketch }) {
  return (
    <div className="masthead">
      <MastheadLogo team={away} onSketch={() => onSketch('away')} />
      <span className="masthead__at" aria-hidden="true">@</span>
      <MastheadLogo team={home} onSketch={() => onSketch('home')} />
    </div>
  )
}

function MastheadLogo({ team, onSketch }) {
  return (
    <button
      type="button"
      className="masthead__logo"
      onClick={onSketch}
      aria-label={`Enlarge ${team.name || 'team'} logo for sketching`}
    >
      <TeamLogo teamId={team.id} name={team.name} size={44} bw />
    </button>
  )
}
