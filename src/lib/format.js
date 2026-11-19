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

// Every dollar in the app: millions to one place, thousands under a million
// ($780k, not $0.8M). Rationale with the <Money> component, components/salaries/Money.jsx.
const millions = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const thousands = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function moneyLabel(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  if (Math.abs(value) < 1_000_000) return `$${thousands.format(Math.round(value / 1000))}k`
  return `$${millions.format(value / 1_000_000)}M`
}
