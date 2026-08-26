// Pure matching/scoring logic for the contract-identity pipeline
// (scripts/gen-contracts-identity.mjs). No I/O, no statsapi calls -- takes a
// source-CSV row and a candidate pool (a season's trimmed player list, see
// scripts/gen-contracts-season-players.mjs) and returns a resolution.
//
// Confirmed against real data before writing this: statsapi's `lastFirstName`
// and the contract CSVs' `player` column use the IDENTICAL "Last, First"
// format, suffixes included ("Guerrero Jr., Vladimir" in both) -- so exact
// matching is a single normalized whole-string comparison, not a
// first/last-name parse. Diacritics differ (statsapi: "Abreu, José", some CSV
// rows: "Abreu, Jose"), so normalization strips them.

// Case- and diacritic-insensitive, whitespace-collapsed normal form of a
// "Last, First" name string.
export function normalizeName(name) {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// Levenshtein edit distance, iterative DP, O(len(a)*len(b)).
export function levenshtein(a, b) {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = cur
  }
  return prev[n]
}

// Some source rows drop a generational suffix that statsapi keeps (a CSV row
// "Acuna, Ronald" against statsapi's real "Acuña Jr., Ronald") -- confirmed
// against real data, not hypothetical. Stripped only from the segment before
// the comma (the last name), so it can never eat part of a first name.
const GENERATIONAL_SUFFIX_RE = /\s+(jr\.?|sr\.?|ii|iii|iv)$/i

function stripGenerationalSuffix(normalized) {
  const commaIdx = normalized.indexOf(',')
  if (commaIdx === -1) return normalized.replace(GENERATIONAL_SUFFIX_RE, '')
  return normalized.slice(0, commaIdx).replace(GENERATIONAL_SUFFIX_RE, '') + normalized.slice(commaIdx)
}

// Common baseball first-name/nickname pairs a plain edit-distance score can't
// catch at all (a nickname is not a typo of the given name -- "Kiké" and
// "Enrique" share no characters). Confirmed necessary against real data: the
// CSVs and statsapi disagree on which form to use, in BOTH directions
// (Coulombe: CSV has "Daniel", statsapi has "Danny"; Hernández: CSV has
// "Kiké", statsapi has "Enrique"). Not exhaustive -- a genuinely new pair
// still falls through to plain fuzzy scoring, which is the intended,
// unresolved-if-too-different fallback.
const NICKNAME_GROUPS = [
  ['matt', 'matthew'],
  ['mike', 'michael', 'mikey'],
  ['danny', 'daniel', 'dan'],
  ['alex', 'alexander', 'alejandro'],
  ['nick', 'nicholas', 'nico'],
  ['rob', 'robert', 'bobby', 'bob'],
  ['will', 'william', 'bill', 'billy'],
  ['tony', 'anthony'],
  ['joe', 'joseph', 'joey'],
  ['chris', 'christopher'],
  ['sam', 'samuel'],
  ['ben', 'benjamin'],
  ['josh', 'joshua'],
  ['zach', 'zachary', 'zack', 'zac'],
  ['jake', 'jacob'],
  ['kike', 'enrique'],
  ['vlad', 'vladimir'],
  ['gio', 'giovanny', 'giovanni'],
  ['ronny', 'ronald', 'ron'],
  ['charlie', 'charles', 'chuck'],
  ['jim', 'james', 'jimmy'],
  ['dave', 'david', 'davey'],
  ['steve', 'steven', 'stephen'],
  ['ken', 'kenneth', 'kenny'],
  ['ed', 'edward', 'eddie'],
  ['tom', 'thomas', 'tommy'],
  ['andy', 'andrew'],
  ['pat', 'patrick'],
  ['greg', 'gregory'],
  ['jon', 'jonathan', 'johnny', 'john'],
  ['frank', 'francisco', 'franklin'],
  ['gabe', 'gabriel'],
  ['manny', 'manuel'],
  ['rich', 'richard', 'ricky', 'rick'],
  ['tim', 'timothy'],
  ['larry', 'lawrence'],
  ['fred', 'frederick'],
  ['ted', 'theodore'],
  ['al', 'albert', 'alberto'],
  ['jerry', 'gerald', 'geraldo'],
]
const NICKNAME_CANON = new Map()
for (const group of NICKNAME_GROUPS) {
  for (const name of group) NICKNAME_CANON.set(name, group[0])
}

function firstNameCanon(first) {
  const key = first.trim()
  return NICKNAME_CANON.get(key) ?? key
}

// True when both normalized "last, first" strings share an identical last
// name and a nickname-equivalent first name.
function nicknameEquivalent(na, nb) {
  const ca = na.indexOf(',')
  const cb = nb.indexOf(',')
  if (ca === -1 || cb === -1) return false
  if (na.slice(0, ca) !== nb.slice(0, cb)) return false
  return firstNameCanon(na.slice(ca + 1)) === firstNameCanon(nb.slice(cb + 1))
}

// 1.0 for an identical normalized name (suffix differences included), down to
// 0.0 for completely different strings. A nickname/given-name pair on either
// side scores 0.95 -- high enough to win any real fuzzy comparison, but never
// classified as a pure `exact` match. Normalizes both inputs internally.
export function nameSimilarity(a, b) {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (stripGenerationalSuffix(na) === stripGenerationalSuffix(nb)) return 1
  if (nicknameEquivalent(na, nb)) return 0.95
  const maxLen = Math.max(na.length, nb.length)
  return 1 - levenshtein(na, nb) / maxLen
}

