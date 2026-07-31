// The filesystem half of the dev-only logo upload — the /__dev/team-logo branch
// of vite.config.js's devDataSave() middleware (ADR-0029).
//
// The rules a file must satisfy live in src/lib/logoArt.js, imported here so the
// browser and the server enforce one implementation rather than two that drift.
// This module owns only what the browser can't do: resolving an absolute path
// under public/team-logos/, guarding that resolution, and rebuilding the
// coverage manifest from what is actually on disk.
//
// Same security boundary as the JSON stores next door: a request supplies a
// numeric team id and a treatment KEY, never a path. The directory comes from
// LOGO_TREATMENT_DIRS' own literal and the filename from teamAbbr, so there is
// no string in a request that reaches the filesystem — and resolveLogoFile()
// below re-checks the result anyway.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LOGO_ART_DIRS,
  LOGO_ART_ROOT,
  LOGO_MAX_BYTES,
  MILB_LOGO_DIRS,
  describeLogoCaveat,
  describeLogoRejection,
  LOGO_ART_URL_ROOT,
  logoUploadTarget,
  readPngHeader,
  teamIdForAbbr,
  wpaArtTreatmentKey,
} from '../../src/lib/logoArt.js'

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

// The route key this handles, mounted under the same /__dev prefix as the JSON
// stores. Kept here rather than in DEV_DATA_STORES because the two take
// different bodies — a JSON store POSTs a whole object, this POSTs raw PNG
// bytes — and a single allowlist whose entries mean two different things is the
// kind of shortcut that ends with a validator being skipped.
export const DEV_LOGO_ROUTE = 'team-logo'

// The sibling route that reuses an already-uploaded mark on another of this
// team's treatments, rather than making the owner procure/upload the same
// file a second time — the same move a few existing marks (Royals' Main into
// Alternate, Tigers' Main into Alternate 2) were done by hand for, now wired
// into the lab.
export const DEV_LOGO_COPY_ROUTE = 'team-logo-copy'

// The upload's own body cap. Deliberately the art standard's own cap plus a
// small allowance rather than the JSON stores' 256 KB: the stream guard exists
// to stop a runaway body from being buffered at all, and the real 400 KB
// judgement is made by describeLogoRejection once the bytes are in hand, which
// is what produces a message the owner can act on instead of a bare 413.
export const DEV_LOGO_MAX_BODY_BYTES = LOGO_MAX_BYTES + 64 * 1024

// The coverage manifest (PRD 4.3). Lives with the other hand-tuned stores and is
// rewritten by this endpoint after every successful upload, so it records what
// is on disk rather than what someone remembered to declare.
export const LOGO_MANIFEST_FILE = 'src/lib/data/logo-art.json'

// The absolute path an upload writes to. `target` always comes from
// logoUploadTarget, whose components are literals — so, exactly like
// resolveStoreFile() next door, this is defense in depth: it makes a careless
// future edit fail loudly at request time instead of quietly writing outside
// the art directories.
export function resolveLogoFile(target) {
  const abs = path.resolve(REPO_ROOT, target.file)
  const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/')
  // Not "starts with the art root" but "is exactly this file": the resolved path
  // has to come out equal to the one the allowlist's own literals spell, so a
  // '..' anywhere in target.file lands somewhere else and fails here. A name is
  // either an MLB abbreviation or (MILB_LOGO_DIRS) a bare positive team id.
  // `.svg` joins `.png` because a WPA slot can now be filled from the club's
  // own vector art (fillWpaArt below) as well as by a PNG upload — several
  // committed marks are already SVGs, so this is the file set that was always
  // really allowed here.
  const expected = `${LOGO_ART_ROOT}/${target.dir}/${target.name}`
  const validName = /^([A-Z]{2,3}|[1-9]\d*)\.(png|svg)$/.test(target.name)
  if (!LOGO_ART_DIRS.includes(target.dir) || !validName || rel !== expected) {
    throw new Error(`logo upload escapes the art directories: ${target.file}`)
  }
  return abs
}

// Everything the middleware needs to answer one request, or a `problem` to
// return as a 400/404. Pure apart from the path resolution, so the unit suite
// can exercise every branch without a dev server or a temp directory.
export function prepareLogoUpload({ teamId, treatment, bytes }) {
  const target = logoUploadTarget(teamId, treatment)
  if (!target) {
    return { problem: `no destination for team ${teamId} / treatment "${treatment}"`, status: 400 }
  }
  const rejection = describeLogoRejection(bytes)
  if (rejection) return { problem: rejection, status: 400 }
  return { target, file: resolveLogoFile(target) }
}

