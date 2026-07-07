import { useMemo, useState } from 'react'
import { fetchGameFeed, fetchManager } from '../api/mlb.js'
import { generateScorebookWeather } from '../api/weather.js'
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
  const { step, inning, half } = sectionToStep(section)
  const [sketching, setSketching] = useState(null) // 'away' | 'home' | null

  const feedState = useAsync(() => fetchGameFeed(game.gamePk), [game.gamePk])
  const feed = feedState.data

  // Managers need a separate endpoint per team. Keyed on gamePk, not the feed
  // object — managers can't change mid-game, so a live Refresh (which mints a
  // new feed object) shouldn't re-hit the coaches endpoint or risk blanking a
  // resolved name on a transient failure.
  const managers = useAsync(async () => {
    if (!feed) return { away: null, home: null }
    const awayMeta = selectTeamMeta(feed, 'away')
    const homeMeta = selectTeamMeta(feed, 'home')
    const [away, home] = await Promise.all([
      fetchManager(awayMeta.id),
      fetchManager(homeMeta.id),
    ])
    return { away, home }
  }, [game.gamePk, Boolean(feed)])

  // Outdoor scorebook weather string — from the park's lat/lon, not the
  // box-score weather (which reports the interior of a closed roof). Fetched
  // once alongside the feed and shared by the info pages and the box score.
  const weather = useAsync(
    () => (feed ? generateScorebookWeather(feed) : Promise.resolve(null)),
    // Keyed on gamePk (not the feed object) — first-pitch weather is fixed for
    // the game, so a live Refresh shouldn't refetch Open-Meteo or risk blanking.
    [game.gamePk, Boolean(feed)],
  )

  const started = useMemo(() => (feed ? selectHasStarted(feed) : false), [feed])

  const sketchTeam = sketching ? game[sketching] : null

  return (
    <div className="screen">
      <div className="sitebar">
        <button className="sitebar__home" onClick={onHome} aria-label="Back to games">
          <DiamondGlyph size={20} bases={[false, true, false]} />
          <span className="sitebar__word">Scorebook</span>
        </button>
        {feed && step !== 3 && (
          <button
            type="button"
            className="sitebar__box"
            onClick={() => onSection('boxscore')}
          >
            Box score ›
          </button>
        )}
      </div>

      <Masthead away={game.away} home={game.home} onSketch={setSketching} />

      {sketchTeam && (
        <LogoModal
          teamId={sketchTeam.id}
          name={sketchTeam.name}
          onClose={() => setSketching(null)}
        />
      )}

      {feedState.loading && !feed && <p className="hint">Loading game…</p>}
      {/* Cold-load failure (never got a feed): collapse to a retry card. */}
      {!feed && feedState.error && (
        <>
          <p className="hint hint--error">
            Couldn’t load this game. Try again in a moment.
          </p>
          <button className="btn" onClick={feedState.reload}>
            Retry
          </button>
        </>
      )}
      {/* Refresh failure with a feed already in hand: keep the game on screen
          (useAsync retains the last-good feed) and just flag the stale refresh
          so one flaky request at a live game doesn't tear down the view. */}
      {feed && feedState.error && (
        <p className="hint hint--error">
          Couldn’t refresh — showing the last update.
        </p>
      )}

      {feed && step === 0 && (
        <TeamInfo
          feed={feed}
          side="away"
          manager={managers.data?.away}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          onNext={() => onSection('lineup2')}
          nextLabel="Home team ›"
        />
      )}
      {feed && step === 1 && (
        <TeamInfo
          feed={feed}
          side="home"
          manager={managers.data?.home}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          onNext={() => onSection('top1')}
          nextLabel="Innings ›"
        />
      )}
      {feed && step === 2 && (
        <InningViewer
          feed={feed}
          started={started}
          inning={inning}
          half={half}
          onInning={(n, h) => onSection(stepToSection(2, n, h))}
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 3 && (
        <BoxScore
          feed={feed}
          managers={managers.data}
          scorebookWeather={weather.data}
          onInnings={() => onSection('top1')}
        />
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
