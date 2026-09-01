// The historical-contract LEDGER's view model — the pure half of the player
// page's Contract history card (components/player/ContractHistoryLedger.jsx).
// api/contractsHistory.js fetches and merges the rows (ADR-0067); everything
// that decides what a reader SEES is here, so a test can exercise it over the
// four real vocabularies without a browser.
//
// WHY THE TRANSLATION IS THE WORK. A merged row's `terms` is FOUR different
// vocabularies wearing one field name, and which one you get is told only by
// `sourceFile`:
//
//   salaries     { salary }
//   extensions   { years, guarantee, aav, first_year, final_year, option? }
//   free_agency  { years?, guarantee?, aav?, term?, option?, opt_out? }
//   arbitration  { prior_salary?, settled_salary?, club_offer?,
//                  player_request?, note? }
//
// Each source is handled by name below. There is no shared "money field" pass,
// because the same key means different things per source and a generic reader
// would print a filing figure as if it were a salary.
//
// FOUR RULES THE SOURCE DATA FORCES.
//
//  1. `terms` IS ALLOWED TO BE EMPTY, and often is — 3,974 of 27,349 salary
//     rows and 717 of 5,598 free-agency rows carry `{}`. An empty row is still
//     a fact (he was on a payroll that season; he reached free agency that
//     winter), so it renders with an honest `note` instead of a blank line.
//
//  2. A MONEY FIELD CAN HOLD A WORD. `settled_salary` reads "non-tendered" or
//     "outrighted" 100-odd times, `salary` reads "forfeited" once, and a
//     handful read a placeholder that means nothing at all ("n/a", "-", "?").
//     Words print as they are; placeholders are dropped, not printed.
//
//  3. `note` IS NOT RENDERED AT ALL. On an arbitration row it arrives as a
//     bare number and looks exactly like a settlement, but a separate audit
//     (issue #947) measured it against the settled salary on the rows carrying
//     both and found the two disagree about 95% of the time. Its real meaning
//     is unsettled, so the card says nothing rather than something wrong.
//
//  4. A FREE-AGENCY `guarantee` OF 1 IS A SENTINEL, NOT A DOLLAR — the
//     source's mark for a minor-league deal, on a fifth of that file. It is
//     read by its documented meaning, never by its size; see
//     isMinorLeagueSentinel below and docs/contracts-data-caveats.md.
//
// AND ONE RULE THE FILE FORMAT FORCES: `rowKey` is an OPAQUE STRING. It is a
// React key and a dedupe key, never a number and never a sort key. Its shape
// is a source-file name plus a separator plus an identifier, and the
// identifier's form is the generator's business, not this module's.

// `sourceFile` -> the kind this module reasons about. An unknown source is
// carried through as `unknown` rather than dropped: a row that exists should
// print its season and its club even when this file has never met its shape.
const KIND_BY_SOURCE = {
  salaries: 'salary',
  extensions: 'extension',
  free_agency: 'freeAgency',
  arbitration: 'arbitration',
}

const KIND_LABEL = {
  salary: 'Salary',
  extension: 'Extension',
  freeAgency: 'Free agency',
  arbitration: 'Arbitration',
  unknown: 'Contract',
}

// Reading order inside one season: the DEAL first, then what it paid. A club
// signs a player and a payroll line follows from it, so the ledger prints the
// cause above the consequence. Never a sort on `rowKey` — see the header.
const KIND_RANK = { extension: 0, freeAgency: 1, arbitration: 2, unknown: 3, salary: 4 }

// One money form for the whole card: $51M, $6.35M, $781K. It follows the
// contract card's own shortMoney (person/contract/view.js) rather than the
// salary board's fixed one decimal, because an arbitration settlement is a
// figure to the dollar and $6.35M and $6.4M are not the same number. Trailing
// zeros are trimmed, so a round guarantee reads as the round number it is.
//
// Written by hand rather than through Intl, and defined here rather than
// imported from components/salaries/Money.jsx, for two reasons: the string is
// then identical in the test runtime and the browser, and src/api never
// imports from src/components — the data layer cannot depend on a component.
export function shortMoney(usd) {
  if (!Number.isFinite(usd)) return null
  const trim = (value, places) => String(Number(value.toFixed(places)))
  if (Math.abs(usd) >= 1e6) return `$${trim(usd / 1e6, 2)}M`
  if (Math.abs(usd) >= 1e3) return `$${trim(usd / 1e3, 0)}K`
  return `$${Math.round(usd)}`
}

// A placeholder a source writes where it had nothing. "non-tendered" is an
// outcome and prints; "n/a" is an empty cell wearing letters and does not.
const PLACEHOLDER = /^(n\/a|na|none|-{1,2}|—|\?|tbd)$/i

// A term value that arrived as text rather than a figure, or null when the
// value is a number, missing, or one of the placeholders above.
function termText(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return !text || PLACEHOLDER.test(text) ? null : text
}

function termNumber(value) {
  return Number.isFinite(value) ? value : null
}

