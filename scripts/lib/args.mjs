// Shared CLI arg parsing + trailing-window date math for the incremental
// gen-*.mjs sweepers (gen-fouls.mjs, gen-pitch-arsenal.mjs,
// gen-umpire-accuracy.mjs) — byte-identical before this extraction.
//
// parseArgs requires `--flag=value` (a bare `--flag` becomes `true`). This is
// a STRICTER regex than gen-comeback-wins.mjs/gen-jerseys.mjs's own
// parseArgs (`/^--([^=]+)(?:=(.*))?$/`, `=` optional) — those two scripts
// keep their own copy rather than being folded in here, since switching their
// regex would change how they parse a bare `--flag` (currently `undefined`
// under this stricter form vs. `true` under theirs).

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
