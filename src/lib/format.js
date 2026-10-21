// "3rd", "21st", "112th" — the innings viewer's one ordinal-suffix rule,
// shared so every half-inning label (nav, aria-labels, lineup/defense
// substitution tags) agrees on the same spelling.
export function ordinal(n) {
  return n + ordinalSuffix(n)
}

// The suffix alone ("rd" of "3rd"), for a figure that sets it in smaller type.
export function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0]
}
