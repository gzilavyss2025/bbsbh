import { CLINCH_ORDER, clinchLabel } from '../../api/standings.js'

// MLB's own clinch mark, riding after a club name in a standings row — the
// single letter every published standings table prints, and the reason it is a
// letter here too: the team cell is the narrowest column on the board (it is
// sticky, and on a phone it is capped at 116px), so a spelled-out "CLINCHED THE
// DIVISION" beside a long club name would push the name itself into ellipsis.
// The key below the board spells every letter that is actually in play.
//
// `aria-label` carries the full wording for a screen reader, which is the whole
// of its job — a `title` tooltip would be invisible to the touch readers this
// app is built for, so the sighted reader is served by the visible key instead.
export function ClinchMark({ mark }) {
  if (!mark) return null
  return (
    <span className={`clinchmark clinchmark--${mark}`} aria-label={clinchLabel(mark)}>
      {mark}
    </span>
  )
}

// The key under a board. It lists ONLY the letters present on it (see
// clinchMarksInPlay), so an April standings page prints nothing at all and a
// late-September one grows the key as the race settles — the key explains what
// a reader can see, rather than standing as a fixed list of everything MLB
// could one day send. CLINCH_ORDER keeps it reading best-state-first no matter
// which letters turned up.
export function ClinchKey({ marks }) {
  const shown = CLINCH_ORDER.filter((mark) => marks.has(mark))
  if (shown.length === 0) return null
  return (
    <dl className="clinchkey">
      {shown.map((mark) => (
        <div className="clinchkey__row" key={mark}>
          <dt>
            <span className={`clinchmark clinchmark--${mark}`}>{mark}</span>
          </dt>
          <dd>{clinchLabel(mark)}</dd>
        </div>
      ))}
    </dl>
  )
}
