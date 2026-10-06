// Hand-run download of one open-dataset file (ADR-0100). The datasets (Retrosheet,
// the Chadwick register) are read at BUILD time by hand-run generators, never by
// the app. A download is untrusted data, so it goes into its own NEW, EMPTY folder
// OUTSIDE the repo, and a generator takes the extracted paths as arguments.
//
//   node scripts/lib/open-data/download.mjs <url> <empty-folder>
//
// Prints the byte count. Refuses a folder inside the repo or a folder that already
// holds a file, so a planted file can never sit beside the one it fetched.
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url))

// -> { path, bytes }. `fetchFn` and `log` are injected so the test stays offline.
export async function downloadTo(url, dir, { fetchFn = fetch, log = console.log } = {}) {
  const name = basename(new URL(url).pathname)
  if (!name) throw new Error(`no file name in ${url}`)
  const target = resolve(dir)
  const rel = relative(REPO, target)
  const outside = rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
  if (!outside) throw new Error(`${target} is inside the repo`)
  await mkdir(target, { recursive: true })
  if ((await readdir(target)).length) throw new Error(`${target} is not empty`)

  const res = await fetchFn(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const path = join(target, name)
  await writeFile(path, bytes)
  log(`${name}: ${bytes.length} bytes -> ${path}`)
  return { path, bytes: bytes.length }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [url, dir] = process.argv.slice(2)
  if (!url || !dir) throw new Error('usage: download.mjs <url> <empty-folder>')
  await downloadTo(url, dir)
}
