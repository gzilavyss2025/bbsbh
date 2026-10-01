// Shared CLI arg parsing + trailing-window date math for the gen-*.mjs
// generators.
//
// parseArgs reads `--flag=value` as a string and a bare `--flag` as `true`.
// gen-rookies-backfill and gen-run-expectancy keep a stricter local copy that
// ignores a bare `--flag`, so a mistyped value flag still falls back to its default.
import { parseArgs as nodeParseArgs } from 'node:util'

export const parseArgs = (args) => ({ ...nodeParseArgs({ args, strict: false }).values })

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
