// Shared CLI arg parsing + trailing-window date math for the gen-*.mjs
// generators.
//
import { parseArgs as nodeParseArgs } from 'node:util'

// parseArgs reads `--flag=value` as a string and a bare `--flag` as `true`.
// gen-rookies-backfill and gen-run-expectancy keep a stricter local copy that
// ignores a bare `--flag`, so a mistyped value flag still falls back to its default.

// Only `--` arguments count: a short flag or a stray word is ignored. A bare `--` is dropped too,
// because node's parser would stop at it and lose every flag after.
export const parseArgs = (argv) =>
  ({ ...nodeParseArgs({ args: argv.filter((a) => a.startsWith('--') && a !== '--'), strict: false }).values })

// A value flag's string, or undefined when it is absent or given bare (`--season` with no `=`),
// so the generator falls back to its default instead of reading `true` as 1.
export const strOpt = (args, name) => (typeof args[name] === 'string' ? args[name] : undefined)

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
