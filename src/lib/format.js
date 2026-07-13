// "3rd", "21st", "112th" — the innings viewer's one ordinal-suffix rule,
// shared so every half-inning label (nav, aria-labels, lineup/defense
// substitution tags) agrees on the same spelling.
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
