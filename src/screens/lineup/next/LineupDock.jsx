import { timeOfDay } from '../../../lib/dates.js'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'

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
export function LineupDock({ onReload, loading, lastUpdated, isLive, keepAwake, onSetKeepAwake, onCatchUp, onNext, nextLabel, nextTeamId = null, tabs = [], onSection }) {
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
      {/* From the wide step the game's sections live here, in place of the advance button and the
          bar under the facts (Gary, 2026-10-29). A phone keeps that bar and the advance button. */}
      {tabs.length > 0 && (
        <nav className="ldock__tabs" aria-label="Game sections">
          {/* No Scorecard stop here, and Gameday goes last, wide (Gary, 2026-10-29). */}
          {[...tabs.filter((t) => t.key !== 'scorecard' && t.key !== 'innings'), ...tabs.filter((t) => t.key === 'innings')].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`ldock__tab ldock__tab--${t.key}${t.active ? ' is-current' : ''}`}
              aria-current={t.active ? 'page' : undefined}
              onClick={() => !t.active && onSection(t.section)}
            >
              {/* The current tab sits on the dock's navy: its white knockout mark (ADR-0031). */}
              {t.teamId && <TeamLogo teamId={t.teamId} size={28} variant={t.active ? 'mono' : undefined} className="ldock__mark" />}
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <button type="button" className="ldock__next" onClick={onNext}>
        {/* The next page's club, by its mark (option 1, 2026-10-29); a non-club step has none. */}
        {nextTeamId && <TeamLogo teamId={nextTeamId} size={36} className="ldock__mark" />}
        {nextLabel}
      </button>
    </div>
  )
}
