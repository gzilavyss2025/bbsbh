// The filesystem half of the lab's Logo art editor — the /__dev/custom-mark and
// /__dev/custom-mark-assign branches of vite.config.js's devDataSave()
// middleware (ADR-0029).
//
// Two operations, both server-owned:
//
//   SAVE    write a recolored mark to public/team-logos/custom/{teamId}-{slug}.svg
//           and add it to the library in src/lib/data/custom-marks.json.
//   ASSIGN  point one of the club's treatments at a library mark (or clear it).
//
// Nothing here overwrites art. A save whose slug already exists is REFUSED
// rather than merged — "save as a new name" is the whole contract the editor
// offers — and an assignment never touches the curated file a treatment
// already has: it records a pointer that teams.js reads first, so clearing it
// restores the original mark instantly (src/lib/customMarks.js).
//
// Same security boundary as its neighbours: a request supplies a numeric team
// id, a treatment KEY, and a display NAME. The name is slugified to
// [a-z0-9-] here and the path is built from literals, so no string in a
// request reaches the filesystem intact — and resolveCustomMarkFile() re-checks
// the result anyway.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LOGO_TREATMENT_DIRS } from '../../src/lib/logoArt.js'
import { markSlug } from '../../src/lib/logoRecolor.js'

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

export const DEV_CUSTOM_MARK_ROUTE = 'custom-mark'
export const DEV_CUSTOM_MARK_ASSIGN_ROUTE = 'custom-mark-assign'

// Generous next to the 400 KB PNG cap: this is vector markup, and Illustrator
// exports of a club mark run 10-60 KB. The cap exists to stop a runaway body
// being buffered, not to express a standard.
export const DEV_CUSTOM_MARK_MAX_BODY_BYTES = 512 * 1024

const CUSTOM_DIR = 'public/team-logos/custom'
const STORE_FILE = 'src/lib/data/custom-marks.json'

// The absolute path a save writes to. `teamId` is an integer and `slug` has
// already been through markSlug, so the name is built from two sanitized
// values — this re-derives and re-checks it anyway, exactly like
// resolveLogoFile/resolveStoreFile next door, so a careless future edit fails
// loudly at request time instead of writing outside the art directory.
export function resolveCustomMarkFile(teamId, slug) {
  const name = `${teamId}-${slug}.svg`
  if (!/^[1-9]\d*-[a-z0-9-]+\.svg$/.test(name)) {
    throw new Error(`custom mark name is not writable: ${name}`)
  }
  const abs = path.resolve(REPO_ROOT, CUSTOM_DIR, name)
  const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/')
  if (rel !== `${CUSTOM_DIR}/${name}`) {
    throw new Error(`custom mark escapes the art directory: ${rel}`)
  }
  return abs
}

async function readStore() {
  try {
    return JSON.parse(await readFile(path.resolve(REPO_ROOT, STORE_FILE), 'utf8'))
  } catch {
    return {}
  }
}

// Sorted by team id and pretty-printed, the same canonical form serializeStore
// gives the JSON stores next door — so a save's diff shows the club that
// changed and nothing else.
async function writeStore(store) {
  const ordered = Object.fromEntries(
    Object.keys(store)
      .map(Number)
      .sort((a, b) => a - b)
      .map((id) => [String(id), store[String(id)]]),
  )
  await writeFile(path.resolve(REPO_ROOT, STORE_FILE), `${JSON.stringify(ordered, null, 2)}\n`)
}

// The markup a save will accept. Not a schema — just the two things that make
// the file useless or unsafe if wrong: it has to actually be an SVG, and it
// must not carry anything executable.
//
// This REJECTS; it does not strip. That distinction is the whole reason it can
// be this blunt: the substring tests below are deliberately over-eager (they
// bounce a file merely containing the word "script" anywhere, attribute or
// text), which as a filter would be broken and as a gate is just strict. The
// markup the editor posts has already been through a real parser
// (src/lib/svgSanitize.js) with executable nodes removed, so this is the
// backstop for a hand-crafted POST rather than the primary defense — and a
// backstop that says no too often is the right kind of wrong.
export function describeMarkRejection(svg) {
  const text = String(svg ?? '')
  const lower = text.toLowerCase()
  if (!lower.includes('<svg')) return 'not an SVG — expected markup with an svg root element'
  if (!lower.includes('</svg')) return 'SVG markup is truncated — no closing svg tag'
  if (lower.includes('script')) return 'SVG mentions script — refused'
  if (/\son[a-z]+\s*=/i.test(text)) return 'SVG carries an inline event handler'
  return null
}

