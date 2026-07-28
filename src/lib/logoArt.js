// The curated-logo standard, and the pure functions that enforce it.
//
// Every mark under public/team-logos/ is hand-procured art — the mlbstatic CDN
// carries no alternate/City Connect logos (see teams.js's LOGO_VARIANTS note),
// so each one is cropped by hand and checked in. Until now the only way to add
// one was to drop a file into the right directory and hope it matched the
// others; the Team Identity Lab can now take a drag-and-drop instead
// (ADR-0029's /__dev/team-logo endpoint), and this module is the contract both
// sides of that upload agree on.
//
// It is deliberately dependency-free and environment-neutral: the lab imports
// it in the browser to reject a bad file instantly with a reason, and
// scripts/lib/dev-logo-upload.mjs imports the SAME functions in Node to reject
// it authoritatively before anything is written. One implementation, so a file
// the UI accepts can't be one the server refuses.
//
// See src/lib/CLAUDE.md for the manifest this feeds and the upload contract.

import { ALL_MLB_TEAM_IDS, teamAbbr } from './teams.js'

// ---------------------------------------------------------------------------
// The standard (PRD 4.1) — derived from the art already on disk, not invented.
// 512x512 is what 93 of the 94 committed files already were; the cap sits
// comfortably above the largest of them (main-overrides/TEX.png, ~93 KB) with
// room for a denser mark, while still being small enough that a full-resolution
// export dropped in by accident bounces instead of shipping.

export const LOGO_SIZE = 512
export const LOGO_MAX_BYTES = 400 * 1024

// Where the art lives, relative to the repo root. Both halves of this path are
// literals — nothing from a request ever contributes to either.
export const LOGO_ART_ROOT = 'public/team-logos'

// The same directory as the browser sees it — Vite serves public/ at the root,
// which is what makes an upload visible without a restart. Matches the URLs
// teams.js's localLogoUrl/mainOverrideLogoUrl already build.
export const LOGO_ART_URL_ROOT = '/team-logos'

// The closed allowlist of destinations: a lab treatment key -> the ONE
// directory it may write into. A treatment that isn't an own property here has
// no destination at all, which is what makes a traversal-shaped or invented
// treatment impossible to satisfy rather than merely unlikely.
//
// 'main' maps to main-overrides/ because the Main tile normally wears the
// plain CDN mark; a file here is the hand-recolored override for the clubs
// whose base mark doesn't read against their own tile (teams.js's
// mainOverrideLogoUrl). alternate-4/ has no directory on disk yet — the five
// clubs with that treatment all reuse their base mark (ALT4_USES_BASE_LOGO) —
// but it is a real treatment the lab renders a tile for, so an upload creates
// the directory rather than being turned away.
// 'milb-home'/'milb-away' are MiLB's own two directories (PRD 4.3) — kept out
// of the MLB treatment vocabulary above on purpose, since MiLB has no
// treatment catalog (src/lib/CLAUDE.md's "two vocabularies"). They map to
// themselves because there's only ever one MiLB profile per side, unlike the
// MLB keys, which rename into their real directory.
// The `-wpa` family below are a SECOND, independent destination per real MLB
// treatment — a club's WPA band can tile a wholly separate uploaded mark from
// whatever its tile box shows (see src/lib/wpaLogo.js's `WPA_OWN_ART`/
// `wpaArtUrl`), keyed by a synthetic `'<treatment>-wpa'` string that is never
// a real treatment on its own (it never appears in mlb-treatment-tuning.json,
// jerseys.json, or any teams.js resolver — only here and in wpaLogo.js).
export const LOGO_TREATMENT_DIRS = {
  main: 'main-overrides',
  alternate: 'alternate',
  'alternate-2': 'alternate-2',
  'alternate-3': 'alternate-3',
  'alternate-4': 'alternate-4',
  'city-connect': 'city-connect',
  'milb-home': 'milb-home',
  'milb-away': 'milb-away',
  'main-wpa': 'wpa-main',
  'alternate-wpa': 'wpa-alternate',
  'alternate-2-wpa': 'wpa-alternate-2',
  'alternate-3-wpa': 'wpa-alternate-3',
  'alternate-4-wpa': 'wpa-alternate-4',
  'city-connect-wpa': 'wpa-city-connect',
}

