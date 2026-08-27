// Parses one cell from the historical contract CSVs
// (scripts/data/contracts/{arbitration,salaries,free_agency,extensions}.csv)
// into { amount, status, raw, years, guarantee, detailsAmount }.
//
// THE RULE, same one ADR-0052 already set for Cot's out-year codes: a dollar
// is committed only when the source states a dollar. A cell that carries
// prose -- or a numeric SENTINEL standing in for missing money -- is a
// STATUS, never an amount, and it never silently becomes 0 or gets thrown
// away. `status` is a closed enum so every caller can switch on it; `raw`
// always keeps the untouched source text, so nothing this function
// collapses together is actually lost.
//
// Every non-numeric value below was found by scanning the real 2026-08-27
// export of all four files: 76 distinct raw strings across NINE money
// columns -- arbitration.prior_salary, arbitration.player_request,
// arbitration.club_offer, arbitration.settled_salary, salaries.salary,
// free_agency.guarantee, free_agency.aav, extensions.guarantee,
// extensions.aav (the last four of those nine are clean numbers, no prose).
// PLUS one numeric sentinel that scan could not have caught by construction
// (it looks like a real number): free_agency.csv writes "1" in guarantee
// (and sometimes aav) to flag a minor-league deal -- 1,156 rows, 20.7% of
// the file. See test/parse-money.test.js for the full enumeration and the
// live-data coverage assertion, which runs over all nine prose columns plus
// this sentinel.
//
// `column` (second, optional argument) matters for two shapes:
//   - a multi-year figure: in `settled_salary` (and `club_offer`, which this
//     source sometimes uses to flag "the case settled as an extension"
//     rather than to carry a counter-number) it IS the deal that happened --
//     'settled-as-extension'. In `player_request` the same shape is what
//     the player FILED, not what got settled, so it reads as
//     'multi-year-request' instead.
//   - the "1" sentinel: only `guarantee` and `aav` use it. Every other
//     column reads a bare "1" as the number one dollar -- which never
//     actually happens in this data, but this function has no business
//     assuming a column it hasn't been told about follows free_agency's
//     convention.
//
// `context` (third, optional argument) supplies the sibling-column facts the
// sentinel needs to classify itself: `{ years, details }` from the SAME row.
// A cell-only function can't see those on its own -- `years` says whether
// this is the standard minor-league pattern, and `details` is Cot's
// free-text column, which states the real major-league salary on 853 of the
// 858 sentinel rows that carry any detail at all ("$1M in majors"). That
// recovered figure goes in `detailsAmount`, a field of its own -- NEVER
// into `amount` or `guarantee`. A number the source stated in a money
// column and a number this function inferred from prose must never be
// confused by a downstream reader, so `detailsAmount` is the only place a
// mined figure is allowed to live.

// A pure numeric cell, once $ and thousands separators are stripped. Every
// plain-number cell in these files is already whole dollars (a $61.875M
// salary is written "61875000"), so no unit conversion happens here.
const NUMERIC = /^-?\d+(\.\d+)?$/

// A cell that means "nothing was stated" beyond an actually-empty string.
// Cot's writes this as "n/a" on a handful of rows and as a bare "-" on
// arbitration.prior_salary; both carry the same amount (null) as a blank
// cell, so they fold into the same status. `raw` keeps the literal text
// either way.
const BLANK_TEXT = /^n\/a$/i
const BLANK_DASH = /^-+$/

// arbitration.prior_salary's "A3": the same A1..A4 arbitration-class-year
// vocabulary scripts/lib/salaries.mjs's cellFor() already reads off Cot's
// out-year columns (ADR-0052) -- the player's PRIOR season was itself an
// unsettled arbitration year, not a dollar figure.
const ARBITRATION_CODE = /^A\d+$/i

