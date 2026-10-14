import { Button } from './Button.jsx'
import { timeOfDay } from '../../../lib/dates.js'

// Same pill button/markup as the innings viewer's Refresh — reused here and
// in the box score so every game page has one, not just the live innings.
// `onReload` is undefined only for the (unused) case a caller skips it, so
// this degrades to nothing rather than a dead button. `lastUpdated`
// (useAsync's epoch-ms field, threaded down from GameView's feedState) shows
// a small "as of 7:42 PM" caption so a congested-wifi refresh failure or the
// new auto-refresh poll (useGameData's FEED_POLL_MS) both stay legible —
// you can tell how fresh what's on screen actually is without guessing.
export function RefreshButton({ onReload, loading, lastUpdated, className = '' }) {
  if (!onReload) return null
  return (
    <>
      <Button
        size="control"
        icon="↻"
        busy={loading}
        className={`innings__refresh ${className}`.trim()}
        onClick={onReload}
        aria-label="Refresh live game data"
      >
        {loading ? 'Refreshing…' : 'Refresh'}
      </Button>
      {lastUpdated && !loading && (
        <span className="refreshstamp">as of {timeOfDay(lastUpdated)}</span>
      )}
    </>
  )
}
