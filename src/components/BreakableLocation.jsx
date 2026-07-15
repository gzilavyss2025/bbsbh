import { Fragment } from 'react'
import { slashBreakSegments } from '../lib/teamSplits.js'

// A team's split-off location line, with a FORCED line break right after any
// "/" (e.g. "Scranton/Wilkes-Barre") rather than leaving it to the browser's
// greedy fill — which prefers the LATEST break opportunity that still fits a
// line, i.e. the hyphen in "Wilkes-Barre", cutting the word in half on a
// narrow card. Shared by GameCard's slate tiles and OffDaySection's off-day
// tiles, the two spots a club's location renders on its own line.
export function BreakableLocation({ text, className }) {
  const segments = slashBreakSegments(text)
  return (
    <span className={className}>
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {seg}
          {i < segments.length - 1 && <br />}
        </Fragment>
      ))}
    </span>
  )
}