// arbitration.prior_salary's "?  $700,000": the source states a figure but
// flags its own uncertainty about it with a leading "?". Coercing this to
// null would throw away a number the source actually wrote down, so `amount`
// carries the parsed figure -- 'unconfirmed' is what marks it as hedged
// rather than a plain settled number.
const UNCONFIRMED = /^\?\s*\$?([\d,]+(?:\.\d+)?)$/

// ------------------------------------------------- the guarantee/aav sentinel
// free_agency.csv writes "1" in `guarantee` (and, on a 39-row subset, `aav`
// too) to flag a minor-league deal rather than a real dollar figure --
// verified against the source: 1,153 of the 1,156 "1" rows carry years="0",
// and interpreting "1" as a literal dollar (what NUMERIC would otherwise do)
// swings the 2020 free-agent guarantee median from $6.1M to $3.0M. Only
// `guarantee`/`aav` get this reading -- a bare "1" in any other column is
// just the number one.
const SENTINEL_COLUMNS = new Set(['guarantee', 'aav'])
const GUARANTEE_SENTINEL = '1'

// The 3 rows (of 1,156) where "1" does NOT pair with years="0", found by
// checking every one individually rather than assuming they are more
// minor-league deals:
//   - Lee, Travis (2006, TBA): years="1", details="accepted salary
//     arbitration" -- he never signed a new free-agent deal at all, so
//     there is no guarantee to state. 'accepted-arbitration'.
//   - Hawkins, LaTroy (2013, NYN): years="1", details="$1,000,000 in
//     majors" -- a real one-year deal; "1" is not the minor-league flag
//     here, but the structured cell still isn't usable as a dollar amount,
//     so it reads the same as the row below, and the real figure comes
//     back through `detailsAmount`.
//   - Bundy, Dylan (2023, NYN): years="" (blank, not "0"), details="" --
//     no corroborating field either way. Same non-standard reading; nothing
//     to mine.
const ACCEPTED_ARBITRATION = /accepted\s+(?:salary\s+)?arbitration/i

// Cot's free-text note on a minor-league-deal row, almost always shaped
// "$<amount>[M|million] [salary ]in majors" -- occasionally "in. majors" or
// "im majors" (both real typos in the source, tolerated here), sometimes
// followed by more prose ("$1.3M in majors, 3/21/19 opt-out") this doesn't
// need to parse. Deliberately does NOT match an "in minors" figure -- that
// is a different, smaller number, not the recovered majors salary this
// function is looking for. Verified against the real export: 858 of 1,156
// sentinel rows carry a details string, and this pattern recovers 853 of
// them; the other 5 are "$X in minors" (no majors figure to recover),
// "retired after signing", and "accepted salary arbitration" (Lee, above)
// -- left unrecovered on purpose rather than guessed at.
const DETAILS_MAJORS = /\$\s*([\d,]+(?:\.\d+)?)\s*(m(?:illion)?)?\s*\w*\s*(?:salary\s+)?i[mn]\.?\s+majors?/i

function mineDetailsAmount(details) {
  const match = String(details ?? '').match(DETAILS_MAJORS)
  if (!match) return null
  let n = Number(match[1].replace(/,/g, ''))
  if (match[2]) n *= EXTENSION_MILLION
  return Math.round(n)
}

function classifySentinel(raw, context) {
  const detailsAmount = mineDetailsAmount(context?.details)
  if (context?.years === '0') {
    return result(null, 'minor-league-deal', raw, { detailsAmount })
  }
  if (ACCEPTED_ARBITRATION.test(String(context?.details ?? ''))) {
    return result(null, 'accepted-arbitration', raw, { detailsAmount })
  }
  // Hawkins and Bundy above: the sentinel shape without the standard
  // years="0" pattern and without an arbitration-acceptance note. Neither
  // gets swept into 'minor-league-deal' -- whatever this row actually is,
  // it isn't the majority pattern, and `detailsAmount` still carries
  // whatever the free text recovers (Hawkins' $1,000,000; null for Bundy).
  return result(null, 'flagged-guarantee', raw, { detailsAmount })
}

