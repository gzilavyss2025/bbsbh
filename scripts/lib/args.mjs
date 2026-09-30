// Shared CLI arg parsing + trailing-window date math for the gen-*.mjs
// generators.
//
// parseArgs reads `--flag=value` as a string and a bare `--flag` as `true`.

export function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) args[m[1]] = m[2]
    else if (a.startsWith('--')) args[a.slice(2)] = true
  }
  return args
}

export const isoDay = (d) => d.toISOString().slice(0, 10)

// --since/--until override; otherwise a trailing window of `defaultDays`
// (or args.days) ending today.
export function dateRange(args, defaultDays) {
  const today = new Date()
  if (args.since) return { startDate: args.since, endDate: args.until || isoDay(today) }
  const days = Number(args.days) || defaultDays
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { startDate: isoDay(start), endDate: isoDay(today) }
}