// Every directory an upload may land in — the same set as above, as a list, for
// the manifest builder and the on-disk sweep.
export const LOGO_ART_DIRS = Object.values(LOGO_TREATMENT_DIRS)

// The subset of LOGO_ART_DIRS keyed by team id instead of club abbreviation
// (PRD 1.7 — TEAM_ABBR is MLB-only and teamAbbr()'s 3-letter fallback collides
// across MiLB). logoUploadTarget and the manifest builder both branch on this
// list rather than duplicating it.
export const MILB_LOGO_DIRS = ['milb-home', 'milb-away']

// ---------------------------------------------------------------------------
// PNG headers, without an image library
//
// A PNG opens with an 8-byte signature followed immediately by the IHDR chunk:
// 4 bytes of chunk length, the ASCII tag 'IHDR', then width and height as
// big-endian uint32s at byte offsets 16 and 20, bit depth at 24, and color type
// at 25. That is the whole of what this app needs to know about a logo file, so
// reading those 26 bytes by hand is the entire "decoder" — no dependency, no
// native build step, nothing to keep up to date.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const IHDR_TAG = [0x49, 0x48, 0x44, 0x52] // 'IHDR'
const IHDR_END = 26 // last header byte this reads, exclusive

const u32be = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
const startsWith = (b, bytes, at) => bytes.every((x, i) => b[at + i] === x)

// Color types that carry per-pixel alpha: 4 (grayscale + alpha) and 6 (truecolor
// + alpha). A palette PNG (3) can still be transparent via a tRNS chunk, which
// this doesn't read — hence `alpha` is reported, never enforced. Six of the
// committed files are palette or plain truecolor and render correctly, so a
// hard alpha requirement would reject art the app is already shipping.
const ALPHA_COLOR_TYPES = new Set([4, 6])

// The PNG header of `bytes` (a Uint8Array/Buffer), or null if it isn't one.
export function readPngHeader(bytes) {
  if (!bytes || bytes.length < IHDR_END) return null
  if (!startsWith(bytes, PNG_SIGNATURE, 0)) return null
  if (!startsWith(bytes, IHDR_TAG, 12)) return null
  const colorType = bytes[25]
  return {
    width: u32be(bytes, 16),
    height: u32be(bytes, 20),
    bitDepth: bytes[24],
    colorType,
    alpha: ALPHA_COLOR_TYPES.has(colorType),
  }
}

// Why `bytes` may not be uploaded as a logo, phrased for the owner staring at a
// tile that just refused their file — or null if it passes. Order matters: a
// renamed JPEG should say so even when it is also the wrong size, because
// that's the thing to fix first.
export function describeLogoRejection(bytes) {
  if (!bytes || bytes.length === 0) return 'that file is empty'
  const header = readPngHeader(bytes)
  if (!header) {
    return 'not a PNG — the file does not start with the PNG signature (renaming a .jpg or .webp will not do it)'
  }
  if (header.width !== LOGO_SIZE || header.height !== LOGO_SIZE) {
    return `${header.width}x${header.height} — the standard is exactly ${LOGO_SIZE}x${LOGO_SIZE}`
  }
  if (bytes.length > LOGO_MAX_BYTES) {
    return `${Math.round(bytes.length / 1024)} KB — the cap is ${LOGO_MAX_BYTES / 1024} KB`
  }
  return null
}