// One-off statuses that are a single fixed phrase, case-insensitive, with no
// dollar figure anywhere in the cell. Each is a real transaction or contract
// event Cot's records instead of a settled number:
//   - forfeited            -- salaries.salary's one prose value
//   - outrighted           -- assigned outright to the minors (also covers
//                             "outrighted-FA": outrighted, then the player
//                             exercised the right to free agency instead --
//                             the raw text keeps that detail, the status is
//                             the same underlying transaction)
//   - dfa                  -- designated for assignment
//   - non-tendered         -- club did not tender an arbitration contract
//   - released             -- released outright
//   - retired               -- player retired instead of settling
//   - waived               -- "lost on waivers"
//   - club-option           -- club_offer was a club option, no figure stated
//   - option-exercised      -- "exercised option"
//   - elected-free-agency   -- player elected free agency over the arb offer
const EXACT_STATUS = new Map([
  ['forfeited', 'forfeited'],
  ['outrighted', 'outrighted'],
  ['outrighted-fa', 'outrighted'],
  ['dfa', 'dfa'],
  ['non-tendered', 'non-tendered'],
  ['released', 'released'],
  ['retired', 'retired'],
  ['lost on waivers', 'waived'],
  ['club option', 'club-option'],
  ['exercised option', 'option-exercised'],
  ['elected fa', 'elected-free-agency'],
])

// A club_offer term stated as a season range ("2024-25") with no dollar
// figure -- the offer was described by which years it covered, not by an
// amount.
const TERM_ONLY = /^\d{4}-\d{2}$/

// free_agency.guarantee's three signings outside MLB (NPB/Mexican League).
// These are exact strings, not a pattern: a foreign club's name is not
// something to infer from shape, and a new one next year should fall to
// 'unparsed' (loud) rather than being guessed at by a regex that happens to
// match team-name-shaped text.
const OVERSEAS_SIGNINGS = new Set([
  'lotte giants, 1 y/$1m',
  'rakuten golden eagles, 1 y (26)',
  'signed by leones de yucatán',
])

// A multi-year-shaped cell: Cot's writes one as "<years> y/$<amount>[M]
// extn" (or "ext"/"extension"), sometimes as "<years> / $<amount> extn" with
// no "y", sometimes as "extn, <years> y/$<amount>", sometimes as "<years>
// y+opt" with no dollar figure at all, and in player_request as a bare
// "<years> y / $<amount>" with no keyword. Any cell already past the
// plain-numeric check that carries the keyword "extn"/"ext"/"extension", OR
// the "<years>.../$<amount>" shape itself, is this shape. A single settled
// arbitration year is always a plain number, so a year-count paired with a
// dollar figure only shows up for a real multi-year figure -- what STATUS
// that resolves to depends on which column it came from; see `column` above.
const EXTENSION_KEYWORD = /\bextn?\b|\bextension\b/i
const YEARS_WITH_DOLLAR = /\d+\s*(?:yr|y)?\s*\/\s*\$/i
const YEARS = /(\d+)\s*(?:yr|y)\b|(\d+)\s*\/\s*\$/i

// The dollar amount inside a multi-year cell. Comma-grouped ("$1,500,000")
// is a full figure already, never scaled. An explicit "M"/"million" suffix
// always means millions. A bare number with neither -- "$64", "$8.875" --
// keeps the convention every real extension string in this export already
// uses: unmarked numbers are millions. A bare number is only read as an
// already-whole dollar figure if it is too large to plausibly BE a
// millions figure (>= BARE_DOLLAR_FLOOR) -- no real multi-year deal in this
// dataset's history reaches a thousand million dollars.
//
// THE BUG THIS GUARDS AGAINST: the previous version's amount regex excluded
// "," from its character class, so "$1,500,000" matched only as far as
// "$1" -- and then multiplied THAT by a million unconditionally. "$700,000"
// read as $700,000,000 the same way, a 1000x error. Neither case reached
// 'unparsed': the multi-year SHAPE (years + a dollar sign) still matched,
// so the wrong number shipped silently under a status that looked correct.
// Every one of the 53 multi-year cells in today's real export happens to be
// written without commas, which is why this was latent rather than live --
// see test/parse-money.test.js for the regression cases that catch it now.
const DOLLAR_AMOUNT = /\$\s*([\d,]+(?:\.\d+)?)\s*(m(?:illion)?)?/i
const EXTENSION_MILLION = 1_000_000
const BARE_DOLLAR_FLOOR = 1_000

