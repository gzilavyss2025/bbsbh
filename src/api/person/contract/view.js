// The Contract card's view model: one shard record in, one rendering plan out.
//
// WHY A VIEW MODEL AND NOT JSX. The card leads with a different fact for each
// kind of player — a runway to free agency for a player his club still
// controls, a dollar figure for a player who signed for one — and each of
// those readings is a claim about the CBA that has to be true. Deriving them
// here keeps every claim in a pure function the unit suite can hold to the
// rules below (test/contract-view.test.js).
//
// FOUR RULES ARE BAKED IN. Each one is a sentence the card must never print.
//
// 1. A DECLINED CLUB OPTION IS NOT FREE AGENCY. A player under six years of
//    service whose option is turned down goes to arbitration (or is
//    non-tendered) — he does not reach the market. Free agency is named only
//    when the shard's own out-years carry an FA code, and never as the thing a
//    declined option leads to.
// 2. THE ARBITRATION AND FREE-AGENCY YEARS COME FROM THE CODES. `firstArbYear`
//    is the first `A*` out-year and `faYear` is the `FA` one. Neither is
//    counted off 3.000 and 6.000 service, so a Super Two player — arbitration a
//    year early, four times instead of three — reads correctly with no special
//    case at all.
// 3. `OPT` DOES NOT SAY WHO HOLDS THE OPTION. The code is the same for a club
//    option, a player option and a mutual one. Only the free-text `terms`
//    separate them ("cl opt", "pl opt"), so an unexplained code is labeled
//    "Option year" and the sentence says "an option", not "a club option".
// 4. A PRE-ARBITRATION PAY RANK IS NOISE. Almost every player in that pool is
//    inside a few thousand dollars of the league minimum, so "85th of 216" is
//    an artifact of the sort, not a fact about the player. The rank is dropped
//    for that regime and the league-minimum foot line says the honest form of
//    the same thing.
//
// It sits in its own directory rather than beside person/contracts.js because
// that directory is at its file budget (ADR-0038, scripts/check-dir-size.mjs).

// How many runway segments the 440px column can hold before the strip starts
// to crowd. Over this, like years merge (four arbitration years become one
// "’27–’30") rather than the strip scrolling away out of sight.
const MAX_SEGMENTS = 6

// Years of service that reach free agency. Used ONLY to decide whether the
// arbitration fallback applies to a declined option — never to derive a year,
// which rule 2 above reserves for the out-year codes.
const FREE_AGENCY_SERVICE = 6

const ARB_CODE = /^A(\d+)$/i

const OPTION_HOLDERS = { cl: 'club', pl: 'player', m: 'mutual', v: 'vesting' }

const HOLDER_PHRASE = {
  club: { label: 'Club option', phrase: 'club option', article: 'a', plural: 'club options' },
  player: { label: 'Player option', phrase: 'player option', article: 'a', plural: 'player options' },
  mutual: { label: 'Mutual option', phrase: 'mutual option', article: 'a', plural: 'mutual options' },
  vesting: { label: 'Vesting option', phrase: 'vesting option', article: 'a', plural: 'vesting options' },
  unknown: { label: 'Option year', phrase: 'option', article: 'an', plural: 'options' },
}

function holderPhrase(holder) {
  return HOLDER_PHRASE[holder] ?? HOLDER_PHRASE.unknown
}

function fullYear(value) {
  const year = Number(value)
  if (!Number.isFinite(year)) return null
  return year < 100 ? 2000 + year : year
}

// A dollar figure short enough to sit inside a sentence or a runway segment.
// Written by hand rather than through Intl so the string is the same in every
// runtime the tests and the browser share.
function shortMoney(usd) {
  if (!Number.isFinite(usd)) return null
  const trim = (value) => String(Number(value.toFixed(1)))
  if (Math.abs(usd) >= 1e6) return `$${trim(usd / 1e6)}M`
  if (Math.abs(usd) >= 1e3) return `$${trim(usd / 1e3)}K`
  return `$${Math.round(usd)}`
}

