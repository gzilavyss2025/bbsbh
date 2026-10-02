import { Pill } from '../ui/control/Pill.jsx'

// ONE LABELLED ROW OF CHOICES on the Matchup Scout (View, Scope, and the
// prototype's Hand and Metric): Pill controls in a named group, the selected
// one `aria-pressed`, the same chips CommandMap uses. `options` is
// [[value, label], ...]. `disabledKey` turns one option off (a switch
// hitter's "All" hands, Gary item 1).
export function Choice({ label, options, value, onChange, disabledKey }) {
  return (
    <div className="scout__control" role="group" aria-label={label}>
      <span className="scout__controllabel">{label}</span>
      {options.map(([k, text]) => (
        <Pill
          key={String(k)}
          role="control"
          fill="paper"
          pressed={value === k}
          disabled={disabledKey !== undefined && k === disabledKey}
          onClick={() => onChange(k)}
        >
          {text}
        </Pill>
      ))}
    </div>
  )
}
