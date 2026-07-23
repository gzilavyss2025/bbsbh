// What each club is actually wearing tonight, from the dedicated
// /api/v1/uniforms/game endpoint — the live feed carries zero uniform data
// (see docs/uniforms-and-logos.md for the verified findings). Spoiler-FREE:
// the assignment reveals nothing about the score and never changes once
// posted. It IS empty until around first pitch, and MiLB games return
// nothing, so this degrades to null and callers show the usual "—".

import { getJson } from './statsapi.js'

// Assets sort jersey → pants → cap so the composed line always reads top-down.
const UNIFORM_PIECE_ORDER = { J: 0, P: 1, C: 2 }

// Every asset label arrives as "<Club> <descriptor> <Piece>" — the club name
// is redundant next to a team header/row, so every reader strips it the same
// way.
function stripClubName(text, clubName) {
  if (clubName && text.startsWith(`${clubName} `)) {
    return text.slice(clubName.length + 1)
  }
  return text
}

export async function fetchGameUniforms(gamePk, options) {
  if (!gamePk) return null
  try {
    const data = await getJson(`/api/v1/uniforms/game?gamePks=${gamePk}`, options)
    const game = data.uniforms?.[0]
    const normalize = (side) => {
      const assets = (side?.uniformAssets ?? [])
        .map((a) => ({
          text: a.uniformAssetText ?? '',
          piece: a.uniformAssetType?.uniformAssetTypeCode ?? '',
        }))
        .filter((a) => a.text)
        .sort(
          (a, b) =>
            (UNIFORM_PIECE_ORDER[a.piece] ?? 9) -
            (UNIFORM_PIECE_ORDER[b.piece] ?? 9),
        )
      return assets.length > 0 ? assets : null
    }
    const away = normalize(game?.away)
    const home = normalize(game?.home)
    if (!away && !home) return null
    return { away, home }
  } catch {
    // Not posted yet / MiLB / endpoint hiccup — the uniform row just shows "—".
    return null
  }
}

// One printable uniform line — "Alt 2 Navy Blue jersey · Road Grey pants ·
// Alt Yellow Front hat". Asset labels arrive as "<Club> <desc> <Piece>"
// ("Brewers Alt 2 Navy Blue Jersey"); the club name is redundant next to a
// team header, so it's stripped, and the trailing piece word is lowercased so
// the descriptor reads as the name and the piece as a plain noun.
export function uniformLine(assets, clubName) {
  if (!assets?.length) return ''
  return assets
    .map((a) => stripClubName(a.text, clubName).replace(/\s(Jersey|Pants|Hat)$/, (m) => m.toLowerCase()))
    .join(' · ')
}

// A tight, at-a-glance uniform summary — "Away Alternate Navy Blue",
// "Home White", "Road Grey" — synthesized from the full asset list the way
// weather.js boils a forecast down to a scorebook line. The JERSEY is the
// identifying piece (pants and cap almost always follow the home/road default —
// grey pants, plain cap on the road), so the summary leads with tonight's side
// and the jersey's descriptor, dropping the redundant club name, the piece noun,
// and any variant number. A standard Home/Road jersey already names the side, so
// the prefix isn't doubled up ("Home White", not "Home Home White").
export function uniformSummary(assets, side, clubName) {
  if (!assets?.length) return ''
  const jersey = assets.find((a) => a.piece === 'J') ?? assets[0]
  let text = stripClubName(jersey.text, clubName)
  text = text
    .replace(/\s*\bJersey\b\s*/i, ' ') // drop the piece noun
    .replace(/\bAlt\b/gi, 'Alternate') // expand the abbreviation
    .replace(/\bAlternate\s+\d+\b/i, 'Alternate') // "Alternate 2" → "Alternate"
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  // A Home/Road/Away jersey self-identifies; anything else (an alternate, a
  // City Connect) gets tonight's side stamped on the front.
  if (/^(home|road|away)\b/i.test(text)) return text
  return `${side === 'away' ? 'Away' : 'Home'} ${text}`
}

// The per-team OPTIONS catalog (as opposed to fetchGameUniforms' per-game
// ASSIGNMENT) — `/api/v1/uniforms/team`, verified in docs/uniforms-and-logos.md.
// Every current MLB club's full asset list for a season, in one call
// (teamIds takes a comma list). MiLB is not covered (empty asset arrays), so
// this is MLB-only in practice.
export async function fetchTeamUniformCatalog(teamIds, season, options) {
  if (!teamIds?.length) return {}
  try {
    const data = await getJson(
      `/api/v1/uniforms/team?teamIds=${teamIds.join(',')}&season=${season}`,
      options,
    )
    const byTeam = {}
    for (const t of data.uniforms ?? []) {
      const assets = (t.uniformAssets ?? [])
        .map((a) => ({
          text: a.uniformAssetText ?? '',
          piece: a.uniformAssetType?.uniformAssetTypeCode ?? '',
          code: a.uniformAssetCode ?? null,
        }))
        .filter((a) => a.text)
      if (assets.length) byTeam[t.teamId] = assets
    }
    return byTeam
  } catch {
    return {}
  }
}