// The out-year's status code, or null when the year carries real cash. Cot's
// writes the code in `cash`, and in a handful of records only in `cbt`.
function outYearCode(entry) {
  const raw = typeof entry?.cash === 'string' ? entry.cash : typeof entry?.cbt === 'string' ? entry.cbt : null
  return raw ? raw.trim() : null
}

function outYearCash(entry) {
  return Number.isFinite(entry?.cash) ? entry.cash : null
}

function codeKind(code) {
  if (!code) return 'guaranteed'
  if (ARB_CODE.test(code)) return 'arb'
  if (/^FA$/i.test(code)) return 'freeAgency'
  if (/opt/i.test(code)) return 'option'
  return 'unknown'
}

// ---- the free text -------------------------------------------------------
// Everything the codes cannot say lives in `terms`: how many years the deal
// runs, which years it guarantees, and who holds each option.

// The deal the record is ABOUT: how many years it runs and the last year it
// guarantees. Thirteen records carry two deals in one string — the season being
// played and the extension that follows it ("1 y/$785,000 (26) 7 y/$105
// (27-33)"). The LAST unit is the operative one, and it is the one
// `contractTotalUsd` already agrees with, so reading the first would put a
// finished deal's length beside the new deal's money.
function termUnit(terms) {
  const unit = /(\d+)\s*(?:y|yr|yrs|year|years)\b[^()]*\((\d{2,4})(?:\s*[-–]\s*(\d{2,4}))?\)/gi
  const units = [...(terms ?? '').matchAll(unit)]
  const last = units.at(-1)
  if (last) return { years: Number(last[1]), throughYear: fullYear(last[3] ?? last[2]) }
  const bare = /(\d+)\s*(?:y|yr|yrs|year|years)\b/i.exec(terms ?? '')
  return { years: bare ? Number(bare[1]) : null, throughYear: null }
}

// Option years as the terms state them: "+27 cl opt" and "+32-33 opts". A
// clause with no holder word ("+32-33 opts") yields `holder: null`, which is
// rule 3 — the card may not upgrade that to a club option.
function termOptions(terms) {
  const found = []
  const clause = /\+\s*(\d{2,4}(?:\s*[-–]\s*\d{2,4})?)\s*((?:[a-z]{1,4}\s+)?)opts?\b/gi
  for (const match of (terms ?? '').matchAll(clause)) {
    const holder = OPTION_HOLDERS[match[2].trim().toLowerCase()] ?? null // caps-js-exempt: matching a code, not casing a display name
    const [from, to] = match[1].split(/\s*[-–]\s*/).map(fullYear)
    for (let year = from; year <= (to ?? from); year++) found.push({ year, holder })
  }
  return found
}

// ---- runway --------------------------------------------------------------

function yearTick(year) {
  return `’${String(year).slice(-2)}`
}

function segmentLabel(startYear, endYear) {
  return startYear === endYear ? yearTick(startYear) : `${yearTick(startYear)}–${yearTick(endYear)}`
}

function segment(kind, startYear, endYear, detail, current = false) {
  return { key: `${kind}-${startYear}`, kind, startYear, endYear, label: segmentLabel(startYear, endYear), detail, current }
}

function currentKind(regime) {
  if (regime === 'pre_arb') return 'preArb'
  if (regime === 'arbitration') return 'arb'
  return 'guaranteed'
}

function outYearDetail(entry, optionsByYear) {
  const code = outYearCode(entry)
  const kind = codeKind(code)
  if (kind === 'arb') return `Arb ${ARB_CODE.exec(code)[1]}`
  if (kind === 'freeAgency') return 'Free agent'
  if (kind === 'option') return holderPhrase(optionsByYear.get(entry.year)).label
  if (kind === 'guaranteed') return shortMoney(outYearCash(entry))
  return code
}

