import { useState } from 'react'

const DASH = '—'
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`

function scoreValue(summary) {
  return summary?.score == null ? DASH : summary.score.toFixed(1)
}

function record(summary) {
  return summary ? `${summary.wins}–${summary.losses}` : DASH
}

function meta(summary, recent = false) {
  if (!summary) return ''
  const games = recent ? `last ${summary.games}` : 'season'
  return `${record(summary)} · ${signed(summary.runDifferential)} RD · ${games}`
}

export function TeamScoreCard({ snapshot, surprise }) {
  const [open, setOpen] = useState(null)
  const detail = open === 'season' ? snapshot.season : open === 'form' ? snapshot.currentForm : null
  const toggle = (next) => setOpen((current) => (current === next ? null : next))

  return (
    <section className={`team-score${open ? ' is-open' : ''}`} aria-label={`Team scores through ${snapshot.asOf}`}>
      <div className="team-score__head">
        <span>Team Scores</span>
        <em>through {snapshot.asOf}</em>
      </div>
      <div className="team-score__values">
        <button
          type="button"
          className={`team-score__value${open === 'season' ? ' is-active' : ''}`}
          onClick={() => toggle('season')}
          aria-expanded={open === 'season'}
          aria-controls={open === 'season' ? 'team-score-detail' : undefined}
        >
          <span>Season Score</span>
          <strong>{scoreValue(snapshot.season)}</strong>
          <em>{meta(snapshot.season)}</em>
        </button>
        <button
          type="button"
          className={`team-score__value${open === 'form' ? ' is-active' : ''}`}
          onClick={() => toggle('form')}
          aria-expanded={open === 'form'}
          aria-controls={open === 'form' ? 'team-score-detail' : undefined}
        >
          <span>Current Form</span>
          <strong>{scoreValue(snapshot.currentForm)}</strong>
          <em>{meta(snapshot.currentForm, true)}</em>
        </button>
      </div>
      {detail && (
        <div id="team-score-detail" className="team-score__detail">
          <dl>
            <div><dt>Record</dt><dd>{record(detail)}</dd></div>
            <div><dt>Run differential</dt><dd>{signed(detail.runDifferential)}</dd></div>
            <div><dt>Run-quality wins</dt><dd>{detail.pythagWins.toFixed(1)}</dd></div>
            {open === 'season' && surprise && (
              <div><dt>Season Surprise</dt><dd>{signed(surprise.residualWins)} wins</dd></div>
            )}
          </dl>
        </div>
      )}
    </section>
  )
}
