// The pure half of scripts/gen-notable.mjs, part 6: the flags.
import { FIRST_SEASON } from './rules.mjs'

const VALUE_FLAGS = ['season', 'from', 'to', 'out']

// lib/args.mjs reads `--flag=value`. A bare `--season 2025` would read as `true` and drop
// the year, so the space form is joined first. Both forms work.
export function normalizeArgv(argv) {
  const out = []
  for (let i = 0; i < argv.length; i += 1) {
    const flag = /^--(.+)$/.exec(argv[i])?.[1]
    if (VALUE_FLAGS.includes(flag) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      out.push(`--${flag}=${argv[i + 1]}`)
      i += 1
    } else out.push(argv[i])
  }
  return out
}

const asSeason = (flag, value, last) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < FIRST_SEASON || n > last) {
    throw new Error(`--${flag} takes a year from ${FIRST_SEASON} to ${last}, not "${value}"`)
  }
  return n
}

// `parsed` is lib/args.mjs parseArgs of the normalized flags. `inPlay` is the season in
// play (lib/time/season-in-play.mjs): the default, and the last season a run may sweep.
// -> the seasons to sweep, oldest first.
export function seasonsFromArgs(parsed, inPlay) {
  const { season, from, to } = parsed
  if (season !== undefined && (from !== undefined || to !== undefined)) {
    throw new Error('use --season, or --from with --to, not both')
  }
  if (season !== undefined) return [asSeason('season', season, inPlay)]
  if (from === undefined && to === undefined) return [inPlay]
  const first = from === undefined ? FIRST_SEASON : asSeason('from', from, inPlay)
  const last = to === undefined ? inPlay : asSeason('to', to, inPlay)
  if (first > last) throw new Error(`--from ${first} is after --to ${last}`)
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

// A flag the generator does not know is a typo that would run the default season.
export function unknownFlags(parsed) {
  return Object.keys(parsed).filter((k) => !VALUE_FLAGS.includes(k))
}