// A non-blocking observation about an otherwise-valid file, or null. Flat art on
// a solid tile genuinely doesn't need an alpha channel, so this is worth saying
// once and not worth refusing over.
export function describeLogoCaveat(bytes) {
  const header = readPngHeader(bytes)
  if (header && !header.alpha) {
    return 'no alpha channel — fine if the mark fills its tile, but transparent art crops better against a tint'
  }
  return null
}

// ---------------------------------------------------------------------------
// Destinations

// The 30 current MLB clubs, by the abbreviation their art is filed under.
// teamAbbr({ id }) with no name to fall back on returns '' for anything that
// isn't one of them, which is precisely the boundary this PR wants: MLB
// treatment art is keyed by abbreviation, and MiLB art (PR 4) will be keyed by
// team id in its own directories instead (PRD 1.7 — MiLB abbreviations collide).
const ABBR_TO_TEAM_ID = new Map(ALL_MLB_TEAM_IDS.map((id) => [teamAbbr({ id }), id]))

// The club id whose art is filed under `abbr`, or null. Used by the manifest to
// name what it found on disk.
export function teamIdForAbbr(abbr) {
  return ABBR_TO_TEAM_ID.get(abbr) ?? null
}

// Where an uploaded mark for (teamId, treatment) belongs — or null if that pair
// has no destination, which is the only answer a caller may act on. Both halves
// are resolved, never accepted: the directory comes from LOGO_TREATMENT_DIRS'
// own literal, and the filename from teamAbbr (MLB) or the team id itself
// (MiLB, MILB_LOGO_DIRS) — never from anything in the request. A request
// supplies a numeric team id and a treatment key and nothing else, so there is
// no string it can hand over that reaches the filesystem.
export function logoUploadTarget(teamId, treatment) {
  if (!Number.isInteger(teamId)) return null
  if (typeof treatment !== 'string' || !Object.hasOwn(LOGO_TREATMENT_DIRS, treatment)) return null
  const dir = LOGO_TREATMENT_DIRS[treatment]
  if (!/^[a-z0-9-]+$/.test(dir)) return null

  if (MILB_LOGO_DIRS.includes(dir)) {
    if (teamId <= 0) return null
    const name = `${teamId}.png`
    return {
      teamId,
      treatment,
      abbr: null,
      dir,
      name,
      file: `${LOGO_ART_ROOT}/${dir}/${name}`,
      url: `${LOGO_ART_URL_ROOT}/${dir}/${name}`,
    }
  }

  const abbr = teamAbbr({ id: teamId })
  // Belt and braces on both components, so a future edit that widens either
  // source can't quietly widen the destination too.
  if (!/^[A-Z]{2,3}$/.test(abbr)) return null
  return {
    teamId,
    treatment,
    abbr,
    dir,
    name: `${abbr}.png`,
    file: `${LOGO_ART_ROOT}/${dir}/${abbr}.png`,
    url: `${LOGO_ART_URL_ROOT}/${dir}/${abbr}.png`,
  }
}

// The synthetic upload-destination key for a real treatment's WPA-only art
// (`'main'` -> `'main-wpa'`), or null for a treatment with no such
// destination (MiLB's `milb-home`/`milb-away`, or anything else not in
// LOGO_TREATMENT_DIRS) — never guessed, always checked against the same
// allowlist logoUploadTarget itself gates on.
export function wpaArtTreatmentKey(treatment) {
  const key = `${treatment}-wpa`
  return Object.hasOwn(LOGO_TREATMENT_DIRS, key) ? key : null
}

// The URL a club's uploaded WPA-only mark would be served at, or null if this
// (team, treatment) has no such destination (MiLB) — derived from the exact
// same logoUploadTarget the upload itself resolves against, so the WPA band's
// reader and the lab's writer can never point at two different paths for the
// same upload.
export function wpaArtUrl(teamId, treatment) {
  const key = wpaArtTreatmentKey(treatment)
  return key ? (logoUploadTarget(teamId, key)?.url ?? null) : null
}
