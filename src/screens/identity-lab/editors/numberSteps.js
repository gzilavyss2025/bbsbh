// Shift+Arrow on a numeric tuning field nudges by ten steps instead of one.
// The browser's own ArrowUp/ArrowDown handling is left alone — this only
// intercepts the shifted pair, which a number input otherwise ignores — so the
// plain arrows keep behaving exactly as they always have.
//
// Every knob in this lab is judged against the sticky preview beside it rather
// than typed to a known value, so the coarse step is what turns "type, look,
// retype" into holding a key and watching. `step` is the field's own fine step
// (1 for a pixel/percent offset, 0.01 for a scale).
export function shiftStepKeys(value, step, onChange) {
  return (event) => {
    if (!event.shiftKey) return
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const delta = step * 10 * (event.key === 'ArrowUp' ? 1 : -1)
    // Re-rounded to the step's own precision: 0.85 + 0.1 is 0.9500000000000001
    // in binary floating point, and that lands in a JSON store as-is.
    const decimals = Math.max(0, String(step).split('.')[1]?.length ?? 0)
    onChange(Number((Number(value) + delta).toFixed(decimals)))
  }
}
