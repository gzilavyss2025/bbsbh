import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGameFeed,
  fetchManager,
  fetchPitcherSeasonLine,
} from '../api/mlb.js'
import { generateScorebookWeather } from '../api/weather.js'
import { selectHasStarted } from '../api/select.js'
import { useAsync } from '../hooks/useAsync.js'
import { sectionToStep, stepToSection } from '../lib/route.js'
import { TeamInfo } from './TeamInfo.jsx'
import { InningViewer } from './InningViewer.jsx'
import { BoxScore } from './BoxScore.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { LogoModal } from '../components/LogoModal.jsx'
import { BaseballMark } from '../components/BaseballMark.jsx'

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

  // Managers need a separate endpoint per team. The coaches endpoint needs
  // nothing from the feed — the game prop already carries both team ids — so
  // this runs in parallel with the feed fetch instead of queuing behind the
  // app's largest response. Keyed on the stable team ids, not the feed object:
  // managers can't change mid-game, so a live Refresh (which mints a new feed
  // object) never re-hits the coaches endpoint or risks blanking a resolved
  // name on a transient failure.
  const managers = useAsync(async () => {
    const [away, home] = await Promise.all([
      fetchManager(game.away.id),
      fetchManager(game.home.id),
    ])
    return { away, home }
  }, [game.away.id, game.home.id])

  // Outdoor scorebook weather string — from the park's lat/lon, not the
  // box-score weather (which reports the interior of a closed roof). Fetched
  // once alongside the feed and shared by the info pages and the box score.
  const weather = useAsync(
    () => (feed ? generateScorebookWeather(feed) : Promise.resolve(null)),
    // Keyed on gamePk (not the feed object) — first-pitch weather is fixed for
    // the game, so a live Refresh shouldn't refetch Open-Meteo or risk blanking.
    [game.gamePk, Boolean(feed)],
  )

  // Each probable starter's season line (ERA/W-L/K), penciled next to the
  // opposing-pitcher row while staging. Season aggregates only — never this
  // game's line. Keyed on gamePk + Boolean(feed) like the weather: the
  // probables come from the feed, but a live Refresh must not refetch.
  const starterLines = useAsync(async () => {
    if (!feed) return null
    const season = feed.gameData?.game?.season
    const probables = feed.gameData?.probablePitchers ?? {}
    const [away, home] = await Promise.all([
      fetchPitcherSeasonLine(probables.away?.id, season, game.sportId),
      fetchPitcherSeasonLine(probables.home?.id, season, game.sportId),
    ])
    return { away, home }
  }, [game.gamePk, Boolean(feed)])

  const started = useMemo(() => (feed ? selectHasStarted(feed) : false), [feed])

  // Where "Innings" returns to: the last half-inning page the user was on, so
  // hopping out to a lineup or the box score and back doesn't lose your place
  // mid-game. Structural only (a section name), never a score.
  const lastInningSection = useRef('top1')
  useEffect(() => {
    if (step === 2) lastInningSection.current = stepToSection(2, inning, half)
  }, [step, inning, half])

  const sketchTeam = sketching ? game[sketching] : null

  return (
    <div className="screen">
      <div className="sitebar">
        <button className="sitebar__home" onClick={onHome} aria-label="Back to games">
          <BaseballMark size={20} simplified />
          <span className="sitebar__word">Scorebook</span>
        </button>
      </div>

      <Masthead away={game.away} home={game.home} onSketch={setSketching} />

      {/* Every game section, one tap away — the same four stops the "next"
          buttons walk in order, so you can flip around the way you flip
          scorebook pages instead of only marching forward. */}
      {feed && (
        <nav className="stepnav" aria-label="Game sections">
          {[
            { key: 0, label: game.away.abbreviation || 'Away', section: 'lineup1' },
            { key: 1, label: game.home.abbreviation || 'Home', section: 'lineup2' },
            { key: 2, label: 'Innings', section: lastInningSection.current },
            { key: 3, label: 'Box', section: 'boxscore' },
          ].map((s) => (
            <button
              key={s.key}
              type="button"
              className={`stepnav__btn ${step === s.key ? 'is-active' : ''}`}
              aria-current={step === s.key ? 'page' : undefined}
              onClick={() => step !== s.key && onSection(s.section)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}

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
        <p className="hint hint--error" role="status">
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
          // The away side FACES the home starter.
          oppPitcherLine={starterLines.data?.home}
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
          oppPitcherLine={starterLines.data?.away}
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
          onInning={(n, h, opts) => onSection(stepToSection(2, n, h), opts)}
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 3 && (
        <BoxScore
          feed={feed}
          managers={managers.data}
          scorebookWeather={weather.data}
          onInnings={() => onSection(lastInningSection.current)}
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
