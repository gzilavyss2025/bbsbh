import { ActorHead } from './PitcherNotice.jsx'
import { TABS } from './cardCopy.js'
import { Stack } from '../ui/layout/Stack.jsx'
import { Table } from '../ui/table/Table.jsx'
import { eventCardClass } from '../../lib/design/cardClass.js'
import { useArrival } from '../../hooks/motion/useArrival.js'
import { CardBand, Unfold } from './pitcherCard/Arrival.jsx'

// The two pitching-handoff cards (ADR to follow — see pitcherHandoffs in
// api/pitchers.js for the spoiler footing both rely on): a departing
// pitcher's line frozen at the exact moment he's pulled, and, once every
// runner he left on base has resolved, his settled line. Both share this
// file's markup — a `.change`-family header (headshot + name, same
// layout PitcherNotice uses) over a full ten-column table, the SAME markup
// PitchersSection (the Arms tab) renders, not a compact summary row.
//
// THE ARRIVAL (ADR-0113, slice 3). Each card wears the house navy band (never a club colour:
// these cards name a man leaving, not a club taking the mound) and its table unfolds at
// 380 ms. `open` is "the line is here": it defaults to true, so a card that is in hand when
// it mounts draws final, and a caller that pairs it with a card whose data is still on the
// way (PitcherCard's `after`) hands it that card's state, so the two arrive together.
//
// `line` is one row of computePitcherLines' output — { id, last, first,
// jersey, hand, ip, pitches, bf, h, r, er, bb, k } — as returned by
// api/pitchers.js's `pitcherLineAt`. Callers must not render either card for
// a null `line` (nothing accumulated at that cut yet).
function displayName(line) {
  return line.last ? `${line.last}${line.first ? `, ${line.first}` : ''}` : ''
}

export function DepartureLineCard({ line, teamId = null, bookOpen, inheritedCount = 0, open = true }) {
  const arrival = useArrival(open)
  if (!line) return null
  return (
    <Stack gap="snug" className={`${eventCardClass('pitcherhandoff')} ${arrival}`}>
      <CardBand label={TABS.departing} house />
      <div className="change">
        <ActorHead tab={TABS.departing} id={line.id} name={displayName(line)} jersey={line.jersey} hand={line.hand} teamId={teamId}>
          <span className={`pitcherhandoff__chip pitcherhandoff__chip--${bookOpen ? 'open' : 'closed'}`}>
            {bookOpen ? `Incomplete stat line — ${inheritedCount} on base` : 'Final line'}
          </span>
        </ActorHead>
      </div>
      <PitcherLineTable line={line} label={`Line at departure, ${displayName(line)}`} open={open} />
    </Stack>
  )
}

export function FinalizedLineCard({ line, teamId = null, open = true }) {
  const arrival = useArrival(open)
  if (!line) return null
  return (
    <Stack gap="snug" className={`${eventCardClass('pitcherhandoff')} ${arrival}`}>
      <CardBand label={TABS.final} house />
      <div className="change">
        <ActorHead tab={TABS.final} id={line.id} name={displayName(line)} jersey={line.jersey} hand={line.hand} teamId={teamId} />
      </div>
      <PitcherLineTable line={line} label={`Final line, ${displayName(line)}`} open={open} />
    </Stack>
  )
}

// The same ten-column table PitchersSection.jsx renders (Pitcher/R-L/IP/P/
// BF/H/R/ER/BB/K), one row, reusing its `.pitchers__grid` classes as-is —
// literally the Arms-tab table, per the user's ask, not a lookalike. That
// table is normally laid out across the FULL page width; nested in this
// narrower notification card, `table-layout: fixed`'s even column split
// leaves too little room per numeric column on a phone (confirmed against a
// real game: IP "0.1" and P "11" render with no visible gap between them,
// reading as "0.111"). Table's wrap scrolls horizontally instead of letting
// the columns compress below a legible width. Both cards can show on one page
// for the same pitcher, so each names its own scroll region (`label`).
function PitcherLineTable({ line, label, open }) {
  return (
    <Unfold open={open} delay={380}>
    <div className="pitcherhandoff__strip">
    <Table frame="bare" density="tight" sticky label={label} className="pitchers__grid">
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
    </Table>
    </div>
    </Unfold>
  )
}