// Write a newly recolored mark into the club's library. `name` is what the
// owner typed; the slug derived from it is the mark's identity, so two names
// that slugify the same collide on purpose.
export async function saveCustomMark({ teamId, name, svg }) {
  if (!Number.isInteger(teamId) || teamId <= 0) return { problem: 'teamId must be a positive integer', status: 400 }
  const slug = markSlug(name)
  if (!slug) return { problem: 'give the mark a name', status: 400 }
  const rejection = describeMarkRejection(svg)
  if (rejection) return { problem: rejection, status: 400 }

  const store = await readStore()
  const key = String(teamId)
  const entry = (store[key] ??= { marks: [], assignments: {} })
  entry.marks ??= []
  if (entry.marks.some((m) => m.slug === slug)) {
    // Refused rather than overwritten: the editor's contract is that saving
    // never destroys a mark somebody kept.
    return { problem: `this club already has a mark named "${name}" — pick another name`, status: 409 }
  }

  await mkdir(path.resolve(REPO_ROOT, CUSTOM_DIR), { recursive: true })
  await writeFile(resolveCustomMarkFile(teamId, slug), String(svg))
  entry.marks.push({ slug, name: String(name).trim() })
  await writeStore(store)
  return { slug, name: String(name).trim(), file: `${CUSTOM_DIR}/${teamId}-${slug}.svg`, url: `/team-logos/custom/${teamId}-${slug}.svg` }
}

// The CDN's four stock vectors (src/lib/teams.js's LOGO_VARIANTS plus
// 'base') — the other way this route lets a treatment be assigned, no
// recoloring required. Closed set: an unrecognized `cdn:` variant is refused
// the same as an unknown treatment, rather than trusted through to
// customMarks.js/teamLogoUrl.
const CDN_VARIANTS = new Set(['base', 'primary', 'cap', 'wordmark'])
const CDN_PREFIX = 'cdn:'

// Point a treatment at a library mark or a CDN vector, or clear it with an
// empty slug. The treatment key is checked against the same closed allowlist
// an upload resolves through, so this can't invent a treatment the app
// doesn't have. A `cdn:` assignment needs no prior save — unlike a library
// mark, there's nothing to have saved first — so it creates the team's entry
// on first use instead of requiring one already exist.
export async function assignCustomMark({ teamId, treatment, slug }) {
  if (!Number.isInteger(teamId) || teamId <= 0) return { problem: 'teamId must be a positive integer', status: 400 }
  if (!Object.hasOwn(LOGO_TREATMENT_DIRS, treatment)) {
    return { problem: `"${treatment}" is not a treatment`, status: 400 }
  }
  const store = await readStore()
  const key = String(teamId)

  if (!slug) {
    const entry = store[key]
    if (entry?.assignments) delete entry.assignments[treatment]
    // A team entry that exists ONLY to hold a now-cleared cdn: assignment
    // (no saved marks, no other assignments) is noise, not data — drop it
    // rather than leave an empty `{ marks: [], assignments: {} }` stub
    // behind for the next save to diff against.
    if (entry && entry.marks?.length === 0 && Object.keys(entry.assignments ?? {}).length === 0) {
      delete store[key]
    }
    await writeStore(store)
    return { treatment, slug: null }
  }
  if (slug.startsWith(CDN_PREFIX)) {
    const variant = slug.slice(CDN_PREFIX.length)
    if (!CDN_VARIANTS.has(variant)) return { problem: `"${variant}" is not a CDN mark variant`, status: 400 }
    const entry = (store[key] ??= { marks: [], assignments: {} })
    entry.assignments ??= {}
    entry.assignments[treatment] = slug
    await writeStore(store)
    return { treatment, slug }
  }
  const entry = store[key]
  if (!entry) return { problem: `team ${teamId} has no saved marks`, status: 404 }
  entry.assignments ??= {}
  if (!entry.marks?.some((m) => m.slug === slug)) {
    return { problem: `team ${teamId} has no mark "${slug}"`, status: 404 }
  }
  entry.assignments[treatment] = slug
  await writeStore(store)
  return { treatment, slug }
}
