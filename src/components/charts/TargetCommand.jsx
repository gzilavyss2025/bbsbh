import { attributionFor, targetCommandRows } from '../../api/targetCommand.js'
import { PercentileStrip } from './PercentileStrip.jsx'

// TARGET COMMAND — the second percentile strip on the Analytics tab, and the
// only one on the page that measures INTENT.
//
// Every other command reading in this app is about location: the Command Map
// below says which cells a pitcher fills, Statcast's Chase% says what he draws
// off the plate. None of them can tell a pitch painted on the black from a
// pitch that was meant to be middle-away and sailed. This can, because
// OpenCommand reads the catcher's glove out of broadcast video and measures the
// distance from it (see api/targetCommand.js).
//
// IT IS A SEPARATE STRIP, NOT MORE ROWS ON THE STATCAST ONE, and that is a
// deliberate refusal of the easier build. The two lists share a component and
// nothing else: Statcast's rows are one metric each, ranked against every
// qualified pitcher in the league; these rows are one PITCH TYPE each, ranked
// against the men who throw that pitch. Running them together would put
// "Fastball" under "Whiff %" on a shared axis and quietly invite a reader to
// compare the two ranks, which mean different things about different
// populations. Its own heading and its own note are what keep that from
// happening.
//
// NAMED "TARGET COMMAND", never bare "Command" — CommandMap.jsx already owns
// "Command" on this same tab for the density plot, and two cards a scroll apart
// both called Command is a real confusion this card was scoped to avoid.
//
// Renders nothing when the pitcher isn't in the file: a hitter, a MiLB arm, a
// season before 2024, or an arm under the pitch floor. No empty state, same as
// StatcastPercentiles beside it.
export function TargetCommand({ entry, data }) {
  const rows = targetCommandRows(entry, data)
  if (!rows) return null
  const credit = attributionFor(data)

  return (
    <section className="statcast-section">
      <h3 className="section__title">
        <span>Target command</span>
        {/* Short enough to sit on one line at phone width, which the fuller
            "rank among that pitch" did not. What the rank is taken against is
            in each row's own tap-open gloss, where there is room to say it
            properly. */}
        <em>inches from the glove</em>
      </h3>
      <PercentileStrip rows={rows} />
      {/* NOT a footnote to trim. CC BY-NC-SA 4.0 requires the credit wherever
          the data is shown, so it renders with the rows rather than on an
          about page — the same standing the salaries board gives Cot's
          (.paysource). Real visible text, never a hover title. */}
      <p className="pctstrip__source">
        <a href={credit.href} rel="noreferrer noopener" target="_blank">
          {credit.text}
        </a>
      </p>
    </section>
  )
}