// Jerseys whose actual on-field treatment doesn't match what
// classifyUniformAsset's naming-convention guess below would return — e.g. a
// club's "Away Grey" is paired with the Alternate mark, not the plain Main
// one, or an "Alt 2" jersey is worn with the Alternate 3 mark rather than
// Alternate 2. Verified per-club against a live 2026 pull; keyed by
// uniformAssetCode (stable within a season, unlike the label text) so a
// wording tweak next season can't silently mis-target this. Single source of
// truth for both `classifyUniformAsset` (below, which the nightly
// gen-jerseys.mjs precompute calls for the real game-card logo swap) and Team
// Color Lab's own jersey-match display — one table, no drift between what the
// lab shows and what the live card renders.
export const JERSEY_TREATMENT_OVERRIDES = {
  '112_jersey_4_2026': 'alternate-2', // Cubs Alt 2 Baby Blue — worn with the Alternate 2 mark (moved off City Connect)
  '112_jersey_2_2026': 'alternate', // Cubs Away Grey — worn with the Alternate mark, not plain Main
  '133_jersey_4_2026': 'city-connect', // Athletics Alt 2 Yellow "Sacramento" — worn with the City Connect mark
  '144_jersey_4_2026': 'main', // Braves Alt 2 Navy — worn with the plain Main mark
  '146_jersey_3_2026': 'alternate-2', // Marlins Alt 1 Black — worn with the Alternate 2 mark
  '146_jersey_1_2026': 'alternate', // Marlins Home White — worn with the Alternate mark, not plain Main
  '146_jersey_4_2026': 'alternate-3', // Marlins Alt 2 Teal — worn with the Alternate 3 mark
  '147_jersey_2_2026': 'alternate', // Yankees Away Grey — worn with the Alternate mark, not plain Main
  '118_jersey_4_2026': 'main', // Royals Alt 1 Royal Blue — worn with the plain Main mark
  '118_jersey_2_2026': 'alternate-2', // Royals Away Grey — worn with the Alternate 2 mark
  '158_jersey_4_2026': 'alternate-2', // Brewers Alt 2 Navy Blue — worn with the Alternate 2 mark
  '108_jersey_2_2026': 'alternate', // Angels Away Grey — worn with the Alternate mark, not plain Main
  '138_jersey_3_2026': 'alternate-2', // Cardinals Alt 1 Cream — worn with the Alternate 2 mark
  '136_jersey_1_2026': 'alternate', // Mariners Home White — worn with the Alternate mark, not plain Main
  '136_jersey_3_2026': 'main', // Mariners Alt 1 Teal — worn with the plain Main mark
  '136_jersey_2_2026': 'alternate-2', // Mariners Away Navy — worn with the Alternate 2 mark
  '136_jersey_4_2026': 'alternate-3', // Mariners Steelheads Alt 2 Cream — worn with the Alternate 3 mark
  '137_jersey_4_2026': 'alternate-2', // Giants Alt 2 Black "Gigantes" — worn with the Alternate 2 mark (moved off City Connect)
}

// Which logo TREATMENT ('main' | 'alternate' | 'alternate-2' | 'alternate-3' |
// 'city-connect') a catalog asset implies. `code` (a catalog/assignment
// entry's `uniformAssetCode`) is checked against JERSEY_TREATMENT_OVERRIDES
// first for the rare exception; otherwise this falls back to the naming
// convention every club's catalog follows (verified against a live 2026 pull
// for all 30 clubs): "City Connect …" names itself; "Home/Away/Road …" is the
// standard uniform Main renders; everything else (Alt N, a special one-off
// like the Dodgers' "Gold Series") is Alternate. `clubName` is stripped first
// so a club whose own nickname starts with a piece word (e.g. a hypothetical
// "Home Runs") can't false-match — none currently does, but the strip keeps
// the check anchored to the descriptor, not the name.
export function classifyUniformAsset(text, clubName, code) {
  if (code && JERSEY_TREATMENT_OVERRIDES[code]) return JERSEY_TREATMENT_OVERRIDES[code]
  const rest = stripClubName(text, clubName)
  if (/^city connect\b/i.test(rest)) return 'city-connect'
  if (/^(home|away|road)\b/i.test(rest)) return 'main'
  return 'alternate'
}

