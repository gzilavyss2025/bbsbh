import { useEffect, useRef } from 'react'
import { TeamLogo } from './TeamLogo.jsx'
import { favoriteAccentColor } from '../lib/teams.js'

// Rounding straight to 1 decimal would show "100.0%" for anything from
// 99.95% up to a true 2000/2000 — indistinguishable from actual certainty.
// Near the 0%/100% extremes, fall back to 2 decimals so a near-miss still
// reads as a near-miss. Same formatting PostseasonOddsCard used before this
// modal replaced its single-team card on the Team Page.
function pct(n) {
  if (n == null) return '—'
  if (n <= 0) return '0.0%'
  if (n >= 100) return '100.0%'
  const rounded = Math.round(n * 10) / 10
  if (rounded === 0 || rounded === 100) return `${n.toFixed(2)}%`
  return `${rounded.toFixed(1)}%`
}

// Opened from the "Postseason Odds" pill next to the Standings section
// title — the full division table (one row per team, same order/rows the
// standings table above already lists) instead of the old single-team card,
// so a visitor can compare the whole division's odds at a glance. Same
// dialog contract as GameScoreModal/UmpireAccuracyModal: Escape and a
// backdrop tap close it, focus moves to the close button on open and back to
// the trigger on close.
export function PostseasonOddsModal({ divisionName, rows, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const sims = rows.find((r) => r.sims != null)?.sims ?? null

  return (
    <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div
        className="sheet psoddsmodal"
        role="dialog"
        aria-modal="true"
        aria-label={`Postseason odds — ${divisionName}`}
      >
        <div className="gsmodal__head">
          <h2 className="sheet__title">Postseason Odds</h2>
          <button ref={closeRef} type="button" className="gsmodal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="psoddsmodal__sub">{divisionName}</p>

        <div className="ledger-wrap">
          <table className="ledger standings psoddstable">
            <thead>
              <tr>
                <th className="team lft">Team</th>
                <th>Playoffs</th>
                <th>Division</th>
                <th>Bye</th>
                <th>Proj. W</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={r.isMe ? 'is-me' : ''}
                  style={r.isMe ? { '--fav-accent': favoriteAccentColor(r.id) } : undefined}
                >
                  <td className="team">
                    <TeamLogo teamId={r.id} name={r.name} size={18} />
                    {r.name}
                  </td>
                  <td>{pct(r.playoffPct)}</td>
                  <td>{pct(r.divisionPct)}</td>
                  <td>{pct(r.byePct)}</td>
                  <td>{r.projectedWins ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sims != null && <p className="psoddsmodal__meta">{sims.toLocaleString()} simulations</p>}
      </div>
    </div>
  )
}