// Broad position categories both sides can agree on. The source CSVs use
// compound/hand codes ("rhp-s", "dh-lf"); statsapi uses a single primary
// position abbreviation ("P", "DH"). Outfield spots collapse to one bucket
// since a player's CSV position and statsapi's primaryPosition can
// legitimately disagree on LF vs CF vs RF for the same person-season.
const POSITION_CATEGORY = {
  rhp: 'P', lhp: 'P', p: 'P',
  c: 'C',
  '1b': '1B',
  '2b': '2B',
  '3b': '3B',
  ss: 'SS',
  lf: 'OF', cf: 'OF', rf: 'OF', of: 'OF',
  dh: 'DH',
}

export function normalizePosition(code) {
  if (!code) return null
  const first = String(code).trim().toLowerCase().split(/[-\s]/)[0]
  return POSITION_CATEGORY[first] ?? null
}

// A row's MLS (major-league service time, "7.134" = 7 years 134 days) is a
// rough proxy for how many years before `season` the player debuted. Not
// exact -- service time accrues from active-roster days, not full calendar
// years -- so this is a plausibility check, not a precise calculation.
export function estimateDebutYear(season, mls) {
  if (season == null || mls == null || mls === '' || mls === '-') return null
  const years = Math.floor(Number(mls))
  if (!Number.isFinite(years)) return null
  return season - years
}

const EXACT_NAME_SCORE = 1
const FUZZY_NAME_FLOOR = 0.82 // below this, two names are not a plausible typo/accent gap
const AMBIGUOUS_MARGIN = 0.03 // top two candidates closer than this -> can't call it

function scoreCandidate(row, candidate, season) {
  const nameScore = nameSimilarity(row.rawName, candidate.lastFirstName)

  let bonus = 0
  const reasons = []
  const rowPos = normalizePosition(row.position)
  const candPos = normalizePosition(candidate.position)
  if (rowPos && candPos) {
    if (rowPos === candPos) {
      bonus += 0.05
      reasons.push('position match')
    } else {
      bonus -= 0.05
      reasons.push('position mismatch')
    }
  }

  const estDebut = estimateDebutYear(season, row.mls)
  if (estDebut != null && candidate.debutYear != null) {
    const gap = Math.abs(estDebut - candidate.debutYear)
    if (gap <= 1) {
      bonus += 0.05
      reasons.push('service-time plausible')
    } else if (gap >= 5) {
      bonus -= 0.1
      reasons.push('service-time implausible')
    }
  }

  return { candidate, nameScore, score: nameScore + bonus, reasons }
}

// Resolve one source-CSV row against a season's candidate pool.
//
// row: { rawName, position, mls } -- position/mls are optional context clues.
// candidates: [{ id, lastFirstName, teamId, position, debutYear }, ...]
// season: the contract row's season, for the debut-year plausibility check.
//
// Returns { mlbId, confidence, matchScore, matchedVia, candidates }.
// `candidates` is only populated for non-exact resolutions (fuzzy/ambiguous/
// unresolved) -- it is the shortlist the PR2 admin picker shows for review.
export function matchRow(row, candidates, season) {
  if (!candidates || candidates.length === 0) {
    return { mlbId: null, confidence: 'unresolved', matchScore: 0, matchedVia: 'empty-pool', candidates: [] }
  }

  const exact = candidates.filter((c) => nameSimilarity(row.rawName, c.lastFirstName) === EXACT_NAME_SCORE)
  if (exact.length === 1) {
    return { mlbId: exact[0].id, confidence: 'exact', matchScore: 1, matchedVia: 'exact-name', candidates: [] }
  }

  const pool = exact.length > 1 ? exact : candidates
  const scored = pool
    .map((c) => scoreCandidate(row, c, season))
    .sort((a, b) => b.score - a.score)

  const [best, second] = scored
  const bestPlausible = best.nameScore === EXACT_NAME_SCORE || best.nameScore >= FUZZY_NAME_FLOOR

  if (!bestPlausible) {
    return { mlbId: null, confidence: 'unresolved', matchScore: best?.score ?? 0, matchedVia: 'no-plausible-name', candidates: topCandidates(scored) }
  }

  const margin = second ? best.score - second.score : 1
  if (margin < AMBIGUOUS_MARGIN) {
    return {
      mlbId: null,
      confidence: 'ambiguous',
      matchScore: best.score,
      matchedVia: exact.length > 1 ? 'multiple-exact-names' : 'fuzzy-tie',
      candidates: topCandidates(scored),
    }
  }

  return {
    mlbId: best.candidate.id,
    confidence: exact.length > 1 ? 'fuzzy' : best.nameScore === EXACT_NAME_SCORE ? 'exact' : 'fuzzy',
    matchScore: best.score,
    matchedVia: exact.length > 1 ? 'exact-name-tiebreak' : 'fuzzy-name',
    candidates: [],
  }
}

function topCandidates(scored, n = 3) {
  return scored.slice(0, n).map((s) => ({
    id: s.candidate.id,
    lastFirstName: s.candidate.lastFirstName,
    score: Math.round(s.score * 1000) / 1000,
    reasons: s.reasons,
  }))
}
