import { useState } from 'react'
import { HALVES, teamRecordsFor } from '../../../../api/teamRecords.js'
import '../../../../styles/65-team-records.css'

// The Numbers tab's Records card: this club's W-L in ~50 situations, grouped
// by subject, plus the season counts that are not records (come-from-behind
// wins, sweeps, days in first place, longest streak).
//
// Everything here is derived in src/api/teamRecords.js from the per-game rows
// the nightly gen-team-records.mjs ships — this component picks the half and
// prints. It reuses `.tstats-card` / `.tstatrow` wholesale so it reads as a
// sibling of the Team batting, Team pitching and Record by Day of Week cards
// above it rather than a new kind of object; only the half toggle, the group
// subheadings and the counts block are new (styles/64-team-records.css).
//
// Spoiler-free on both counts the team hub cares about: the data is a season
// aggregate over Final games (ADR-0034 — the hub is an open surface), and the
// `cutoff` prop is the same day-before cutoff every other dated card on this
// tab honours, applied to the rows before anything is tallied.

function RecordRows({ rows }) {
  return (
    <div className="tstats">
      {rows.map((r) => (
        <div key={r.k} className="tstatrow">
          <span className="tstatrow__k">{r.k}</span>
          <span className="tstatrow__v">{r.v}</span>
          <span className="tstatrow__r">{r.pct}</span>
        </div>
      ))}
    </div>
  )
}

// The counts that are a single number rather than a W-L. Days-at-place is
// folded in as one row per place the club has actually spent a day at, so a
// runaway leader doesn't print four empty lines.
function SeasonCounts({ counts }) {
  const places = ['1st', '2nd', '3rd', '4th', '5th']
  const items = [
    // "Wins after trailing", not "comeback wins" — the Comeback wins card
    // further down this same tab counts a different thing (games where the
    // club's win probability sank below 10/20/30%, api/comebackWins.js), and
    // two cards on one page using one name for two numbers reads as a bug.
    // This one is the plain ledger fact: it trailed at the end of some
    // half-inning and won anyway.
    ['Wins after trailing', counts.comebackWins],
    ['Losses after leading', counts.lossesAfterLeading],
    ['Walk-off wins', counts.walkOffWins],
    ['Walk-off losses', counts.walkOffLosses],
    ['Times batted around', counts.battedAround],
    ['Series sweeps', counts.swept],
    ['Series swept', counts.sweptBy],
    ['Longest win streak', counts.streaks.wins],
    ['Longest losing streak', counts.streaks.losses],
    ...counts.daysAtPlace
      .map((days, i) => [`Days in ${places[i]} place`, days])
      .filter(([, days]) => days > 0),
  ]
  return (
    <div className="trec__counts">
      {items.map(([label, value]) => (
        <div key={label} className="trec__count">
          <span className="trec__countv">{value}</span>
          <span className="trec__countk">{label}</span>
        </div>
      ))}
    </div>
  )
}

export function RecordsCard({ data, cutoff }) {
  const [half, setHalf] = useState('all')
  // Resolve against the chosen half. A club whose season has not reached the
  // break yet still resolves 'all'; the toggle itself is hidden below.
  const records = teamRecordsFor(data, { cutoff, half })
  const full = teamRecordsFor(data, { cutoff, half: 'all' })
  if (!full) return null

  const showHalves = Boolean(full.allStarDate)

  return (
    <div className="tstats-card trec">
      <div className="tstats-card__head">
        <span>Records</span>
        <em>{records ? `${records.gamesCounted} games · win pct` : 'win pct'}</em>
      </div>
      {showHalves && (
        <div className="trec__halves" role="group" aria-label="Season half">
          {HALVES.map((h) => (
            <button
              key={h.key}
              type="button"
              className={`trec__half${h.key === half ? ' is-on' : ''}`}
              aria-pressed={h.key === half}
              onClick={() => setHalf(h.key)}
            >
              {h.label}
            </button>
          ))}
        </div>
      )}
      <div className="tstats-card__body">
        {records ? (
          records.groups.map((g) => (
            <div key={g.title} className="trec__group">
              <h4 className="trec__grouphead">{g.title}</h4>
              <RecordRows rows={g.rows} />
            </div>
          ))
        ) : (
          <p className="trec__empty">No games in this half of the season yet.</p>
        )}
        {records && (
          <div className="trec__group">
            <h4 className="trec__grouphead">Season counts</h4>
            <SeasonCounts counts={records.counts} />
          </div>
        )}
      </div>
    </div>
  )
}
