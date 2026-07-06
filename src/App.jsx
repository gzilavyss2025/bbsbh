import { useEffect, useState } from 'react'
import { GameSelect } from './screens/GameSelect.jsx'
import { GameView } from './screens/GameView.jsx'
import { LogoSheet } from './screens/LogoSheet.jsx'
import { resolveGame } from './api/mlb.js'
import { useAsync } from './hooks/useAsync.js'
import {
  parseRoute,
  gamePath,
  matchupSlug,
  urlDateToApi,
} from './lib/route.js'

// Top-level router over the History API (no react-router — see lib/route.js).
// Three shapes: the slate ('/'), the printable logo sheet ('/logos'), and a
// deep-linkable game section ('/{date}/{matchup}/{section}'). Every section of
// every game is a real, shareable URL; the back button walks the steps.
export default function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname))
  // The game object from the slate, carried into the game route so a same-session
  // open needs no resolve fetch. Cold loads / shared links resolve from the URL.
  const [seedGame, setSeedGame] = useState(null)

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = (path) => {
    window.history.pushState({}, '', path)
    setRoute(parseRoute(path))
  }

  // Open a game picked from the slate at a given section (the away lineup by
  // default; the card's "Box score" shortcut jumps straight to 'boxscore').
  const openGame = (game, dateStr, section = 'lineup1') => {
    const path = gamePath(
      dateStr,
      game.away.abbreviation,
      game.home.abbreviation,
      section,
    )
    setSeedGame(game)
    go(path)
  }

  if (route.name === 'logos') {
    return (
      <div className="app">
        <LogoSheet onBack={() => go('/')} />
      </div>
    )
  }

  if (route.name === 'game') {
    // Only reuse the seed when it actually matches the URL we're on.
    const seedMatches =
      seedGame &&
      matchupSlug(seedGame.away.abbreviation, seedGame.home.abbreviation) ===
        route.matchup
    return (
      <div className="app">
        <GameRoute
          route={route}
          seed={seedMatches ? seedGame : null}
          onSection={(section) =>
            go(`/${route.date}/${route.matchup}/${section}`)
          }
          onHome={() => go('/')}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <GameSelect onPick={openGame} onShowLogos={() => go('/logos')} />
    </div>
  )
}

// Resolves a game route (date + matchup) to a game object — instantly from the
// seed when present, otherwise by scanning the date's slate — then hands off to
// GameView. Keeps the URL as the single source of truth for which section shows.
function GameRoute({ route, seed, onSection, onHome }) {
  const apiDate = urlDateToApi(route.date)
  const resolved = useAsync(
    () => (seed ? Promise.resolve(seed) : resolveGame(apiDate, route.matchup)),
    [apiDate, route.matchup, seed],
  )

  if (resolved.loading) {
    return (
      <div className="screen">
        <p className="hint">Loading game…</p>
      </div>
    )
  }
  if (resolved.error || !resolved.data) {
    return (
      <div className="screen">
        <p className="hint hint--error">
          Couldn’t find that game. It may not be on the schedule for that date.
        </p>
        <button className="btn" onClick={onHome}>
          Back to games
        </button>
      </div>
    )
  }

  return (
    <GameView
      game={resolved.data}
      section={route.section}
      onSection={onSection}
      onHome={onHome}
    />
  )
}
