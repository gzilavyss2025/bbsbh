import { useEffect, useRef } from 'react'

function signed(n) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`
}

export function SeasonScoreModal({ snapshot, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    const trigger = document.activeElement
    window.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [onClose])

  return (
    <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet ssmodal" role="dialog" aria-modal="true" aria-label="Season Surprise Score">
        <div className="ssmodal__head">
          <div>
            <h2 className="sheet__title">Season Surprise Score</h2>
            <p className="ssmodal__asof">Through {snapshot.asOf}</p>
          </div>
          <button ref={closeRef} type="button" className="gsmodal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p className="sheet__body">
          This is the team’s actual wins above or below its preseason expectation for the games it has played,
          adjusted for the opponents and home fields on that schedule. It is not a forecast.
        </p>
        <dl className="ssmodal__facts">
          <Fact label="Season Surprise Score" value={snapshot.score.toFixed(1)} />
          <Fact label="Actual record" value={`${snapshot.wins}–${snapshot.losses}`} />
          <Fact label="Expected wins to date" value={snapshot.expectedWinsToDate.toFixed(1)} />
          <Fact label="Wins vs. expectation" value={signed(snapshot.residualWins)} positive={snapshot.residualWins >= 0} />
          <Fact label="Preseason baseline" value={`${snapshot.baselineWins.toFixed(1)} wins`} note={snapshot.baselineKind === 'market' ? 'market' : 'Marcel fallback'} />
          {snapshot.earnedPaceWins != null && <Fact label="Earned pace" value={`${snapshot.earnedPaceWins.toFixed(1)} wins`} />}
          <Fact label={`Last ${snapshot.trend.games}`} value={`${snapshot.trend.wins}–${snapshot.trend.losses}`} />
        </dl>
      </div>
    </div>
  )
}

function Fact({ label, value, note, positive }) {
  return (
    <div className="ssmodal__fact">
      <dt>{label}{note ? <span>{note}</span> : null}</dt>
      <dd className={positive === undefined ? '' : positive ? 'is-positive' : 'is-negative'}>{value}</dd>
    </div>
  )
}
