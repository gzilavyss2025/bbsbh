// Parses one `mls` cell from scripts/data/contracts/salaries.csv into
// { years, days, totalDays, exact, status, raw }.
//
// Baseball writes major-league service time as YEARS.DAYS, where a full
// service year is 172 days and the day part is normally zero-padded to three
// digits: `4.078` is 4 years 78 days. This column does NOT keep that padding,
// and the reason it does not is the whole of this file.
//
// THE MECHANISM. The column went through a float round-trip somewhere upstream,
// and a float drops trailing zeros from the fractional part. `.100` came out
// `.1`, `.120` came out `.12`, `.078` kept all three digits because its last
// digit is not a zero, and `.000` collapsed to a bare integer with no decimal
// point at all. Every observation in the real export follows from that one
// mechanism and nothing else does:
//   - 19,308 populated cells: 16,382 dotted, 2,926 bare integers (15.2%), and
//     zero cells in any other shape.
//   - NO cell anywhere reads "X.000". There is nowhere else for those cells to
//     have gone.
//   - Decimal-part lengths are 1 (123 cells), 2 (1,569), 3 (14,549), 4 (1) and
//     15 (140). Nothing else.
//   - All 123 one-digit decimals are the digit "1", never 2 through 9 -- only
//     `.100` can land in one digit, because `.200` would be a 200-day season.
//   - The two-digit decimals are exactly 16 values: 01-09 and 11-17. That is
//     the multiples of ten from 010 to 170, minus 100 (which is one digit) and
//     nothing above 170. A stripped-zeros reading predicts that set exactly.
//   - Of the 14,549 three-digit cells the largest day part is 171, and none
//     exceeds 172.
// So the reconstruction below is not a guess about what a cell means. Padding a
// stripped decimal back out to three digits recovers the day count the source
// wrote down.
//
// THE 15-DIGIT CELLS are the same round-trip showing its working: "4.171000000000001"
// is 4 years 171 days that failed to land on a representable binary fraction.
// 140 cells carry that shape. Rounding the fraction back to three places
// recovers the day count.
//
// THE 4-DIGIT CELL is one cell: Tim Beckham, 2015, "0.0145". It is a
// data-entry typo -- a stray leading zero over `145` -- and not a fourth
// notation. His own rows prove it: 2014 `0.012`, 2015 `0.0145`, 2016 `1.145`.
// Reading 2015 as 0 years 145 days makes 2015 -> 2016 a gain of exactly 172
// days, which is a textbook full season. Reading it any other way does not.
//
// ------------------------------------------------------------------ `exact`
// THE FLAG IS NOT ABOUT THE STRING. A bare integer is not ambiguous. It denotes
// N years and 0 days, unambiguously, because `.000` is the one day count the
// float round-trip erases. `exact: false` says something different and worse:
//
//   this cell denotes N.000, but a meaningful subset of bare integers
//   MISSTATE the real accrued days, so never use a bare cell to decide
//   whether a man crossed a service threshold.
//
// That is the whole point of the flag. It survives because of a separate
// analysis (docs/service-time-debut-clock.md) that compared these cells to
// wire-verified roster-add dates. Among the men who PROVABLY banked less than a
// full service year, 11 of 18 bare-integer cells wrongly read "1" or higher,
// against 12 of 2,175 day-count cells (0.6%). A wrong bare "1" cannot come out
// of the trailing-zero mechanism at all -- a true `0.138` has no trailing zero
// to strip -- so those cells come from a different and cruder source, most
// likely a "springs since debut" heuristic that happens to produce the same
// bare-integer spelling. The right cells and the wrong ones are spelled
// identically, so no per-cell rule can separate them. `exact: false` is the
// only warning a caller gets.
//
// `days`, `years` and `totalDays` are still returned for a bare cell, because
// dropping them would lose the years the source did state. `exact` is what a
// threshold test must read.

// A day part, once the decimal point is split off. Four reconstructions, keyed
// by length, each recovering the three-digit value the round-trip left behind.
const ONE_DIGIT_DAYS = 100
const TWO_DIGIT_SCALE = 10
const FLOAT_ARTIFACT_LENGTH = 15
const TYPO_LENGTH = 4
const DAYS_PER_SERVICE_YEAR = 172

// A cell of the ordinary shape: an integer year part, a decimal point, and a
// decimal part of digits. Anything outside this (or a bare integer) is a shape
// nobody has read yet and falls to 'unparsed' below rather than being guessed.
const DOTTED = /^(\d+)\.(\d+)$/
const BARE_INTEGER = /^\d+$/

// Returns the day count a decimal part stands for, or null if its length is a
// shape this file has never seen in the real export.
function reconstructDays(decimal) {
  switch (decimal.length) {
    case 1:
      // Only ".1" ever appears here, and only ".100" can produce it.
      return Number(decimal) * ONE_DIGIT_DAYS
    case 2:
      // "01".."09" and "11".."17" -- the multiples of ten, zero stripped.
      return Number(decimal) * TWO_DIGIT_SCALE
    case 3:
      // The untouched majority: a day count that kept its own padding because
      // its last digit is not a zero.
      return Number(decimal)
    case TYPO_LENGTH:
      // The single Tim Beckham cell. A stray leading zero, dropped.
      return Number(decimal.slice(1))
    case FLOAT_ARTIFACT_LENGTH:
      // "171000000000001" -> 171. The fraction rounds back to three places.
      return Math.round(Number(`0.${decimal}`) * 1000)
    default:
      return null
  }
}

// The base shape every call returns. A blank cell states nothing, so it states
// nothing about `exact` either -- null, never false, because "no service time
// recorded" and "a service figure that may be wrong" are different facts and a
// caller must be able to tell them apart.
function result(years, days, exact, status, raw) {
  return {
    years,
    days,
    totalDays: years === null ? null : years * DAYS_PER_SERVICE_YEAR + days,
    exact,
    status,
    raw,
  }
}

export function parseServiceTime(raw) {
  const trimmed = String(raw ?? '').trim()

  // Every row before 2010 has an empty `mls`, and 71 rows after it do
  // (docs/contracts-data-caveats.md). A blank is a coverage window, not a zero.
  if (trimmed === '') return result(null, null, null, 'blank', raw)

  const dotted = trimmed.match(DOTTED)
  if (dotted) {
    const days = reconstructDays(dotted[2])
    if (days !== null) {
      const status =
        dotted[2].length === FLOAT_ARTIFACT_LENGTH
          ? 'float-artifact'
          : dotted[2].length === TYPO_LENGTH
            ? 'stray-leading-zero'
            : null
      return result(Number(dotted[1]), days, true, status, raw)
    }
  }

  // A bare integer: N years, 0 days. See `exact` above for why the number is
  // returned and the flag still says do not trust it.
  if (BARE_INTEGER.test(trimmed)) {
    return result(Number(trimmed), 0, false, 'bare-integer', raw)
  }

  // The loud fallback, the same one parseMoney.js keeps. A future export that
  // writes a decimal length or a shape this file has never seen lands here and
  // shows up as a nonzero count in test/parse-service-time.test.js's live-data
  // sweep, instead of quietly reading as some plausible number of days.
  return result(null, null, null, 'unparsed', raw)
}
