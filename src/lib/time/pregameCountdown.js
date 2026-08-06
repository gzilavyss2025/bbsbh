const SECOND_MS = 1000
const MINUTE_SECONDS = 60
const HOUR_SECONDS = 60 * MINUTE_SECONDS

// Pure wall-clock math for the pregame scoreboard. Its result is always
// derived from the absolute scheduled timestamp — callers never decrement a
// stored counter, so a backgrounded/throttled tab catches up immediately when
// it becomes visible again.
export function pregameCountdown(scheduledAt, now = Date.now()) {
  const target = Date.parse(scheduledAt ?? '')
  if (!Number.isFinite(target)) return { kind: 'tbd' }

  const remainingMs = target - Number(now)
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return { kind: 'passed' }
  }

  // Ceil keeps 00:00:01 on the board until the scheduled instant rather than
  // declaring the time reached while a fractional second still remains.
  const totalSeconds = Math.ceil(remainingMs / SECOND_MS)
  const hours = Math.floor(totalSeconds / HOUR_SECONDS)
  const minutes = Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS)
  const seconds = totalSeconds % MINUTE_SECONDS

  return {
    kind: 'countdown',
    totalSeconds,
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  }
}

// The visible board changes once a second, but assistive technology should not
// be asked to announce a clock tick forever. This deliberately rounds UP to a
// minute-level description; React leaves the hidden text node untouched until
// that wording actually changes.
export function accessiblePregameCountdown(clock) {
  if (clock?.kind === 'tbd') return 'The scheduled first pitch time has not been announced.'
  if (clock?.kind === 'passed') return 'The scheduled first pitch time has arrived. Waiting for the game to begin.'
  if (clock?.kind !== 'countdown') return ''

  if (clock.totalSeconds < MINUTE_SECONDS) return 'First pitch is scheduled in less than a minute.'

  const totalMinutes = Math.ceil(clock.totalSeconds / MINUTE_SECONDS)
  const hours = Math.floor(totalMinutes / MINUTE_SECONDS)
  const minutes = totalMinutes % MINUTE_SECONDS
  const parts = []
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  return `First pitch is scheduled in ${parts.join(' and ')}.`
}
