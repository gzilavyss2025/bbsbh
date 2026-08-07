// Building one club's knockout mark, shared by the nightly generator
// (scripts/gen-mono-logos.mjs) and the dev-only regenerate route the Team
// Identity Lab calls after saving a pin set (vite.config.js).
//
// Both paths MUST produce byte-identical art for the same inputs — the whole
// point of the lab's editor is that what you approve on screen is what the file
// on disk contains — so the fetch, the pin lookup, and the conversion all live
// here rather than being written twice.
//
// The store is read off disk on every call rather than imported once: the dev
// route runs inside a long-lived Vite process, and an ESM import would hand it
// whatever mono-ink.json said when the server booted, so the first save would
// regenerate with the PREVIOUS pins and look like an off-by-one bug.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logoCdnUrl } from '../../src/lib/logoCdn.js'
import { monoLogoFingerprint, monoLogoSvg } from '../../src/lib/logoMono.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

export const MONO_LOGO_DIR = join(repoRoot, 'public', 'data', 'logos', 'mono')
const inkStorePath = join(repoRoot, 'src', 'lib', 'data', 'mono-ink.json')
// A short content hash per club, appended to teamLogoUrl's `mono` URL as
// `?v=` (teams.js). The deployed PWA serves these SVGs CacheFirst
// (vite.config.js) so a revisited team's mark survives going offline at the
// park — but that same rule means a corrected file only reaches a browser
// that already cached the old one on the CURRENT art's cache expiry (up to
// 30 days), not the next deploy. Changing the URL whenever the art changes
// sidesteps that: the old URL's cache entry is simply never requested again,
// so what's approved in the lab is what a fresh page load gets, the moment
// the corrected file ships — no wait for expiry.
export const MONO_LOGO_MANIFEST_PATH = join(repoRoot, 'src', 'lib', 'data', 'mono-logo-manifest.json')

export function monoLogoHash(monoSvg) {
  return createHash('sha1').update(monoSvg).digest('hex').slice(0, 10)
}

export async function readMonoLogoManifest() {
  try {
    return JSON.parse(await readFile(MONO_LOGO_MANIFEST_PATH, 'utf8'))
  } catch {
    return {}
  }
}

// Rewrites just this one club's entry and leaves every other club's hash
// untouched — the dev route regenerates one team at a time and must not
// clobber the rest of the manifest with whatever was on disk when the long-
// lived Vite process started (same reasoning as readMonoInkStore below).
export async function writeMonoLogoManifestEntry(teamId, hash) {
  const manifest = await readMonoLogoManifest()
  manifest[String(teamId)] = hash
  const sorted = Object.fromEntries(
    Object.keys(manifest)
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => [id, manifest[id]]),
  )
  await writeFile(MONO_LOGO_MANIFEST_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
}

export async function readMonoInkStore() {
  try {
    return JSON.parse(await readFile(inkStorePath, 'utf8'))
  } catch {
    // A missing or unparseable store is not a reason to stop generating art —
    // every club just converts automatically, which is where they all started.
    return {}
  }
}

// The pins to apply to this art, or null. A saved set whose fingerprint doesn't
// match the art in hand is dropped rather than applied to shapes nobody looked
// at — see src/lib/monoInk.js, which is the browser-side copy of this rule.
export function pinsFor(store, teamId, sourceSvg) {
  const entry = store?.[String(teamId)]
  const parts = entry?.parts
  if (!parts || !Object.keys(parts).length) return null
  if (entry.art && entry.art !== monoLogoFingerprint(sourceSvg)) return null
  return parts
}

// Which CDN source feeds this club's mono conversion — `'base'` unless the
// lab picked a different one. Some MiLB clubs' plain `base` mark is worse art
// than their `primary`/`cap`/`wordmark` mark on the same CDN (a low-res
// scrape, a busier crest that converts to knockout worse than the cleaner
// alternative) — this is that escape hatch. No fingerprint check needed the
// way pinsFor has one: this is just a fetch-URL choice, not art applied to a
// shape list that could point at the wrong shapes if the art moved.
export function sourceVariantFor(store, teamId) {
  return store?.[String(teamId)]?.source ?? 'base'
}

export async function fetchClubArt(teamId, variant = 'base') {
  const res = await fetch(logoCdnUrl(teamId, variant))
  if (!res.ok) return { problem: `HTTP ${res.status}` }
  return { svg: await res.text() }
}

// Fetch, convert with this club's pins, write. Returns `{ file }` or
// `{ problem }` — an unconvertible mark is a normal outcome (the app falls back
// to the full-color mark on its own), not an error to throw over.
export async function writeMonoLogo(teamId, { store, svg } = {}) {
  const inkStore = store ?? (await readMonoInkStore())
  const art = svg ? { svg } : await fetchClubArt(teamId, sourceVariantFor(inkStore, teamId))
  if (art.problem) return { problem: art.problem }
  const mono = monoLogoSvg(art.svg, { maskId: `ink-${teamId}`, pins: pinsFor(inkStore, teamId, art.svg) })
  if (!mono) return { problem: 'not convertible' }
  const file = join(MONO_LOGO_DIR, `${teamId}.svg`)
  await writeFile(file, mono)
  const hash = monoLogoHash(mono)
  await writeMonoLogoManifestEntry(teamId, hash)
  return { file: `public/data/logos/mono/${teamId}.svg`, mono, hash }
}
