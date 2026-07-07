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
  apiDateToUrl,
} from './lib/route.js'

// Top-level router over the History API (no react-router — see lib/route.js).
// Three shapes: the slate ('/'), the printable logo sheet ('/logos'), and a
// deep-linkable game section ('/{date}/{matchup}/{section}'). Every section of
// every game is a real, shareable URL; the back button walks the steps.
export default function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname))
  // The game object from the slate, carried into the game route so a same-session
  // open needs no resolve fetch. Cold loads / shared links resolve from the URL.
  // Stored with its slate date — the seed is only valid for the exact date +
  // matchup it was picked from (the same two clubs meet on many dates).
  const [seed, setSeed] = useState(null) // { game, date: MMDDYYYY }

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // `replace` swaps the current history entry instead of pushing — used to
  // normalize an out-of-range URL to the half actually shown, so Back doesn't
  // walk through bogus addresses.
  const go = (path, { replace = false } = {}) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
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
      game.gameNumber,
    )
    setSeed({ game, date: apiDateToUrl(dateStr) })
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
    // Only reuse the seed when it matches the URL exactly — date AND matchup.
    // Matchup alone isn't identity: the same slug recurs across a whole series
    // (and a doubleheader's game 2 differs only in its '-2' suffix).
    const seedMatches =
      seed &&
      seed.date === route.date &&
      matchupSlug(
        seed.game.away.abbreviation,
        seed.game.home.abbreviation,
        seed.game.gameNumber,
      ) === route.matchup
    return (
      <div className="app">
        <GameRoute
          route={route}
          seed={seedMatches ? seed.game : null}
          onSection={(section, opts) =>
            go(`/${route.date}/${route.matchup}/${section}`, opts)
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
  // A network failure is not "no such game" — resolveGame throws when every
  // level's schedule was unreachable, and that deserves a retry, not a shrug
  // about the schedule.
  if (resolved.error) {
    return (
      <div className="screen">
        <p className="hint hint--error" role="status">
          Couldn’t load the schedule. Check your connection and try again.
        </p>
        <button className="btn" onClick={resolved.reload}>
          Retry
        </button>
        <button className="btn btn--ghost" onClick={onHome}>
          Back to games
        </button>
      </div>
    )
  }
  if (!resolved.data) {
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
