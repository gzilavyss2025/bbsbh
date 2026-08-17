import { PlayerLink } from '../player/PlayerLink.jsx'
import { PitcherPhoto } from './PitcherNotice.jsx'

// The two pitching-handoff cards (ADR to follow — see pitcherHandoffs in
// api/pitchers.js for the spoiler footing both rely on): a departing
// pitcher's line frozen at the exact moment he's pulled, and, once every
// runner he left on base has resolved, his settled line. Both share this
// file's markup — a `.pitchernotice`-family header (headshot + name, same
// layout PitcherNotice uses) over a full ten-column table, the SAME markup
// PitchersSection (the Arms tab) renders, not a compact summary row.
//
// `line` is one row of computePitcherLines' output — { id, last, first,
// jersey, hand, ip, pitches, bf, h, r, er, bb, k } — as returned by
// api/pitchers.js's `pitcherLineAt`. Callers must not render either card for
// a null `line` (nothing accumulated at that cut yet).
function displayName(line) {
  return line.last ? `${line.last}${line.first ? `, ${line.first}` : ''}` : ''
}

export function DepartureLineCard({ line, teamId = null, bookOpen, inheritedCount = 0 }) {
  if (!line) return null
  return (
    <div className="pitcherhandoff pitchernotice--pbp">
      <div className="pitchernotice">
        <PitcherPhoto personId={line.id} name={displayName(line)} teamId={teamId} />
        <div className="pitchernotice__body">
          <span className="pitchernotice__now">Departing</span>
          <span className="pitchernotice__pitcher">
            <PlayerLink id={line.id}>{displayName(line)}</PlayerLink>
            <span className="pitchernotice__badges">
              {line.jersey ? <span className="pitchernotice__jersey">{line.jersey}</span> : null}
              {line.hand ? <span className="pitchernotice__hand">{line.hand}HP</span> : null}
            </span>
          </span>
          <span className={`pitcherhandoff__chip pitcherhandoff__chip--${bookOpen ? 'open' : 'closed'}`}>
            {bookOpen ? `Incomplete stat line — ${inheritedCount} on base` : 'Final line'}
          </span>
        </div>
      </div>
      <PitcherLineTable line={line} />
    </div>
  )
}

export function FinalizedLineCard({ line, teamId = null }) {
  if (!line) return null
  return (
    <div className="pitcherhandoff pitchernotice--pbp">
      <div className="pitchernotice">
        <PitcherPhoto personId={line.id} name={displayName(line)} teamId={teamId} />
        <div className="pitchernotice__body">
          <span className="pitchernotice__now">Final line for</span>
          <span className="pitchernotice__pitcher">
            <PlayerLink id={line.id}>{displayName(line)}</PlayerLink>
            <span className="pitchernotice__badges">
              {line.jersey ? <span className="pitchernotice__jersey">{line.jersey}</span> : null}
              {line.hand ? <span className="pitchernotice__hand">{line.hand}HP</span> : null}
            </span>
          </span>
        </div>
      </div>
      <PitcherLineTable line={line} />
    </div>
  )
}

// The same ten-column table PitchersSection.jsx renders (Pitcher/R-L/IP/P/
// BF/H/R/ER/BB/K), one row, reusing its `.pitchers__grid` classes as-is —
// literally the Arms-tab table, per the user's ask, not a lookalike. That
// table is normally laid out across the FULL page width; nested in this
// narrower notification card, `table-layout: fixed`'s even column split
// leaves too little room per numeric column on a phone (confirmed against a
// real game: IP "0.1" and P "11" render with no visible gap between them,
// reading as "0.111"). `.pitcherhandoff__tablewrap` scrolls horizontally
// instead of letting the columns compress below a legible width.
function PitcherLineTable({ line }) {
  return (
    <div className="pitcherhandoff__tablewrap">
      <table className="pitchers__grid">
        <thead>
          <tr>
            <th className="pitchers__pitcher">Pitcher</th>
            <th>R/L</th>
            <th>IP</th>
            <th>P</th>
            <th>BF</th>
            <th>H</th>
            <th>R</th>
            <th>ER</th>
            <th>BB</th>
            <th>K</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pitchers__pitcher">
              <div className="pitchers__cell">
                <span className="pitchers__pname">{displayName(line)}</span>
                {line.jersey ? <span className="pitchers__num">{line.jersey}</span> : null}
              </div>
            </td>
            <td>{line.hand || '—'}</td>
            <td>{line.ip}</td>
            <td>{line.pitches}</td>
            <td>{line.bf}</td>
            <td>{line.h}</td>
            <td>{line.r}</td>
            <td>{line.er}</td>
            <td>{line.bb}</td>
            <td>{line.k}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
