import { useState } from 'react'

// The player page's "Advanced" card for pitchers: the run-prevention rates
// behind the headline tiles — FIP, league-adjusted ERA−, the K/BB rates, the
// ground-ball share, what hitters bat against him, and a role-aware last cell
// (quality starts / inherited runners). Shaped by person.js's
// advancedPitchingView from one live statsapi request (see
// person-fetch.js's fetchPitchingAdvanced). Full-season aggregates — same
// spoiler footing as the vs-L/R season splits, and labeled so. MLB-only at
// the source; MiLB pitchers get no card. Each stat's own explainer sits
// behind a tap-to-open "i" glyph next to its label rather than one fixed
// caveat paragraph under the grid, so a reader only sees the prose for the
// term they're actually unsure of.
export function AdvancedPitchingCard({ adv }) {
  if (!adv?.facts?.length) return null
  return (
    <div className="advcard">
      <h3 className="section__title">
        <span>Advanced</span>
        <em>full season</em>
      </h3>
      <dl className="factgrid">
        {adv.facts.map((f) => (
          <AdvancedFact key={f.label} label={f.label} value={f.value} note={f.note} />
        ))}
      </dl>
    </div>
  )
}

// One fact cell with its own tap-to-open note — same tap-glyph-unfolds-in-
// place idiom as the Attendance fact (TeamInfo.jsx's AttendanceFact /
// BoxScore.jsx's AttendanceValue), just anchored next to the LABEL instead
// of the value, since every cell here gets one rather than a single card
// carrying just one glyph.
function AdvancedFact({ label, value, note }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="fact">
      <dt className="fact__label fact__label--info">
        <span>{label}</span>
        {note && (
          <button
            type="button"
            className={`fact__infoglyph${open ? ' fact__infoglyph--open' : ''}`}
            onClick={() => setOpen((was) => !was)}
            aria-expanded={open}
            aria-label={`What is ${label}`}
          >
            <InfoIcon />
          </button>
        )}
      </dt>
      <dd className="fact__value">{value}</dd>
      {open && note && <p className="fact__infonote">{note}</p>}
    </div>
  )
}

// The kraft "i" info glyph, drawn as an SVG dot-over-bar rather than a
// literal "i" character — the app's global ALL-CAPS invariant (index.css)
// would flatten a literal letter into a capital I. Same shape as
// TeamInfo.jsx's InfoIcon (Attendance fact / Umpire tier glyph); kept as its
// own copy here rather than imported, since components/ shouldn't reach into
// screens/ for a five-line glyph.
function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" width="10" height="10" aria-hidden="true">
      <circle cx="10" cy="5.5" r="1.8" fill="currentColor" />
      <rect x="8.2" y="9" width="3.6" height="8" rx="1.2" fill="currentColor" />
    </svg>
  )
}
