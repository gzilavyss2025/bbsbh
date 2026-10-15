import { Button } from './Button.jsx'

// THE STEPPER (ADR-0112) — previous, the current stop and next, in one ruled box:
// a day on the standings, a year on the postseason history. Two 44px Buttons
// around a label. Styled in styles/system/report/controls.css.
//
//   label         the current stop ("Sep 28"). It is read by a screen reader as the value.
//   prevLabel, nextLabel  the buttons' accessible names ("Previous day").
//   onPrev, onNext        the taps.
//   prevDisabled, nextDisabled  an end of the range.
//   className     the caller's namespace.
//
// It holds no state and computes nothing: the caller owns the date.
export function Stepper({
  label,
  prevLabel = 'Previous',
  nextLabel = 'Next',
  onPrev,
  onNext,
  prevDisabled = false,
  nextDisabled = false,
  className = '',
}) {
  return (
    <div className={`stepper ${className}`.trim()}>
      <Button skin="ghost" className="stepper__btn" aria-label={prevLabel} disabled={prevDisabled} onClick={onPrev}>
        ‹
      </Button>
      <span className="stepper__label" aria-live="polite">
        {label}
      </span>
      <Button skin="ghost" className="stepper__btn" aria-label={nextLabel} disabled={nextDisabled} onClick={onNext}>
        ›
      </Button>
    </div>
  )
}
