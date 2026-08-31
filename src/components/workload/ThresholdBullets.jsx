// THRESHOLD BULLETS — the availability rule, drawn.
//
// One bullet graph a flag (Stephen Few's form: a measure against a scale, with
// a comparative mark). The comparative mark here is the PUBLISHED THRESHOLD the
// rule already uses — 25 pitches yesterday, 35 over three days, back-to-back —
// so the bar sitting past its tick IS the flag tripping. It replaces the
// reasons string ("42 pitches yesterday · 42 pitches over 3 days"), which gave
// the reader two numbers and no scale to read them against.
//
// EVERY TICK SITS AT THE SAME 62%, whatever the flag measures, so a stack of
// three reads down one column: past the line is clay, short of it green, two
// past means down. Position carries the reading, not colour alone.
//
// The third flag is asymmetric — three straight days files an arm as down on
// its own, where the other two must pair up — so it draws a second, heavier
// stop at `hardAt` and marks its label. A drawing of a rule that hid that would
// be a drawing of a different rule.
//
// `flags` is api/workload.js's tiredFlagsFor output (also on availabilityFor's
// return). Null/empty renders nothing, which is a starter's case: a rotation is
// not a bullpen and these thresholds do not judge one.

// Where the soft threshold sits on every track, as a fraction of its width.
const TICK_AT = 0.62

// A measure's bar width, on the scale that puts `threshold` at TICK_AT. Clamped
// at the full track: a man who threw 60 pitches yesterday is off the end of any
// honest scale, and a bar that overflowed would say less than a full one.
function barPct(value, threshold) {
  if (!(threshold > 0)) return 0
  return Math.max(0, Math.min(100, (value / threshold) * TICK_AT * 100))
}

export function ThresholdBullets({ flags }) {
  if (!flags || flags.length === 0) return null
  return (
    <dl className="bullets">
      {flags.map((f) => (
        <div
          className={`bullets__row${f.tripped ? ' bullets__row--tripped' : ''}`}
          key={f.key}
        >
          <dt className="bullets__label">
            {f.hard && <span className="bullets__hardmark" aria-hidden="true" />}
            {f.label}
          </dt>
          <dd className="bullets__value">
            <span
              className="bullets__track"
              role="img"
              aria-label={`${f.label}: ${f.value} against a threshold of ${f.threshold}`}
            >
              <span
                className="bullets__band"
                style={{ width: `${TICK_AT * 100}%` }}
                aria-hidden="true"
              />
              <span
                className="bullets__bar"
                style={{ width: `${barPct(f.value, f.threshold)}%` }}
                aria-hidden="true"
              />
              <span
                className="bullets__tick"
                style={{ left: `${TICK_AT * 100}%` }}
                aria-hidden="true"
              />
              {f.hardAt != null && (
                <span
                  className="bullets__hardtick"
                  style={{ left: `${barPct(f.hardAt, f.threshold)}%` }}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="bullets__num">{f.value}</span>
            {/* The number a reader is judging the value against — which for the
                consecutive-day flag is the HARD limit, not the soft one. Its
                tick sits at the soft threshold (two days, a back-to-back, worth
                one flag), but the limit that ends the argument is three, and
                printing that one as "3 / 2" read like a score. */}
            <span className="bullets__of">/ {f.hardAt ?? f.threshold}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
