import { chipsClassName, isChipPicked, nextChipValue } from '../../../lib/design/report/classes.js'
import { Button } from './Button.jsx'

// THE CHIP ROW (ADR-0112) — a filter or a scope you flip: a row of control-size
// outline Buttons that toggle (aria-pressed). Not a fourth control: each chip is
// a Button, and styles/system/report/controls.css only lays the row out.
//
//   label     the group's aria-label ("Division").
//   options   [{ value, label, count? }]. `count` is a mono figure after the label.
//   value     the picked value, or a list of them when `multiple`.
//   onChange  called with the new value (the tapped one, or the new list).
//   multiple  each chip toggles in a list; otherwise one pick replaces the last.
//   layout    'rail' (one row that scrolls sideways, the default) or 'wrap'. A
//             pick-one row that fills the width is Segmented.
//   className the caller's namespace.
//
// It computes and fetches nothing.
export function Chips({ label, options, value, onChange, multiple = false, layout = 'rail', className = '' }) {
  return (
    <div className={chipsClassName({ layout, className })} role="group" aria-label={label}>
      {options.map((o) => (
        <Button
          key={o.value}
          size="control"
          pressed={isChipPicked({ value: o.value, picked: value, multiple })}
          onClick={() => onChange?.(nextChipValue({ value: o.value, picked: value, multiple }))}
        >
          {o.label}
          {o.count != null && <span className="chips__count">{o.count}</span>}
        </Button>
      ))}
    </div>
  )
}
