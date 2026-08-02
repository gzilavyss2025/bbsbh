// The closed allowlist behind vite.config.js's devDataSave() middleware, plus
// the per-store body validators — kept out of vite.config.js so `npm test` can
// exercise them directly (test/dev-data-stores.test.js) without booting Vite.
//
// This is the app's one deliberate write-to-disk path and its only dev-time
// backend; ADR-0029 records why it exists and how it stays out of production.
// The allowlist is the security boundary: a request supplies a KEY, never a
// path, and a key that isn't an own property of DEV_DATA_STORES is a 404. There
// must be no path from a request body to an arbitrary filesystem location, so
// resolve the destination through resolveStoreFile() below rather than
// concatenating anything from the request.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Every store is a few hundred bytes per club at most. This is a generous
// ceiling against a runaway/malformed POST, not a real-world size — the largest
// committed store (milb-treatment-tuning.json) is ~40 KB.
export const DEV_DATA_MAX_BODY_BYTES = 256 * 1024

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// A key that would land on Object.prototype instead of the object itself. JSON
// can carry these, so every store validator rejects them rather than trusting
// the shape that comes back out of JSON.parse.
const POISON_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const hasPoisonKey = (o) => Object.keys(o).some((k) => POISON_KEYS.has(k))

const isTeamIdKey = (k) => /^\d+$/.test(k)
const isTreatmentKey = (k) => /^[a-z0-9-]+$/.test(k)
// The jerseys.json/teams.js treatment vocabulary (mainTreatmentTile's isMain
// branch plus every treatmentsForTeam key) — 'main' is the default every
// club already gets with no offDayTreatment field at all, so a hand-crafted
// POST setting it explicitly would be a no-op write, not a rejection.
const OFF_DAY_TREATMENTS = new Set(['main', 'alternate', 'alternate-2', 'alternate-3', 'alternate-4', 'city-connect'])
// Same vocabulary, for the per-side predictive-fallback pick below.
const DEFAULT_LOGO_TREATMENTS = OFF_DAY_TREATMENTS
// Hex, rgb(a), or a CSS color keyword — the pinstripe tables carry
// 'rgba(0, 0, 0, 0.16)', so this can't be hex-only.
const isColorish = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64

// Leaf values a tuning record may carry: a number, a string, a boolean, or a
// flat object of those (a header triad, a WPA layout, a position record).
function isTuningValue(v) {
  if (v === null) return true
  if (typeof v === 'number') return Number.isFinite(v)
  if (typeof v === 'string') return v.length <= 512
  if (typeof v === 'boolean') return true
  if (Array.isArray(v)) return v.every((x) => typeof x === 'string' && x.length <= 64)
  if (!isPlainObject(v)) return false
  if (hasPoisonKey(v)) return false
  return Object.values(v).every(
    (x) =>
      x === null ||
      typeof x === 'number' ||
      typeof x === 'string' ||
      typeof x === 'boolean',
  )
}

// The shared `{ "<teamId>": { name, …, treatments: { "<key>": {…} } } }` shape
// (src/lib/tuningStore.js). Deliberately structural rather than a field-by-field
// schema: the lab adds fields as new dimensions land (PR 3's logo art, PR 5's
// colour metadata), and a validator that has to be edited for every new field
// is one that gets loosened in a hurry instead.
function isTreatmentStore(parsed) {
  if (!isPlainObject(parsed) || hasPoisonKey(parsed)) return 'expected an object keyed by team id'
  for (const [teamId, entry] of Object.entries(parsed)) {
    if (!isTeamIdKey(teamId)) return `"${teamId}" is not a team id`
    if (!isPlainObject(entry) || hasPoisonKey(entry)) return `team ${teamId} is not an object`
    if (entry.name !== undefined && typeof entry.name !== 'string') {
      return `team ${teamId}'s name is not a string`
    }
    if (entry.note !== undefined && typeof entry.note !== 'string') {
      return `team ${teamId}'s note is not a string`
    }
    if (entry.treatments !== undefined) {
      if (!isPlainObject(entry.treatments) || hasPoisonKey(entry.treatments)) {
        return `team ${teamId}'s treatments is not an object`
      }
      for (const [treatment, fields] of Object.entries(entry.treatments)) {
        if (!isTreatmentKey(treatment)) return `team ${teamId} has a bad treatment key "${treatment}"`
        if (!isPlainObject(fields) || hasPoisonKey(fields)) {
          return `team ${teamId}'s ${treatment} is not an object`
        }
        for (const [field, value] of Object.entries(fields)) {
          if (!isTuningValue(value)) return `team ${teamId}'s ${treatment}.${field} is not a tuning value`
        }
      }
    }
    for (const [field, value] of Object.entries(entry)) {
      if (field === 'treatments' || field === 'name' || field === 'note') continue
      if (!isTuningValue(value)) return `team ${teamId}'s ${field} is not a tuning value`
    }
  }
  return null
}