// A last-resort floor under a money cell: no contract in this record is for
// less than ten dollars, so a figure that small is a cell that did not parse.
// It catches NOTHING in the data as it stands — the one case that used to trip
// it is the minor-league sentinel below, which is now read by its documented
// meaning instead of by its size. The floor stays as a guard against a future
// broken cell, not as an explanation of a known one.
const MONEY_FLOOR = 10
function moneyNumber(value) {
  const amount = termNumber(value)
  return amount != null && Math.abs(amount) >= MONEY_FLOOR ? amount : null
}

// THE MINOR-LEAGUE SENTINEL. A free-agency `guarantee` of exactly 1 is not one
// dollar and not a missing value: it is the source's mark for a MINOR-LEAGUE
// DEAL, on 1,156 rows — 20.7% of free_agency.csv — and 1,153 of them carry
// `years: 0` beside it. It runs 1991 to 2023 and stops; no row after 2023 uses
// it. A split contract has no single guarantee to hold, which is why the column
// carries a mark rather than a number (docs/contracts-data-caveats.md).
//
// So the rule is the documented one — treat `guarantee = 1` as NO guarantee —
// and the card says what the mark means rather than printing "$1" or claiming
// the terms were never recorded. The real major-league rate is named in prose
// in the source's `details` cell on 858 of them; that column is not in the
// shipped shards (checked: zero rows here carry a `details` key), so this card
// does not show it and does not go looking for it.
const MINOR_LEAGUE_SENTINEL = 1
const MINOR_LEAGUE_LABEL = 'Minor-league deal'
function isMinorLeagueSentinel(kind, terms) {
  return kind === 'freeAgency' && terms.guarantee === MINOR_LEAGUE_SENTINEL
}

// A money term as one display string: the figure when it is a figure, the word
// when the source wrote a word, null when there is nothing to say.
function moneyOrWord(value) {
  return shortMoney(moneyNumber(value)) ?? termText(value)
}

const OPTION_WORD = {
  c: 'club',
  club: 'club',
  m: 'mutual',
  mutual: 'mutual',
  v: 'vesting',
  vesting: 'vesting',
  p: 'player',
  player: 'player',
  cond: 'conditional',
  conditional: 'conditional',
}

// The option codes both deal sources write, spelled out. Extensions use single
// letters with an optional count ("c", "c (2)", "m v"); free agency writes the
// words already ("club", "mutual", "player (2)"). A code this map has never met
// prints VERBATIM rather than being guessed at — a wrong word here would state
// a contract term that is not in the data.
export function optionLabel(raw) {
  const text = termText(raw)
  if (!text) return null
  const counted = text.match(/^([a-z]+)\s*\((\d+)\)$/i)
  if (counted) {
    const word = OPTION_WORD[counted[1].toLowerCase()]
    const count = Number(counted[2])
    if (word) return count > 1 ? `${count} ${word} options` : `${word} option`
    return text
  }
  // "m v", "p/c", "c / v" — two holders on one deal.
  const parts = text.split(/[\s/,]+/).filter(Boolean)
  const words = parts.map((part) => OPTION_WORD[part.toLowerCase()])
  if (words.every(Boolean)) {
    return words.length === 1 ? `${words[0]} option` : `${words.join(' + ')} options`
  }
  return text
}

// The seasons a deal covers, as the source states them. Extensions carry a
// first/final pair; free agency carries a `term` that is either a span
// ("2024-25") or a single year (2022, as a number).
function coversLabel(terms) {
  const first = termNumber(terms.first_year)
  const final = termNumber(terms.final_year)
  if (first && final) return first === final ? `${first}` : `${first}-${final}`
  if (first) return `${first}`
  const term = terms.term
  if (Number.isFinite(term)) return `${term}`
  return termText(term)
}

// "3 yr · $51M" — how long, and for how much. Either half can be missing, and
// a zero-year row (a handful of 1990s free-agency rows parse that way) prints
// only the money, since "0 yr" is not a claim the data supports.
function dealHeadline(terms) {
  const years = termNumber(terms.years)
  const guarantee = moneyOrWord(terms.guarantee)
  const yearText = years && years > 0 ? `${years} yr` : null
  if (yearText && guarantee) return `${yearText} · ${guarantee}`
  return yearText ?? guarantee
}

// A supporting fact. `k` is null for a fact that is already a phrase — an
// option holder or an opt-out reads as "club option", and labelling that one
// "Option club option" says the word twice.
function detail(k, v) {
  return v == null ? null : { k, v }
}