// Merge every run of two or more neighboring segments of one kind. The current
// season is never merged away — it is the reader's foothold on the strip.
function mergeRuns(segments, kind) {
  const out = []
  for (const next of segments) {
    const last = out.at(-1)
    const mergeable = last && !last.current && !next.current && last.kind === kind && next.kind === kind
    if (!mergeable) {
      out.push(next)
      continue
    }
    out[out.length - 1] = {
      ...last,
      endYear: next.endYear,
      label: segmentLabel(last.startYear, next.endYear),
      detail: mergedDetail(kind, last, next),
    }
  }
  return out
}

function mergedDetail(kind, last, next) {
  if (kind === 'arb') {
    const first = /(\d+)/.exec(last.detail ?? '')?.[1]
    const final = /(\d+)/.exec(next.detail ?? '')?.[1]
    return first && final ? `Arb ${first}–${final}` : 'Arbitration'
  }
  if (kind === 'preArb') return 'Club sets pay'
  if (kind === 'option') return 'Option years'
  return `${next.endYear - last.startYear + 1} years`
}

function buildSegments(record, optionsByYear) {
  const season = Number(record.season)
  const outYears = record.outYears ?? []
  if (!Number.isFinite(season)) return []

  const segments = [segment(currentKind(record.regime), season, season, shortMoney(record.salaryUsd), true)]

  // Years the sheet skips between this season and its first out-year are years
  // the club still sets the salary for. Only a pre-arbitration record can have
  // them; anywhere else a gap is missing data, not an implied year.
  const firstOut = outYears[0]?.year
  if (record.regime === 'pre_arb' && Number.isFinite(firstOut) && firstOut > season + 1) {
    segments.push(segment('preArb', season + 1, firstOut - 1, 'Club sets pay'))
  }

  for (const entry of outYears) {
    if (!Number.isFinite(entry?.year)) continue
    segments.push(segment(codeKind(outYearCode(entry)), entry.year, entry.year, outYearDetail(entry, optionsByYear)))
  }

  let compressed = mergeRuns(segments, 'preArb')
  for (const kind of ['arb', 'option', 'guaranteed', 'unknown']) {
    if (compressed.length <= MAX_SEGMENTS) break
    compressed = mergeRuns(compressed, kind)
  }
  if (compressed.length > MAX_SEGMENTS) {
    const kept = compressed.slice(0, MAX_SEGMENTS - 1)
    const rest = compressed.slice(MAX_SEGMENTS - 1)
    kept.push({
      ...rest[0],
      kind: rest.at(-1).kind,
      endYear: rest.at(-1).endYear,
      label: segmentLabel(rest[0].startYear, rest.at(-1).endYear),
      detail: `${rest.length} more years`,
    })
    return kept
  }
  return compressed
}

// ---- sentences -----------------------------------------------------------

function subjectOf(record) {
  return record.club ? { name: `The ${record.club}`, plural: true } : { name: 'His club', plural: false }
}

function preArbSentence(subject, firstArbYear, faYear) {
  const parts = [`${subject.name} ${subject.plural ? 'set' : 'sets'} his salary for now.`]
  const arb = firstArbYear ? `From ${firstArbYear} arbitration raises it each winter` : null
  const fa = faYear ? `he can reach free agency after the ${faYear - 1} season` : null
  if (arb && fa) parts.push(`${arb}, and ${fa}.`)
  else if (arb) parts.push(`${arb}.`)
  else if (fa) parts.push(`He ${fa.replace(/^he /, '')}.`)
  return parts.join(' ')
}

function arbYearSentence(record, { subject, option, arbFallback, firstArbYear, faYear }) {
  const parts = [`Signed for ${record.season}.`]
  if (option) {
    const phrase = holderPhrase(option.holder)
    const held = `${subject.name} ${subject.plural ? 'hold' : 'holds'} ${phrase.article} ${phrase.phrase} for ${option.year}`
    parts.push(arbFallback
      ? `${held} — declined, his ${option.year} pay is set by arbitration instead.`
      : `${held} — declined, he is not under contract for ${option.year}.`)
  } else if (firstArbYear) {
    parts.push(`Arbitration sets his next salary in ${firstArbYear}.`)
  }
  if (faYear) {
    parts.push(option
      ? `Either way he can reach free agency after the ${faYear - 1} season.`
      : `He can reach free agency after the ${faYear - 1} season.`)
  }
  return parts.join(' ')
}