// The three confidence ratings the research pass assigned — high (2+ sources
// agreed), medium (a single aggregator), low (conflicting sources, a likely
// mislabel, or names-only). A free-string rating would drift into a fourth
// meaning nobody defined, so the set is closed.
const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low'])

// milb-colors.json: one researched primary/secondary pair per affiliate, plus
// the provenance that travels with it (`third`, `confidence`, `source`,
// `note`) and `found: false` for an affiliate research resolved no hex for at
// all. Kept stricter than the tuning stores because a malformed pair here
// recolors real MiLB surfaces — the headshot tint and the logo tile both read
// this through brandColors.js's chain — not just a lab preview.
function isMilbColorStore(parsed) {
  if (!isPlainObject(parsed) || hasPoisonKey(parsed)) return 'expected an object keyed by team id'
  for (const [teamId, entry] of Object.entries(parsed)) {
    if (!isTeamIdKey(teamId)) return `"${teamId}" is not a team id`
    if (!isPlainObject(entry) || hasPoisonKey(entry)) return `team ${teamId} is not an object`
    if (typeof entry.name !== 'string' || !entry.name) return `team ${teamId} has no name`
    for (const field of ['level', 'source', 'note']) {
      const v = entry[field]
      if (v !== undefined && v !== null && typeof v !== 'string') {
        return `team ${teamId}'s ${field} is not a string`
      }
    }
    if (entry.confidence !== undefined && !CONFIDENCE_LEVELS.has(entry.confidence)) {
      return `team ${teamId}'s confidence is not high/medium/low`
    }
    if (entry.found !== undefined && typeof entry.found !== 'boolean') {
      return `team ${teamId}'s found is not a boolean`
    }
    if (entry.third !== undefined && !isColorish(entry.third)) {
      return `team ${teamId}'s third is not a color`
    }
    if (entry.pair !== undefined) {
      if (!Array.isArray(entry.pair) || entry.pair.length !== 2 || !entry.pair.every(isColorish)) {
        return `team ${teamId}'s pair is not two colors`
      }
    }
    // The one cross-field rule, and the reason it's here rather than in a
    // test: `found: false` is how an unresolved club stays visibly unresolved.
    // An entry carrying both would silently claim a pair research never found.
    if (entry.found === false && entry.pair !== undefined) {
      return `team ${teamId} is marked found:false but carries a pair`
    }
  }
  return null
}

// mlb-team-colors.json: one club's Primary/Secondary/Accent brand colors,
// an optional 4th `accent2` (a promoted single extra — see
// mlbColorRoles.js), any REMAINING researched `extras`, an optional
// `offDayTreatment` (which jersey OffDaySection.jsx's tile wears on a day the
// club has no game, teams.js's offDayTreatmentFor — absent means Main), and
// optional `defaultHomeTreatment`/`defaultAwayTreatment` (the per-side
// predictive-fallback pick teams.js's defaultTreatmentFor consults before its
// own Friday/City-Connect heuristic, when a game's real jersey hasn't posted
// yet — absent means "guess") — the Team Identity Lab's editable counterpart
// to teams.js's real TEAM_COLOR_PAIRS/TEAM_COLORS/teamColorExtras/
// offDayTreatmentFor/defaultHomeTreatmentFor/defaultAwayTreatmentFor
// resolvers, which read this store (src/lib/CLAUDE.md). Team-level, no
// `treatments` — same footing as milb-colors.json, since none of these vary
// by treatment the way a logo tile's tuning does.
//
// A role the club doesn't have is an ABSENT field, never `''` — isColorish
// rejects the empty string on purpose, and the lab's applyColorsDraft deletes
// rather than blanks (src/screens/identity-lab/profiles/mlbColorRoles.js), so
// the two halves agree on what "cleared" writes.
function isMlbTeamColorStore(parsed) {
  if (!isPlainObject(parsed) || hasPoisonKey(parsed)) return 'expected an object keyed by team id'
  for (const [teamId, entry] of Object.entries(parsed)) {
    if (!isTeamIdKey(teamId)) return `"${teamId}" is not a team id`
    if (!isPlainObject(entry) || hasPoisonKey(entry)) return `team ${teamId} is not an object`
    if (typeof entry.name !== 'string' || !entry.name) return `team ${teamId} has no name`
    for (const field of ['primary', 'secondary', 'accent', 'accent2']) {
      const v = entry[field]
      if (v !== undefined && !isColorish(v)) return `team ${teamId}'s ${field} is not a color`
    }
    if (entry.extras !== undefined) {
      if (!Array.isArray(entry.extras)) return `team ${teamId}'s extras is not a list`
      for (const extra of entry.extras) {
        if (!isPlainObject(extra) || hasPoisonKey(extra)) return `team ${teamId} has a malformed extra`
        if (typeof extra.label !== 'string' || !extra.label) return `team ${teamId} has an unlabeled extra`
        if (!isColorish(extra.hex)) return `team ${teamId}'s "${extra.label}" extra is not a color`
      }
    }
    if (entry.note !== undefined && typeof entry.note !== 'string') {
      return `team ${teamId}'s note is not a string`
    }
    if (entry.offDayTreatment !== undefined && !OFF_DAY_TREATMENTS.has(entry.offDayTreatment)) {
      return `team ${teamId}'s offDayTreatment "${entry.offDayTreatment}" is not a known treatment`
    }
    for (const field of ['defaultHomeTreatment', 'defaultAwayTreatment']) {
      const v = entry[field]
      if (v !== undefined && !DEFAULT_LOGO_TREATMENTS.has(v)) {
        return `team ${teamId}'s ${field} "${v}" is not a known treatment`
      }
    }
  }
  return null
}