function parseMultiYear(trimmed) {
  const yearsMatch = trimmed.match(YEARS)
  const years = yearsMatch ? Number(yearsMatch[1] ?? yearsMatch[2]) : null
  const dollarMatch = trimmed.match(DOLLAR_AMOUNT)
  let guarantee = null
  if (dollarMatch) {
    const hasComma = dollarMatch[1].includes(',')
    const hasMillionSuffix = Boolean(dollarMatch[2])
    const n = Number(dollarMatch[1].replace(/,/g, ''))
    const alreadyWholeDollars = hasComma || (!hasMillionSuffix && n >= BARE_DOLLAR_FLOOR)
    guarantee = Math.round(alreadyWholeDollars ? n : n * EXTENSION_MILLION)
  }
  return { years, guarantee }
}

// The base shape every call returns. `years`/`guarantee`/`detailsAmount`
// stay null unless the cell (or, for `detailsAmount`, its row's `details`
// column) states them.
function result(amount, status, raw, extra) {
  return {
    amount,
    status,
    raw,
    years: extra?.years ?? null,
    guarantee: extra?.guarantee ?? null,
    detailsAmount: extra?.detailsAmount ?? null,
  }
}

export function parseMoneyCell(raw, column, context) {
  const trimmed = String(raw ?? '').trim()

  if (trimmed === '' || BLANK_TEXT.test(trimmed) || BLANK_DASH.test(trimmed)) {
    return result(null, 'blank', raw)
  }

  // Checked BEFORE the numeric branch: "1" is a syntactically valid number,
  // which is exactly how this sentinel used to slip through as amount: 1.
  if (SENTINEL_COLUMNS.has(column) && trimmed === GUARANTEE_SENTINEL) {
    return classifySentinel(raw, context)
  }

  const numeric = trimmed.replace(/[$,]/g, '')
  if (NUMERIC.test(numeric)) {
    return result(Number(numeric), null, raw)
  }

  const unconfirmed = trimmed.match(UNCONFIRMED)
  if (unconfirmed) {
    return result(Number(unconfirmed[1].replace(/,/g, '')), 'unconfirmed', raw)
  }

  if (ARBITRATION_CODE.test(trimmed)) {
    return result(null, 'arbitration-year', raw)
  }

  const exact = EXACT_STATUS.get(trimmed.toLowerCase())
  if (exact) {
    return result(null, exact, raw)
  }

  if (TERM_ONLY.test(trimmed)) {
    return result(null, 'term-only', raw)
  }

  if (OVERSEAS_SIGNINGS.has(trimmed.toLowerCase())) {
    return result(null, 'signed-overseas', raw)
  }

  if (EXTENSION_KEYWORD.test(trimmed) || YEARS_WITH_DOLLAR.test(trimmed)) {
    const status = column === 'player_request' ? 'multi-year-request' : 'settled-as-extension'
    return result(null, status, raw, parseMultiYear(trimmed))
  }

  // The loud fallback. A future export that adds a new prose form lands
  // here, keeps its raw text, and shows up as a nonzero count in
  // test/parse-money.test.js's live-data assertion instead of silently
  // reading as 0 or as one of the statuses above.
  return result(null, 'unparsed', raw)
}