// Write the bytes, then rewrite the manifest from the resulting directory
// contents. The manifest is derived, never patched: rebuilding it from disk is
// what keeps it honest when a file is added or deleted by hand between uploads.
export async function saveLogoUpload({ teamId, treatment, bytes }) {
  const prepared = prepareLogoUpload({ teamId, treatment, bytes })
  if (prepared.problem) return prepared
  await mkdir(path.dirname(prepared.file), { recursive: true })
  await writeFile(prepared.file, bytes)
  await writeLogoManifest()
  return prepared
}

// Resolves both ends of a copy, or a `problem` to return as a 400 — pure like
// prepareLogoUpload above, so the unit suite can exercise every branch
// without a temp directory. `from`/`to` are each re-resolved against the same
// allowlist a real upload uses; neither is ever a path.
export function prepareLogoCopy({ teamId, from, to }) {
  const source = logoUploadTarget(teamId, from)
  if (!source) return { problem: `no destination for team ${teamId} / treatment "${from}"`, status: 400 }
  const target = logoUploadTarget(teamId, to)
  if (!target) return { problem: `no destination for team ${teamId} / treatment "${to}"`, status: 400 }
  if (from === to) return { problem: `"${from}" and "${to}" are the same treatment`, status: 400 }
  return { source, target }
}

// Read whatever is already on disk at `from` and write it to `to` through the
// exact same saveLogoUpload path a real upload takes — the copy is validated,
// written, and rebuilds the manifest identically, it just skips the
// request-body bytes and reads them off disk instead.
export async function copyLogoUpload({ teamId, from, to }) {
  const prepared = prepareLogoCopy({ teamId, from, to })
  if (prepared.problem) return prepared
  let bytes
  try {
    bytes = await readFile(resolveLogoFile(prepared.source))
  } catch {
    return { problem: `no art uploaded for "${from}" yet`, status: 404 }
  }
  const result = await saveLogoUpload({ teamId, treatment: to, bytes })
  if (result.problem) return result
  return { ...result, caveat: describeLogoCaveat(bytes) }
}

// ---------------------------------------------------------------------------
// Filling a WPA slot from the club's own art
//
// A club's WPA band can tile a wholly separate mark from its jersey tile, and
// until now the only way to put one there was to procure and upload a PNG. But
// the material is nearly always already on hand — the CDN wordmark, a
// treatment's procured art, a mark recolored in the lab — so the picker offers
// all of it and this writes the chosen one in.
//
// It is a COPY, not a pointer, unlike a custom-mark assignment
// (src/lib/customMarks.js). The WPA slot has no "original" to preserve: it is
// itself the override, so filling it is the same act as re-uploading, and
// keeping it a real file means wpaArtUrl stays a plain path with no second
// resolution layer in the live app.

// `kind:id`, the vocabulary src/lib/markSources.js builds and documents. Parsed
// here with the same three closed prefixes; anything else is not a source, and
// no part of the string ever becomes a path — `treatment` is looked up in the
// LOGO_TREATMENT_DIRS allowlist and `custom` is re-slug-checked below.
export function parseMarkSource(source) {
  const [kind, ...rest] = String(source ?? '').split(':')
  const id = rest.join(':')
  if (!id) return null
  if (kind === 'cdn' || kind === 'treatment' || kind === 'custom') return { kind, id }
  return null
}

const LOGO_CDN_BASE = 'https://www.mlbstatic.com/team-logos'
const CDN_VARIANT_PATHS = {
  base: null,
  primary: 'team-primary-on-light',
  cap: 'team-cap-on-light',
  wordmark: 'team-wordmark-on-light',
}

// The bytes a source resolves to, plus the extension they should be stored
// under — or a `problem`. Every branch reads from a place this app already
// owns: the CDN it fetches art from everywhere else, or a file under
// public/team-logos/.
async function readMarkSource(teamId, parsed) {
  if (parsed.kind === 'cdn') {
    if (!Object.hasOwn(CDN_VARIANT_PATHS, parsed.id)) return { problem: `"${parsed.id}" is not a CDN variant` }
    const dir = CDN_VARIANT_PATHS[parsed.id]
    const url = dir ? `${LOGO_CDN_BASE}/${dir}/${teamId}.svg` : `${LOGO_CDN_BASE}/${teamId}.svg`
    const res = await fetch(url)
    if (!res.ok) return { problem: `this club has no ${parsed.id} mark on the CDN (HTTP ${res.status})` }
    return { bytes: Buffer.from(await res.arrayBuffer()), ext: 'svg' }
  }

  if (parsed.kind === 'custom') {
    if (!/^[a-z0-9-]+$/.test(parsed.id)) return { problem: 'not a saved mark' }
    const file = path.resolve(REPO_ROOT, 'public/team-logos/custom', `${teamId}-${parsed.id}.svg`)
    try {
      return { bytes: await readFile(file), ext: 'svg' }
    } catch {
      return { problem: `no saved mark "${parsed.id}" for this club` }
    }
  }

  const source = logoUploadTarget(teamId, parsed.id)
  if (!source) return { problem: `"${parsed.id}" is not a treatment` }
  for (const ext of ['png', 'svg']) {
    const named = { ...source, name: source.name.replace(/\.png$/, `.${ext}`) }
    named.file = `${LOGO_ART_ROOT}/${named.dir}/${named.name}`
    try {
      return { bytes: await readFile(resolveLogoFile(named)), ext }
    } catch {
      // try the other extension
    }
  }
  return { problem: `no art on disk for "${parsed.id}"` }
}