function optionClause(options) {
  if (!options.length) return null
  const holder = options.every((entry) => entry.holder === options[0].holder) ? options[0].holder : null
  const phrase = holderPhrase(holder)
  const years = options.map((entry) => entry.year)
  if (years.length === 1) return `It also carries ${phrase.article} ${phrase.phrase} for ${years[0]}.`
  const list = `${years.slice(0, -1).join(', ')} and ${years.at(-1)}`
  return `It also carries ${phrase.plural} for ${list}.`
}

// A deal whose guaranteed years are behind him is a deal his club EXTENDED by
// picking up an option, so the sentence may not say "signed through" a year in
// the past — nor count the year he is playing among the options still open.
function signedSentence(guaranteed, options, season) {
  const money = shortMoney(guaranteed.totalUsd)
  const spine = guaranteed.years && money ? `${guaranteed.years}-year, ${money}` : null
  const head = guaranteed.throughYear > season
    ? (spine
      ? `Signed through ${guaranteed.throughYear} — ${guaranteed.years} years, ${money}.`
      : `Signed through ${guaranteed.throughYear}.`)
    : (spine
      ? `The ${spine} deal is guaranteed through ${guaranteed.throughYear}.`
      : `The deal is guaranteed through ${guaranteed.throughYear}.`)
  const playing = options.find((entry) => entry.year === season)
  const phrase = playing ? holderPhrase(playing.holder) : null
  return [
    head,
    playing ? `He is playing ${season} on ${phrase.article} ${phrase.phrase}.` : null,
    optionClause(options.filter((entry) => entry.year > season)),
  ].filter(Boolean).join(' ')
}

// ---- ticker --------------------------------------------------------------

function serviceValue(service) {
  if (service?.years == null && service?.days == null) return null
  const parts = []
  if (service.years != null) parts.push(`${service.years} yr`)
  if (service.days != null) parts.push(`${service.days} d`)
  return `${service.approximate ? '~' : ''}${parts.join(' ')}`
}

function buildFacts(record, regime) {
  const service = serviceValue(record.service)
  const facts = []
  if (regime === 'preArb' && Number.isFinite(record.salaryUsd)) {
    facts.push({
      key: 'salary',
      label: 'This year',
      kind: 'money',
      value: record.salaryUsd,
      tag: record.estimated ? 'Est.' : null,
    })
  }
  if (service) {
    facts.push({ key: 'service', label: 'MLB service', kind: 'text', value: service, caption: `entering ${record.season}` })
  }
  if (record.options) {
    facts.push({ key: 'options', label: 'Minor-lg options', kind: 'text', value: `${record.options.remaining} of ${record.options.total}` })
  }
  if (regime !== 'preArb' && record.terms) {
    facts.push({ key: 'terms', label: 'Terms', kind: 'text', value: record.terms })
  }
  if (regime !== 'preArb' && record.agent) {
    facts.push({ key: 'agent', label: 'Agent', kind: 'text', value: record.agent })
  }
  return facts
}

// A pre-arbitration salary the club sets against a floor the CBA sets. Both
// readings need `payRank`: `onMinimum` says he is ON the floor, and its
// absence — the rank normalises a prorated figure up to the minimum — says he
// is above it. Without a rank, neither sentence can be supported.
function minimumFootnote(regime, payRank) {
  if (regime !== 'preArb' || !payRank) return null
  return payRank.onMinimum
    ? 'On the league minimum — the floor the CBA sets under every major-league salary.'
    : 'Above the league minimum, though the club still sets the figure.'
}

// ---- the view ------------------------------------------------------------

