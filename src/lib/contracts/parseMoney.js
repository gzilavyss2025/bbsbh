// Parses one cell from the historical contract CSVs
// (scripts/data/contracts/{arbitration,salaries,free_agency,extensions}.csv)
// into { amount, status, raw, years, guarantee }.
//
// THE RULE, same one ADR-0052 already set for Cot's out-year codes: a dollar
// is committed only when the source states a dollar. A cell that carries
// prose instead of a number is a STATUS, never an amount, and it never
// silently becomes 0 or gets thrown away. `status` is a closed enum so every
// caller can switch on it; `raw` always keeps the untouched source text, so
// nothing this function collapses together is actually lost.
//
// Every non-numeric value below was found by scanning the real 2026-08-27
// export of all four files (61 distinct raw strings across five money
// columns: arbitration.settled_salary, arbitration.club_offer,
// salaries.salary, free_agency.guarantee, free_agency.aav; extensions.csv's
// guarantee/aav are clean numbers, no prose). See test/parse-money.test.js
// for the full enumeration and the live-data coverage assertion.

// A pure numeric cell, once $ and thousands separators are stripped. Every
// plain-number cell in these files is already whole dollars (a $61.875M
// salary is written "61875000"), so no unit conversion happens here.
const NUMERIC = /^-?\d+(\.\d+)?$/

// A cell that means "nothing was stated" beyond an actually-empty string.
// Cot's writes this explicitly as "n/a" on a handful of rows; it carries the
// same amount (null) as a blank cell, so it folds into the same status. `raw`
// keeps the literal text either way.
const BLANK_TEXT = /^n\/a$/i

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

// An extension-shaped cell: Cot's writes a multi-year settlement as
// "<years> y/$<amount>[M] extn" (or "ext"/"extension"), sometimes as
// "<years> / $<amount> extn" with no "y", sometimes as "extn, <years>
// y/$<amount>", and sometimes as "<years> y+opt" with no dollar figure at
// all. Any cell already past the plain-numeric check that carries the
// keyword "extn"/"ext"/"extension", OR the "<years>.../$<amount>" shape
// itself (some rows drop the keyword and just write "2 y / $13.5"), is this
// status. A single settled arbitration year is always a plain number, so a
// year-count paired with a dollar figure only shows up here for a real
// multi-year deal.
const EXTENSION_KEYWORD = /\bextn?\b|\bextension\b/i
const YEARS_WITH_DOLLAR = /\d+\s*(?:yr|y)?\s*\/\s*\$/i
const YEARS = /(\d+)\s*(?:yr|y)\b|(\d+)\s*\/\s*\$/i
const DOLLAR_AMOUNT = /\$\s*([\d.]+)\s*m?/i
const EXTENSION_MILLION = 1_000_000

function parseExtension(trimmed) {
  const yearsMatch = trimmed.match(YEARS)
  const years = yearsMatch ? Number(yearsMatch[1] ?? yearsMatch[2]) : null
  const dollarMatch = trimmed.match(DOLLAR_AMOUNT)
  const guarantee = dollarMatch ? Math.round(Number(dollarMatch[1]) * EXTENSION_MILLION) : null
  return { years, guarantee }
}

// The base shape every call returns. `years`/`guarantee` stay null unless a
// 'settled-as-extension' cell states them.
function result(amount, status, raw, extra) {
  return { amount, status, raw, years: extra?.years ?? null, guarantee: extra?.guarantee ?? null }
}

export function parseMoneyCell(raw) {
  const trimmed = String(raw ?? '').trim()

  if (trimmed === '' || BLANK_TEXT.test(trimmed)) {
    return result(null, 'blank', raw)
  }

  const numeric = trimmed.replace(/[$,]/g, '')
  if (NUMERIC.test(numeric)) {
    return result(Number(numeric), null, raw)
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
    return result(null, 'settled-as-extension', raw, parseExtension(trimmed))
  }

  // The loud fallback. A future export that adds a new prose form lands
  // here, keeps its raw text, and shows up as a nonzero count in
  // test/parse-money.test.js's live-data assertion instead of silently
  // reading as 0 or as one of the statuses above.
  return result(null, 'unparsed', raw)
}
