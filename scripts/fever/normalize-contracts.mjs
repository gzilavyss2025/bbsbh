// Pure feed-shaping helpers shared by the generator and its fixture tests.
const REQUIRED_PLAYER_ID = /^\d+$/

function nullableNumber(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function nullableText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseOptions(value) {
  const match = nullableText(value)?.match(/^(\d+)\s*\/\s*(\d+)$/)
  return match ? { remaining: Number(match[1]), total: Number(match[2]) } : null
}

export function normalizeContractRecord(playerId, record) {
  const id = String(playerId)
  if (!REQUIRED_PLAYER_ID.test(id) || String(record?.player_id) !== id) {
    throw new Error(`feverbaseball contracts: invalid player id ${id}`)
  }

  const outYears = Object.entries(record.out_years ?? {})
    .map(([year, values]) => ({
      year: Number(year),
      cash: nullableNumber(values?.cash) ?? nullableText(values?.cash),
      cbt: nullableNumber(values?.cbt) ?? nullableText(values?.cbt),
    }))
    .filter((entry) => Number.isInteger(entry.year) && (entry.cash != null || entry.cbt != null))
    .sort((a, b) => a.year - b.year)

  return {
    playerId: Number(id),
    name: nullableText(record.mlbam_name) ?? nullableText(record.cots_name),
    season: nullableNumber(record.season),
    club: nullableText(record.club_name),
    clubAbbrev: nullableText(record.abbrev),
    salaryUsd: nullableNumber(record.salary_usd),
    cbtUsd: nullableNumber(record.cbt_usd),
    contractTotalUsd: nullableNumber(record.contract_total_usd),
    aavUsd: nullableNumber(record.aav_usd),
    estimated: record.estimated === true,
    terms: nullableText(record.terms_raw),
    outYears,
    service: {
      years: nullableNumber(record.mls_years),
      days: nullableNumber(record.mls_days),
      approximate: record.mls_approximate === true,
    },
    regime: nullableText(record.regime),
    regimeFlag: nullableText(record.regime_flag),
    options: parseOptions(record.options_left),
    agent: nullableText(record.agent),
    cotsAsOf: nullableText(record.cots_as_of),
    confirmedAt: nullableText(record.confirmed_at),
  }
}

export function normalizeContractsPayload(payload) {
  if (!payload?.available) throw new Error('feverbaseball contracts: feed unavailable')
  if (!Number.isInteger(Number(payload.season))) {
    throw new Error('feverbaseball contracts: missing season')
  }
  if (!payload.players || Array.isArray(payload.players) || typeof payload.players !== 'object') {
    throw new Error('feverbaseball contracts: missing players map')
  }

  const players = Object.fromEntries(
    Object.entries(payload.players).map(([id, record]) => [id, normalizeContractRecord(id, record)]),
  )
  const shipped = nullableNumber(payload.counts?.shipped)
  if (shipped != null && shipped !== Object.keys(players).length) {
    throw new Error(
      `feverbaseball contracts: expected ${shipped} shipped players, received ${Object.keys(players).length}`,
    )
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceGeneratedAt: nullableText(payload.generated_at),
      season: Number(payload.season),
      attribution: 'Fever Baseball',
      attributionUrl: 'https://www.feverbaseball.com',
      source: nullableText(payload.source) ?? "Cot's Baseball Contracts",
      sourceUrl: nullableText(payload.source_url) ?? 'https://legacy.baseballprospectus.com/compensation/cots/',
      cotsAsOf: nullableText(payload.cots_as_of),
    },
    players,
  }
}