export function contractView(record) {
  if (!record) return null
  const outYears = record.outYears ?? []
  const options = termOptions(record.terms)
  const optionsByYear = new Map(options.map((entry) => [entry.year, entry.holder]))

  const arbYears = outYears.filter((entry) => codeKind(outYearCode(entry)) === 'arb')
  const firstArbYear = arbYears[0]?.year ?? null
  const faYear = outYears.find((entry) => codeKind(outYearCode(entry)) === 'freeAgency')?.year ?? null

  const { years, throughYear } = termUnit(record.terms)
  const regime = record.regime === 'signed' && years > 1
    ? 'signed'
    : record.regime === 'pre_arb'
      ? 'preArb'
      : arbYears.length || (record.regime === 'unknown' && years === 1)
        ? 'arbYear'
        : 'plain'

  const segments = buildSegments(record, optionsByYear)
  const subject = subjectOf(record)

  // The first option year the shard prices as an option, dressed with whatever
  // the terms say about who holds it.
  const optionEntry = outYears.find((entry) => codeKind(outYearCode(entry)) === 'option')
  const option = optionEntry ? { year: optionEntry.year, holder: optionsByYear.get(optionEntry.year) ?? null } : null

  // Rule 1: arbitration is the fallback for a declined option only when
  // something says he is still arbitration-eligible.
  const arbFallback = Boolean(
    arbYears.length ||
    record.regime === 'pre_arb' ||
    record.regime === 'arbitration' ||
    (Number.isFinite(record.service?.years) && record.service.years < FREE_AGENCY_SERVICE),
  )

  const guaranteed = {
    years,
    totalUsd: Number.isFinite(record.contractTotalUsd) ? record.contractTotalUsd : null,
    throughYear: throughYear
      ?? outYears.filter((entry) => outYearCash(entry) != null).at(-1)?.year
      ?? record.season,
  }

  // A bar needs a season the sheet prices in cash and nothing else. An option
  // year often carries a figure too — its buyout — and drawing that as a salary
  // is the one misreading this chart can produce, so a year whose `cash` or
  // `cbt` holds a CODE is an open zone whatever the other column says.
  const bars = [
    { year: record.season, salaryUsd: record.salaryUsd, current: true },
    ...outYears
      .filter((entry) => codeKind(outYearCode(entry)) === 'guaranteed')
      .map((entry) => ({ year: entry.year, salaryUsd: outYearCash(entry), current: false })),
  ].filter((bar) => Number.isFinite(bar.salaryUsd) && Number.isFinite(bar.year))

  // Years the deal reaches but does not price: an option year, or a code the
  // sheet writes in place of cash. They render as one flat "see terms" zone,
  // because a bar would encode a height nobody has stated. A year already
  // priced is not open — a club that picked up this season's option is paying
  // it, and the terms still call it an option.
  const barYears = new Set(bars.map((bar) => bar.year))
  const openYears = [...new Set([
    ...outYears
      .filter((entry) => ['option', 'unknown'].includes(codeKind(outYearCode(entry))))
      .map((entry) => entry.year),
    ...options.map((entry) => entry.year),
  ])].filter((year) => Number.isFinite(year) && !barYears.has(year)).sort((a, b) => a - b)

  const schedule = regime === 'signed' ? { bars, openYears } : null

  const sentence = regime === 'preArb'
    ? preArbSentence(subject, firstArbYear, faYear)
    : regime === 'arbYear'
      ? arbYearSentence(record, { subject, option, arbFallback, firstArbYear, faYear })
      : regime === 'signed'
        ? signedSentence(guaranteed, options, record.season)
        : null

  return {
    regime,
    season: record.season ?? null,
    club: record.club ?? null,
    firstArbYear,
    faYear,
    controlThrough: faYear ? faYear - 1 : null,
    segments,
    sentence,
    facts: buildFacts(record, regime),
    footnote: minimumFootnote(regime, record.payRank),
    // Rule 4: the pre-arbitration pool is bunched at the minimum, so its rank
    // is dropped rather than printed as if it separated anyone.
    payRank: regime === 'preArb' ? null : record.payRank ?? null,
    option,
    options,
    guaranteed: regime === 'signed' ? guaranteed : null,
    schedule,
  }
}