// Put `source`'s art in this treatment's WPA slot. `treatment` is the REAL
// treatment ('main'), not the synthetic '-wpa' key — resolved here so a caller
// can't aim this at a jersey tile by passing the wrong one.
export async function fillWpaArt({ teamId, treatment, source }) {
  const key = wpaArtTreatmentKey(treatment)
  if (!key) return { problem: `treatment "${treatment}" has no WPA slot`, status: 400 }
  const parsed = parseMarkSource(source)
  if (!parsed) return { problem: `"${source}" is not a mark source`, status: 400 }

  const target = logoUploadTarget(teamId, key)
  if (!target) return { problem: `no WPA destination for team ${teamId}`, status: 400 }

  const read = await readMarkSource(teamId, parsed)
  if (read.problem) return { problem: read.problem, status: 400 }

  const named = { ...target, name: target.name.replace(/\.png$/, `.${read.ext}`) }
  named.file = `${LOGO_ART_ROOT}/${named.dir}/${named.name}`
  const file = resolveLogoFile(named)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, read.bytes)
  // The sibling in the other extension has to go, or the manifest's PNG-first
  // rule would keep serving the mark this just replaced (wpaArtUrl). Only ever
  // the same club's own WPA slot — never a jersey tile's art.
  const stale = { ...target, name: target.name.replace(/\.png$/, read.ext === 'png' ? '.svg' : '.png') }
  stale.file = `${LOGO_ART_ROOT}/${stale.dir}/${stale.name}`
  let replaced = null
  try {
    await rm(resolveLogoFile(stale))
    replaced = stale.name
  } catch {
    // nothing there, which is the normal case
  }
  await writeLogoManifest()
  return { file: named.file, url: `${LOGO_ART_URL_ROOT}/${named.dir}/${named.name}`, replaced }
}

// ---------------------------------------------------------------------------
// The coverage manifest
//
// Keyed by directory then filename — the shape of the thing it describes, so
// there is nothing to reconcile. Keying by team id instead would have to pick a
// winner for main-overrides/, which carries both WSH.png and WSH.svg today.
//
// PNG entries record the dimensions and alpha the standard cares about; an .svg
// entry records only its size, since reading a vector's intrinsic dimensions
// means parsing XML for a viewBox this file has no other use for. Both record
// `bytes`, which is what makes a hand-replaced file show up as drift rather
// than passing silently because the name didn't change.

// The manifest as the files on disk say it should be.
export async function buildLogoManifest() {
  const manifest = {}
  for (const dir of [...LOGO_ART_DIRS].sort()) {
    const abs = path.resolve(REPO_ROOT, LOGO_ART_ROOT, dir)
    let names
    try {
      names = await readdir(abs)
    } catch {
      continue // a treatment with no art procured yet has no directory
    }
    const entries = {}
    for (const name of names.sort()) {
      const ext = path.extname(name).slice(1).toLowerCase()
      if (ext !== 'png' && ext !== 'svg') continue
      const bytes = await readFile(path.join(abs, name))
      const base = path.basename(name, path.extname(name))
      // milb-home/milb-away are keyed by team id already (logoArt.js), so the
      // filename itself is the id; every other directory keys by abbreviation.
      const teamId = MILB_LOGO_DIRS.includes(dir) ? Number(base) : teamIdForAbbr(base)
      const entry = { teamId, bytes: bytes.length }
      if (ext === 'png') {
        const header = readPngHeader(bytes)
        entry.width = header?.width ?? null
        entry.height = header?.height ?? null
        entry.alpha = header?.alpha ?? null
      }
      entries[name] = entry
    }
    if (Object.keys(entries).length) manifest[dir] = entries
  }
  return manifest
}

export function serializeLogoManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

export async function writeLogoManifest() {
  const manifest = await buildLogoManifest()
  await writeFile(path.resolve(REPO_ROOT, LOGO_MANIFEST_FILE), serializeLogoManifest(manifest))
  return manifest
}
