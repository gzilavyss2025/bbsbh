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
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { monoLogoFingerprint, monoLogoSvg } from '../../src/lib/logoMono.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

export const MONO_LOGO_DIR = join(repoRoot, 'public', 'data', 'logos', 'mono')
const inkStorePath = join(repoRoot, 'src', 'lib', 'data', 'mono-ink.json')

export const LOGO_CDN_BASE = 'https://www.mlbstatic.com/team-logos'

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

export async function fetchClubArt(teamId) {
  const res = await fetch(`${LOGO_CDN_BASE}/${teamId}.svg`)
  if (!res.ok) return { problem: `HTTP ${res.status}` }
  return { svg: await res.text() }
}

// Fetch, convert with this club's pins, write. Returns `{ file }` or
// `{ problem }` — an unconvertible mark is a normal outcome (the app falls back
// to the full-color mark on its own), not an error to throw over.
export async function writeMonoLogo(teamId, { store, svg } = {}) {
  const inkStore = store ?? (await readMonoInkStore())
  const art = svg ? { svg } : await fetchClubArt(teamId)
  if (art.problem) return { problem: art.problem }
  const mono = monoLogoSvg(art.svg, { maskId: `ink-${teamId}`, pins: pinsFor(inkStore, teamId, art.svg) })
  if (!mono) return { problem: 'not convertible' }
  const file = join(MONO_LOGO_DIR, `${teamId}.svg`)
  await writeFile(file, mono)
  return { file: `public/data/logos/mono/${teamId}.svg`, mono }
}