// mono-ink.json: which SHAPES of a club's logo art are the mark and which are
// the paper, when the automatic classifier is wrong (src/lib/monoInk.js). Keys
// under `parts` are the shape's ordinal in the art, so they're digits like a
// team id; the verdicts are a closed two-word set, and anything else here would
// silently do nothing at generation time rather than fail.
const INK_VERDICTS = new Set(['ink', 'knockout'])

function isMonoInkStore(parsed) {
  if (!isPlainObject(parsed) || hasPoisonKey(parsed)) return 'expected an object keyed by team id'
  for (const [teamId, entry] of Object.entries(parsed)) {
    if (!isTeamIdKey(teamId)) return `"${teamId}" is not a team id`
    if (!isPlainObject(entry) || hasPoisonKey(entry)) return `team ${teamId} is not an object`
    for (const field of ['name', 'art', 'note']) {
      const v = entry[field]
      if (v !== undefined && typeof v !== 'string') return `team ${teamId}'s ${field} is not a string`
    }
    if (entry.parts !== undefined) {
      if (!isPlainObject(entry.parts) || hasPoisonKey(entry.parts)) {
        return `team ${teamId}'s parts is not an object`
      }
      for (const [part, verdict] of Object.entries(entry.parts)) {
        if (!isTeamIdKey(part)) return `team ${teamId} has a bad part index "${part}"`
        if (!INK_VERDICTS.has(verdict)) return `team ${teamId}'s part ${part} is not ink/knockout`
      }
    }
  }
  return null
}

// A flat uniformAssetCode -> display-name string map (src/api/uniforms.js's
// fetchUniformNameOverrides). Rejects an array, nested objects, or non-string
// values rather than writing a shape the app's readers don't expect.
function isUniformNamesMap(parsed) {
  if (!isPlainObject(parsed) || hasPoisonKey(parsed)) {
    return 'expected a flat { uniformAssetCode: string } map'
  }
  if (!Object.values(parsed).every((v) => typeof v === 'string')) {
    return 'expected a flat { uniformAssetCode: string } map'
  }
  return null
}

