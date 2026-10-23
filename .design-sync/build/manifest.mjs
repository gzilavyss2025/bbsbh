// The file-hash manifest of a design-sync build (#2527): one sha256 per built file, so an upload
// can send only what changed since the last one and drift shows in a diff.
//   node .design-sync/build/manifest.mjs <build dir> [--write]
// Prints the files that are new, changed or gone against .design-sync/sync-manifest.json. With
// --write it replaces that file. Write it after an upload and commit it: it then says what the
// project holds. run.mjs runs this with --manifest. Not the design tool's own `_ds_manifest.json`,
// which the tool writes itself (NOTES.md: never write that one).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const MANIFEST_PATH = path.join(root, '.design-sync', 'sync-manifest.json')

const ABOUT =
  'Hashes of the design-sync build the Tally Baseball project holds. Written by `node .design-sync/build/run.mjs --manifest` after an upload (docs/design-sync.md). Sorted, no clock: a second build of the same tree writes the same file.'

// { 'tokens/colors.css': '<sha256>' } for every file under `dir`, paths with `/`, sorted by path.
export function hashDir(dir) {
  const out = {}
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else out[path.relative(dir, full).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
    }
  }
  walk(dir)
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

// prev, next: hashDir maps (prev may be null: nothing uploaded yet, so everything is added).
export function diffManifests(prev, next) {
  const before = prev ?? {}
  return {
    added: Object.keys(next).filter((p) => !(p in before)),
    changed: Object.keys(next).filter((p) => p in before && before[p] !== next[p]),
    removed: Object.keys(before).filter((p) => !(p in next)),
  }
}

export const manifestText = (files) => `${JSON.stringify({ $about: ABOUT, files }, null, 2)}\n`

export function readCommitted() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).files ?? null
  } catch {
    return null
  }
}

export function report(files) {
  const d = diffManifests(readCommitted(), files)
  const n = d.added.length + d.changed.length + d.removed.length
  if (!n) return 'design-sync: the build matches .design-sync/sync-manifest.json (nothing to upload)'
  return [
    `design-sync: ${n} file(s) differ from .design-sync/sync-manifest.json: upload these, delete the removed ones`,
    ...d.added.map((p) => `  new      ${p}`),
    ...d.changed.map((p) => `  changed  ${p}`),
    ...d.removed.map((p) => `  removed  ${p}`),
  ].join('\n')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2]
  if (!dir) throw new Error('usage: node .design-sync/build/manifest.mjs <build dir> [--write]')
  const files = hashDir(path.resolve(dir))
  console.log(report(files))
  if (process.argv.includes('--write')) {
    fs.writeFileSync(MANIFEST_PATH, manifestText(files))
    console.log(`design-sync: wrote ${path.relative(root, MANIFEST_PATH)} (${Object.keys(files).length} files)`)
  }
}
