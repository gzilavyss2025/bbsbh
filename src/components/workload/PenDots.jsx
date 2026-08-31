import { penDotsFrom } from '../../api/workload.js'

// PEN DOTS — a club's whole bullpen as one dot an arm, available first.
//
// The smallest of the four workload marks, and the only one that fits where a
// sentence never could: a slate card's team column, a section header, a table
// cell. The length of the LEADING GREEN RUN is the reading — not the colours,
// which is why the order is fixed and never sorted by anything else.
//
// Spoiler-free, inherited from api/workload.js: completed appearances only,
// nothing from tonight. On a game page in particular, these must be built from
// the nightly file alone — crossing them with the pitchers who have already
// appeared TONIGHT would turn the dot count into a count of pitching changes,
// which tracks the score.
//
// `counts` is a { fresh, limited, down } tally (clubPenCounts, or one club's
// row out of the summary sidecar). A club with no arms on file draws nothing
// rather than a row of dead dots — that is a gap in the file, not an empty
// bullpen (the degrade convention).
export function PenDots({ counts, label, size = 'md' }) {
  const dots = penDotsFrom(counts)
  if (!dots) return null
  const text =
    label ??
    `${counts.fresh} available, ${counts.limited} limited, ${counts.down} likely down`
  return (
    <span className={`pendots pendots--${size}`} role="img" aria-label={text}>
      {dots.map((status, i) => (
        <span
          key={i}
          className={`pendots__dot pendots__dot--${status}`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

