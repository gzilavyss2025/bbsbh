// The testable half of scripts/download-game-notes.mjs (#1258): where a Game Notes
// PDF lands on disk, and the loop that saves the ones a folder does not have yet.
// A script file runs on import, so the helper lives here where the unit suite can
// reach it with an injected fetch (scripts/CLAUDE.md).
//
// The rule that makes a second run cheap: a PDF is "had" when its final file
// exists and holds bytes. Nothing is written to that name until the whole body
// has arrived and looks like a PDF (a `.part` file, then a rename), so a run
// killed halfway never leaves a truncated file that the next run would trust.

import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const SAFE = /[^A-Za-z0-9_-]/g

// The id MLB's image CDN gave the file — the last path segment, no extension.
// It is unique per PDF, which is why it names the file: two notes for one club on
// one date (a doubleheader) still land apart. Anything outside [A-Za-z0-9_-] is
// flattened, so a hand-edited or hostile URL cannot walk out of the folder.
function publicId(url) {
  let last = ''
  try {
    last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
  } catch {
    last = String(url).split('/').filter(Boolean).pop() ?? ''
  }
  return last.replace(/\.pdf$/i, '').replace(SAFE, '_') || 'note'
}

// {teamId}/{date}_{publicId}.pdf — relative to the download folder.
export function pdfPath({ teamId, date, url }) {
  const team = String(teamId).replace(SAFE, '_')
  const day = String(date).replace(SAFE, '_')
  return `${team}/${day}_${publicId(url)}.pdf`
}

async function hasFile(path) {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

const isPdf = (bytes) =>
  bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46

async function saveOne(row, dir, fetchFn) {
  const file = join(dir, pdfPath(row))
  const res = await fetchFn(row.url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (!isPdf(bytes)) throw new Error('response is not a PDF')
  await mkdir(dirname(file), { recursive: true })
  const part = `${file}.part`
  try {
    await writeFile(part, bytes)
    await rename(part, file)
  } catch (err) {
    await unlink(part).catch(() => {})
    throw err
  }
}

// Save every row whose file is missing, at most `concurrency` at a time. Returns
// { saved, skipped, failed: [{ row, reason }] }. A failure never stops the run and
// leaves nothing behind, so the next run simply tries that row again.
export async function downloadMissing({
  rows,
  dir,
  fetchFn = fetch,
  concurrency = 4,
  onProgress = () => {},
}) {
  const seen = new Set()
  const unique = rows.filter((r) => {
    const key = pdfPath(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const out = { saved: 0, skipped: 0, failed: [] }
  let next = 0
  let done = 0
  async function worker() {
    while (next < unique.length) {
      const row = unique[next++]
      if (await hasFile(join(dir, pdfPath(row)))) {
        out.skipped += 1
      } else {
        try {
          await saveOne(row, dir, fetchFn)
          out.saved += 1
        } catch (err) {
          out.failed.push({ row, reason: err?.message || String(err) })
        }
      }
      done += 1
      onProgress({ done, total: unique.length, ...out })
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  return out
}
