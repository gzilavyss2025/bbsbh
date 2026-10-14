import { timeOfDay } from '../../../lib/dates.js'

const RefreshIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M13.5 8A5.5 5.5 0 1 1 11.8 4" />
    <path d="M12 1v3.5H8.5" strokeLinejoin="round" />
  </svg>
)

// The dock that sticks to the foot of the page: Refresh (with when the data is from), the
// keep-awake switch while the game is live, "Catch up to live" on a game in progress, and the
// advance button. Catch-up wears the kraft reveal skin: the same texture, and so the same
// warning, as every other reveal in the app (ADR-0055).
export function LineupDock({ onReload, loading, lastUpdated, isLive, keepAwake, onSetKeepAwake, onCatchUp, onNext, nextLabel }) {
  return (
    <div className="ldock">
      {onReload && (
        <button type="button" className="ldock__ref" aria-label="Refresh live game data" disabled={loading} onClick={onReload}>
          <RefreshIcon />
          <span className="ldock__tx">
            <b>{loading ? 'Refreshing…' : 'Refresh'}</b>
            {lastUpdated && !loading && <small>As of {timeOfDay(lastUpdated)}</small>}
          </span>
        </button>
      )}
      {isLive && (
        <button
          type="button"
          role="switch"
          aria-checked={keepAwake}
          aria-label={keepAwake ? 'Keep screen awake: on' : 'Keep screen awake: off'}
          title="Keep the screen from sleeping during this live game"
          className="ldock__awake"
          onClick={() => onSetKeepAwake(!keepAwake)}
        >
          <span aria-hidden="true">{keepAwake ? '☀' : '☾'}</span>
        </button>
      )}
      {onCatchUp && (
        <button type="button" className="ldock__catch btn btn--reveal" onClick={onCatchUp}>
          Catch up to live ›
        </button>
      )}
      <button type="button" className="ldock__next" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  )
}
