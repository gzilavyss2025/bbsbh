import { useState } from 'react'
import { COUNT_METRICS, HALVES, teamRecordsFor } from '../../../../api/teamRecords.js'
import { situationalRecordsPath } from '../../../../lib/route.js'
import { useNav } from '../../../../lib/nav.js'
import '../../../../styles/65-team-records.css'

// The Numbers tab's Records card: this club's W-L in ~50 situations, grouped
// by subject, plus the season counts that are not records (come-from-behind
// wins, sweeps, days in first place, longest streak).
//
// Everything here is derived in src/api/teamRecords.js from the per-game rows
// the nightly gen-team-records.mjs ships — this component picks the half and
// prints. Every row is also a door: it opens that one split ranked across the
// club's whole level at /situational-records
// (screens/SituationalRecordsPage.jsx), because a
// record read alone raises "out of thirty, where is that?" and this card can
// only answer it for one club. It reuses `.tstats-card` / `.tstatrow` so it reads as a
// sibling of the Team batting, Team pitching and Record by Day of Week cards
// above it rather than a new kind of object; only the half toggle, the group
// subheadings and the counts block are new (styles/64-team-records.css).
//
// Spoiler-free on both counts the team hub cares about: the data is a season
// aggregate over Final games (ADR-0034 — the hub is an open surface), and the
// `cutoff` prop is the same day-before cutoff every other dated card on this
// tab honours, applied to the rows before anything is tallied.

// Every row's label opens the same split for the whole level
// (/situational-records),
// carrying the half the card is showing — "64-10 scoring four or more" invites
// "out of thirty, where is that?" on every single line, and the ranking page is
// the answer. The label is the button rather than the whole row, so the two
// figures beside it stay selectable text.
function RecordRows({ rows, sportId, half }) {
  const navigate = useNav()
  return (
    <div className="tstats">
      {rows.map((r) => (
        <div key={r.k} className="tstatrow">
          <button
            type="button"
            className="tstatrow__k trec__rank"
            onClick={() => navigate(situationalRecordsPath({ metric: r.id, half, s: sportId }))}
          >
            {r.k}
          </button>
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
function SeasonCounts({ counts, sportId, half }) {
  const navigate = useNav()
  // Order, wording and which end of each is the good one all live in the
  // COUNT_METRICS catalog (api/teamRecords.js), so this block and the ranking
  // page name the same numbers the same way. Days-at-place rows drop out when
  // the club has never been there, so a runaway leader doesn't print four
  // empty lines.
  const items = COUNT_METRICS.map((m) => ({ ...m, value: m.get(counts) })).filter(
    (m) => !m.id.startsWith('count-days-') || m.value > 0,
  )
  return (
    <div className="trec__counts">
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          className="trec__count trec__rank"
          onClick={() => navigate(situationalRecordsPath({ metric: m.id, half, s: sportId }))}
        >
          <span className="trec__countv">{m.value}</span>
          <span className="trec__countk">{m.k}</span>
        </button>
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
              <RecordRows rows={g.rows} sportId={data.sportId} half={half} />
            </div>
          ))
        ) : (
          <p className="trec__empty">No games in this half of the season yet.</p>
        )}
        {records && (
          <div className="trec__group">
            <h4 className="trec__grouphead">Season counts</h4>
            <SeasonCounts counts={records.counts} sportId={data.sportId} half={half} />
          </div>
        )}
      </div>
    </div>
  )
}