// alt-colors.json/alt2-colors.json/alt3-colors.json/alt4-colors.json/
// city-connect-colors.json: a non-Main treatment's tile-background swatches
// (src/lib/teams.js's ALT_COLORS and friends, ADR-0029) — one small swatch
// list per team, at most one of which is flagged `bg: true` (the tile fill),
// plus the curation `note` that used to be that entry's trailing JS comment.
function isColorSwatchStore(parsed) {
  if (!isPlainObject(parsed) || hasPoisonKey(parsed)) return 'expected an object keyed by team id'
  for (const [teamId, entry] of Object.entries(parsed)) {
    if (!isTeamIdKey(teamId)) return `"${teamId}" is not a team id`
    if (!isPlainObject(entry) || hasPoisonKey(entry)) return `team ${teamId} is not an object`
    if (entry.note !== undefined && typeof entry.note !== 'string') {
      return `team ${teamId}'s note is not a string`
    }
    if (!Array.isArray(entry.swatches) || entry.swatches.length === 0) {
      return `team ${teamId}'s swatches is not a non-empty list`
    }
    for (const swatch of entry.swatches) {
      if (!isPlainObject(swatch) || hasPoisonKey(swatch)) return `team ${teamId} has a malformed swatch`
      if (typeof swatch.label !== 'string' || !swatch.label) return `team ${teamId} has an unlabeled swatch`
      if (!isColorish(swatch.hex)) return `team ${teamId}'s "${swatch.label}" swatch is not a color`
      if (swatch.bg !== undefined && typeof swatch.bg !== 'boolean') {
        return `team ${teamId}'s "${swatch.label}" swatch has a non-boolean bg flag`
      }
    }
  }
  return null
}

// route key -> { file, validate }. `file` is a repo-relative literal; nothing
// from a request ever contributes to it.
export const DEV_DATA_STORES = {
  'uniform-names': {
    file: 'public/data/uniform-names.json',
    validate: isUniformNamesMap,
  },
  'mlb-treatment-tuning': {
    file: 'src/lib/data/mlb-treatment-tuning.json',
    validate: isTreatmentStore,
  },
  'milb-treatment-tuning': {
    file: 'src/lib/data/milb-treatment-tuning.json',
    validate: isTreatmentStore,
  },
  'wpa-tuning': {
    file: 'src/lib/data/wpa-tuning.json',
    validate: isTreatmentStore,
  },
  'milb-colors': {
    file: 'src/lib/data/milb-colors.json',
    validate: isMilbColorStore,
  },
  'mlb-team-colors': {
    file: 'src/lib/data/mlb-team-colors.json',
    validate: isMlbTeamColorStore,
  },
  'mono-ink': {
    file: 'src/lib/data/mono-ink.json',
    validate: isMonoInkStore,
  },
  'alt-colors': {
    file: 'src/lib/data/alt-colors.json',
    validate: isColorSwatchStore,
  },
  'alt2-colors': {
    file: 'src/lib/data/alt2-colors.json',
    validate: isColorSwatchStore,
  },
  'alt3-colors': {
    file: 'src/lib/data/alt3-colors.json',
    validate: isColorSwatchStore,
  },
  'alt4-colors': {
    file: 'src/lib/data/alt4-colors.json',
    validate: isColorSwatchStore,
  },
  'city-connect-colors': {
    file: 'src/lib/data/city-connect-colors.json',
    validate: isColorSwatchStore,
  },
}

// The store for a request's key, or null for anything not on the allowlist.
// Uses Object.hasOwn so a request for 'constructor' or '__proto__' can't reach
// an inherited property instead of a store.
export function devDataStore(key) {
  return Object.hasOwn(DEV_DATA_STORES, key) ? DEV_DATA_STORES[key] : null
}

// The only two directories a dev save may write into: the committed data stores
// the app imports, and the committed data files it fetches. Nothing else in the
// repo is data — a save must never be able to touch source, config, or CI.
const WRITABLE_DIRS = ['src/lib/data', 'public/data']

// The absolute path a store writes to. Throws rather than returning a path
// outside those directories — a belt-and-braces check on the allowlist's own
// literals, so a future edit that adds a '../' entry (or just points somewhere
// careless) fails loudly at request time instead of writing where it shouldn't.
export function resolveStoreFile(store) {
  const abs = path.resolve(REPO_ROOT, store.file)
  const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/')
  const allowed = WRITABLE_DIRS.some((dir) => rel.startsWith(`${dir}/`) && !rel.slice(dir.length + 1).includes('/'))
  if (!allowed) {
    throw new Error(`dev-data store escapes the writable data directories: ${store.file}`)
  }
  return abs
}

// The canonical on-disk form: 2-space pretty-printed, trailing newline, and —
// for a team-keyed store — keys sorted by team id, so a save's git diff shows
// exactly which team/treatment/field moved and nothing else. A store with any
// non-numeric key (uniform-names' asset codes) keeps the order it was posted
// in, which is how that file has always been written.
export function serializeStore(parsed) {
  const keys = Object.keys(parsed)
  const ordered = keys.every(isTeamIdKey)
    ? Object.fromEntries(
        keys
          .map(Number)
          .sort((a, b) => a - b)
          .map((id) => [String(id), parsed[id]]),
      )
    : parsed
  return `${JSON.stringify(ordered, null, 2)}\n`
}