// A catalog asset's label with the club name and the redundant "Jersey" noun
// dropped — "Home White", "Alt 2 Navy Blue", "City Connect 2.0" — same
// trimming convention as uniformSummary above, just without that function's
// side-stamping (a catalog entry already names its own side/variant).
export function jerseyLabel(text, clubName) {
  return stripClubName(text, clubName)
    .replace(/\s*\bJersey\b\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// The standardized three-level breakdown a category-level consumer (a future
// record-by-jersey grouping — Home wins vs. Away wins vs. every Alternate
// bucketed together) reads instead of classifyUniformAsset's five raw
// treatment keys. Level 1 is Home / Away / City Connect: a standard jersey
// already names itself (Home/Away/Road always leads its own label —
// classifyUniformAsset's own naming convention), so nothing further is shown.
// Anything else is an Alternate (Level 2 — a fixed qualifier, not a per-jersey
// name, since classifyUniformAsset's alternate/alternate-2/alternate-3 split
// is a logo-treatment detail this grouping intentionally drops); Level 3 is
// that specific alternate's own descriptor, derived from the club's own label
// text — every current alternate already names its color/style there ("Alt 2
// Navy Blue" -> "Navy Blue", "Alt 1 Pinstripe" -> "Pinstripe", "Alt 4 Canada
// Red" -> "Canada Red"). Purely derived, no curation input — see
// uniformDisplayName below for the human-editable full name a scorer actually
// reads.
export function uniformFriendlyName(text, clubName, code) {
  const treatment = classifyUniformAsset(text, clubName, code)
  if (treatment === 'city-connect') return { level1: 'City Connect', level2: null, level3: null }
  if (treatment === 'main') {
    const rest = stripClubName(text, clubName)
    // A rare JERSEY_TREATMENT_OVERRIDES entry can force 'main' onto text that
    // doesn't self-identify (e.g. Braves' "Alt 2 Navy", worn with the plain
    // Main mark) — an "Alt N …"-labeled jersey is never worn on the road in
    // modern MLB (the road jersey is always the grey/road standard), so it's
    // safely Home even without a leading Home/Away/Road word.
    const level1 = /^(away|road)\b/i.test(rest) ? 'Away' : 'Home'
    return { level1, level2: null, level3: null }
  }
  const level3 =
    stripClubName(text, clubName)
      .replace(/\s*\bJersey\b\s*/i, ' ')
      .replace(/^\s*(?:Home|Away|Road|Alt(?:ernate)?)\s*\d*\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim() || null
  return { level1: null, level2: 'Alternate', level3 }
}

// Flattens uniformFriendlyName's Level 1/2/3 breakdown into the single line a
// scorer actually reads — "Home", "Away", "City Connect", "Alternate: Navy
// Blue". The DEFAULT wording, used only when no curated override exists (see
// uniformDisplayName below).
export function formatUniformName({ level1, level2, level3 }) {
  if (level1) return level1
  if (level2 && level3) return `${level2}: ${level3}`
  return level2 ?? ''
}

// The full, human-curated display name for one jersey — every jersey gets
// one, not just Alternates, since the /uniform-names page lets a person
// overwrite the wording for ANY row (including a Home/Away/City Connect one
// that already names itself) for full precision. `overrides` is that page's
// save format at public/data/uniform-names.json: a flat uniformAssetCode ->
// string map. A curated entry wins outright; absent one, falls back to
// formatUniformName(uniformFriendlyName(...)) — the same default a fresh,
// never-reviewed jersey shows.
export function uniformDisplayName(text, clubName, code, overrides) {
  const curated = code ? overrides?.[code] : null
  return curated || formatUniformName(uniformFriendlyName(text, clubName, code))
}

// The /uniform-names page's own saved curation, from public/data/uniform-
// names.json — a hand-authored map (uniformAssetCode -> the full display
// string) written by that page's dev-only Save button (vite.config.js's
// middleware), not a scripts/gen-*.mjs precompute. Same fetch-and-cache shape
// as the other static readers in this file's sibling modules; degrades to {}
// so a missing file (nothing curated yet) just falls back to
// uniformDisplayName's own default everywhere.
let cachedNameOverrides
export async function fetchUniformNameOverrides() {
  if (cachedNameOverrides !== undefined) return cachedNameOverrides
  try {
    const res = await fetch('/data/uniform-names.json')
    if (!res.ok) throw new Error(`uniform-names.json ${res.status}`)
    cachedNameOverrides = await res.json()
  } catch {
    cachedNameOverrides = {}
  }
  return cachedNameOverrides
}
