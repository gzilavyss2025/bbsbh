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

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  LOGO_ART_DIRS,
  LOGO_ART_ROOT,
  LOGO_MAX_BYTES,
  describeLogoRejection,
  logoUploadTarget,
  readPngHeader,
  teamIdForAbbr,
} from '../../src/lib/logoArt.js'

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

// The route key this handles, mounted under the same /__dev prefix as the JSON
// stores. Kept here rather than in DEV_DATA_STORES because the two take
// different bodies — a JSON store POSTs a whole object, this POSTs raw PNG
// bytes — and a single allowlist whose entries mean two different things is the
// kind of shortcut that ends with a validator being skipped.
export const DEV_LOGO_ROUTE = 'team-logo'

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
  // '..' anywhere in target.file lands somewhere else and fails here.
  const expected = `${LOGO_ART_ROOT}/${target.dir}/${target.name}`
  if (!LOGO_ART_DIRS.includes(target.dir) || !/^[A-Z]{2,3}\.png$/.test(target.name) || rel !== expected) {
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
      const entry = { teamId: teamIdForAbbr(path.basename(name, path.extname(name))), bytes: bytes.length }
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
