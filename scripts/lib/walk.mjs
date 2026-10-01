// Shared directory walk for the guard scripts (check-*.mjs).
//
// Same behaviour the guards each hand-rolled: readdir order, depth first,
// symlinks followed (statSync), a skipped name is skipped at any depth.
// Paths in and out are absolute. A guard that wants repo-relative paths
// calls path.relative(ROOT, file) itself.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The repo root, two levels above scripts/lib/.
export const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

export const DEFAULT_SKIP = new Set(['node_modules', 'dist', '.git'])

function entriesOf(dir, tolerant) {
  if (!tolerant) return readdirSync(dir)
  try {
    return readdirSync(dir)
  } catch {
    return [] // an optional directory may not exist
  }
}

// Files under `dir`. `exts` (suffixes such as '.js') filters by name; omit it
// to list every file. `skip` is a Set of names to ignore. `tolerant` returns
// nothing, instead of throwing, for a missing directory.
export function walk(dir, { skip = DEFAULT_SKIP, exts, tolerant = false } = {}, out = []) {
  for (const entry of entriesOf(dir, tolerant)) {
    if (skip.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, { skip, exts, tolerant }, out)
    else if (!exts || exts.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

// `dir` and every directory beneath it, parent before children.
export function walkDirs(dir, { skip = DEFAULT_SKIP } = {}, out = []) {
  out.push(dir)
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walkDirs(full, { skip }, out)
  }
  return out
}