// One merged row as the card draws it. `headline` is the figure or phrase to
// read first, `details` the supporting facts, and `note` the honest sentence
// that stands in when a row carries no terms at all.
export function contractRowView(row) {
  if (!row) return null
  const kind = KIND_BY_SOURCE[row.sourceFile] ?? 'unknown'
  const terms = row.terms && typeof row.terms === 'object' ? row.terms : {}
  const base = {
    key: String(row.rowKey ?? ''),
    kind,
    label: KIND_LABEL[kind],
    season: Number.isFinite(row.season) ? row.season : null,
    teamId: row.teamId ?? null,
    confidence: row.confidence ?? null,
    headline: null,
    amount: null,
    details: [],
    note: null,
  }

  if (kind === 'salary') {
    const paid = moneyOrWord(terms.salary)
    return {
      ...base,
      headline: paid,
      amount: moneyNumber(terms.salary),
      note: paid ? null : 'Salary not recorded',
    }
  }

  if (kind === 'extension' || kind === 'freeAgency') {
    const minorLeague = isMinorLeagueSentinel(kind, terms)
    const headline = minorLeague ? MINOR_LEAGUE_LABEL : dealHeadline(terms)
    const details = [
      // A sentinel row's per-year figure goes with its guarantee: 39 of the 40
      // that carry one read `1` a second time, and the fortieth has no
      // guarantee left for it to be an average of.
      detail('Per year', minorLeague ? null : shortMoney(moneyNumber(terms.aav))),
      detail('Covers', coversLabel(terms)),
      detail(null, optionLabel(terms.option)),
      detail(null, optOutLabel(terms.opt_out)),
    ].filter(Boolean)
    return {
      ...base,
      headline,
      amount: minorLeague ? null : moneyNumber(terms.guarantee),
      details,
      // The note tracks the HEADLINE, not the details: a row that knows only
      // which seasons a deal covered still has no money in it, and "Covers
      // 2023" alone does not say so.
      note: headline ? null : 'Terms not recorded',
    }
  }

  if (kind === 'arbitration') return arbitrationView(base, terms)
  return base
}

// "Y" / "yes" / 1 all mean the deal carries one; a number above one is how many.
function optOutLabel(value) {
  const count = termNumber(value)
  if (count) return count > 1 ? `${count} opt-outs` : 'opt-out'
  return termText(value) ? 'opt-out' : null
}

// An arbitration row states an OUTCOME and, separately, what each side filed.
// The outcome is `settled_salary` when the case settled on a figure, the word
// in `settled_salary` when it ended some other way ("non-tendered"), and the
// word in `club_offer` when only that column carries one — the shape of a row
// where the club moved on before a hearing.
//
// `note` is read by nothing here. See rule 3 in this file's header.
function arbitrationView(base, terms) {
  const settledMoney = shortMoney(moneyNumber(terms.settled_salary))
  const settledWord = termText(terms.settled_salary)
  const clubMoney = shortMoney(moneyNumber(terms.club_offer))
  const clubWord = termText(terms.club_offer)
  // Only a FIGURE settles: "Settled $6.35M" is a settlement, "Settled
  // non-tendered" is not a sentence and not what happened.
  const outcome = settledMoney ? `Settled ${settledMoney}` : (settledWord ?? clubWord)
  const details = [
    detail('Prior salary', moneyOrWord(terms.prior_salary)),
    detail('Club filed', clubMoney),
    // The club's own word, on the rare row where it is not already the outcome
    // printed above.
    detail('Club', clubWord && outcome !== clubWord ? clubWord : null),
    detail('Player filed', moneyOrWord(terms.player_request)),
  ].filter(Boolean)
  return {
    ...base,
    headline: outcome,
    amount: moneyNumber(terms.settled_salary),
    details,
    note: outcome ? null : 'Outcome not recorded',
  }
}

// The whole card: rows grouped into seasons, newest first, each season keeping
// the deal-before-salary order above. The incoming rows are already sorted
// season-descending by fetchPlayerContractHistory, and this re-groups rather
// than re-sorting them on anything of its own beyond that.
//
// A season's `teamId` is the first club any of its rows names — salary rows
// carry none at all (`teamId` is null on every one of them), so the club a
// season belongs to has to come from the deal beside it, and a season made of
// salary rows alone correctly has no club.
export function contractHistoryView(rows) {
  const views = []
  for (const row of rows ?? []) {
    const view = contractRowView(row)
    if (view) views.push(view)
  }

  const order = []
  const bySeason = new Map()
  for (const view of views) {
    const key = view.season == null ? 'unknown' : view.season
    if (!bySeason.has(key)) {
      bySeason.set(key, { season: view.season, teamId: null, rows: [] })
      order.push(key)
    }
    const group = bySeason.get(key)
    group.rows.push(view)
  }

  const seasons = order.map((key) => {
    const group = bySeason.get(key)
    // Array.prototype.sort is stable, so rows of equal kind keep the order the
    // merge handed over. The tie-break is therefore the incoming order, never
    // a row's own `key` — the rowKey is opaque (see this file's header).
    const sorted = [...group.rows].sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])
    return { ...group, rows: sorted, teamId: sorted.find((r) => r.teamId != null)?.teamId ?? null }
  })

  // Undated rows last, so a season the source never named cannot sit above a
  // season it did.
  seasons.sort((a, b) => {
    if (a.season == null) return b.season == null ? 0 : 1
    if (b.season == null) return -1
    return b.season - a.season
  })

  return { seasons, rows: views.length }
}
