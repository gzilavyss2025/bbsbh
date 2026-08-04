import { useState, useRef, useEffect } from 'react'
import { beeswarmRows } from '../../../lib/beeswarm.js'
import { teamClubName } from '../../../lib/teams.js'

const DASH = '—'

// Comeback wins — one rail per depth (≤10/20/30% win probability). Each rail is a
// distribution plot of all 30 clubs' comeback RATE at that depth (wins ÷ times
// they sank that low), scaled 0 → the MLB leader, so the dot cloud IS the league
// context: this club's dot (●) reads against the whole field and a tick at the
// pooled MLB average. The numeric line keeps the honest sample size (N of M).
const CBK_LABELS = {
  sub10: 'Down to ≤10%',
  sub20: 'Down to ≤20%',
  sub30: 'Down to ≤30%',
}
function pctLabel(rate) {
  return rate == null ? DASH : `${Math.round(rate * 100)}%`
}
// One depth's rail: every club plotted 0 → the league leader (maxRate), this
// club's dot emphasized, a tick at the MLB average. Reuses the team-score rail's
// dot/tooltip visuals + the shared beeswarm packer (via a 0–10 pseudo-score, so
// a dot lands at rate ÷ maxRate of the width) so it can't drift from that rail.
function ComebackRail({ t, teamId, clubName }) {
  const [activeId, setActiveId] = useState(null)
  const dismissTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(dismissTimer.current), [])

  const max = t.maxRate > 0 ? t.maxRate : 1
  const toPct = (rate) => (rate / max) * 100
  const dots = beeswarmRows(
    t.field
      .filter((r) => r.teamId !== teamId)
      .map((r) => ({ ...r, score: (r.rate / max) * 10 })),
  )
  const active = activeId != null ? t.field.find((r) => r.teamId === activeId) : null
  const show = (id) => setActiveId(id)
  const hide = () => setActiveId(null)
  const tap = (id) => {
    setActiveId(id)
    window.clearTimeout(dismissTimer.current)
    dismissTimer.current = window.setTimeout(
      () => setActiveId((current) => (current === id ? null : current)),
      2200,
    )
  }
  const nameFor = (tid) => (tid === teamId ? clubName : teamClubName(tid)) ?? DASH

  return (
    <div className="team-score__track team-score__track--compact cbk__rail">
      <div className="team-score__track-base" />
      {t.leagueRate != null && (
        <div className="cbk__avg" style={{ left: `${toPct(t.leagueRate)}%` }} aria-hidden="true" />
      )}
      {active && (
        <div className="team-score__tooltip" style={{ left: `${toPct(active.rate)}%` }}>
          {nameFor(active.teamId)} · {pctLabel(active.rate)}
        </div>
      )}
      {dots.map((r) => (
        <button
          key={r.teamId}
          type="button"
          className="team-score__dot"
          style={{ left: `${toPct(r.rate)}%`, top: `calc(11px + ${r.rowOffset}px)` }}
          aria-label={`${nameFor(r.teamId)} ${pctLabel(r.rate)}`}
          onMouseEnter={() => show(r.teamId)}
          onMouseLeave={hide}
          onFocus={() => show(r.teamId)}
          onBlur={hide}
          onClick={(e) => {
            e.stopPropagation()
            tap(r.teamId)
          }}
        />
      ))}
      {t.rate != null && (
        <button
          type="button"
          className="team-score__dot team-score__dot--us"
          style={{ left: `${toPct(t.rate)}%`, top: '11px' }}
          aria-label={`${clubName || 'This team'} ${pctLabel(t.rate)}`}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        />
      )}
    </div>
  )
}
export function ComebackCard({ data, teamId, clubName }) {
  return (
    <div className="tstats-card cbk">
      <div className="tstats-card__head">
        <span>Comeback wins</span>
        <em>all 30 teams</em>
      </div>
      <div className="tstats-card__body">
        <p className="cbk__gloss">
          How often {clubName || 'they'} rallied to win after their chance of winning the game
          sank this low. Each rail plots all 30 clubs from 0% to the MLB leader; ● is{' '}
          {clubName || 'this club'}, and the tick marks the MLB average.
        </p>
        <div className="cbk__rows">
          {data.thresholds.map((t) => {
            const beatsLeague = t.rate != null && t.leagueRate != null && t.rate > t.leagueRate
            return (
              <div key={t.key} className="cbk__row">
                <div className="cbk__head">
                  <span className="cbk__label">{CBK_LABELS[t.key]}</span>
                  <span className="cbk__frac">
                    <span className={`cbk__rate${beatsLeague ? ' cbk__rate--over' : ''}`}>
                      {pctLabel(t.rate)}
                    </span>
                    <span className="cbk__of"> · {t.wins} of {t.att || DASH}</span>
                    {t.rank === 1 && t.wins > 0 && (
                      <span className="cbk__badge">{t.tied ? 'T-MLB best' : 'MLB best'}</span>
                    )}
                  </span>
                </div>
                <ComebackRail t={t} teamId={teamId} clubName={clubName} />
                <div className="cbk__scale">
                  <span>0%</span>
                  <span className="cbk__scale-avg">MLB avg {pctLabel(t.leagueRate)}</span>
                  <span>{pctLabel(t.maxRate)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
