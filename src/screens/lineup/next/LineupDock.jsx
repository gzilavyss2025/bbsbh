import { RefreshButton } from '../../TeamInfo.jsx'

// The bar that rides the foot of the page: refresh, keep-awake while the game is live,
// "Catch up to live" on a game in progress, and the advance button.
export function LineupDock({ onReload, loading, lastUpdated, isLive, keepAwake, onSetKeepAwake, onCatchUp, onNext, nextLabel }) {
  return (
    <div className="pagenav pagenav--innings lnext__dock">
      <RefreshButton onReload={onReload} loading={loading} lastUpdated={lastUpdated} className="innings__refresh--float" />
      {isLive && (
        <button
          type="button"
          role="switch"
          aria-checked={keepAwake}
          aria-label={keepAwake ? 'Keep screen awake: on' : 'Keep screen awake: off'}
          title="Keep the screen from sleeping during this live game"
          className={`awaketoggle${keepAwake ? ' is-on' : ''}`}
          onClick={() => onSetKeepAwake(!keepAwake)}
        >
          <span className="awaketoggle__icon" aria-hidden="true">
            {keepAwake ? '☀' : '☾'}
          </span>
        </button>
      )}
      {onCatchUp ? (
        <div className="revealsplit">
          <button className="btn btn--reveal revealsplit__btn" onClick={onCatchUp}>
            Catch up to live ›
          </button>
          <button className="btn btn--ink btn--next revealsplit__btn" onClick={onNext}>
            {nextLabel}
          </button>
        </div>
      ) : (
        <button className="btn btn--ink btn--next" onClick={onNext}>
          {nextLabel}
        </button>
      )}
    </div>
  )
}
