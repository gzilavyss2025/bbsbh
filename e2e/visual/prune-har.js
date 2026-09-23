import { readdirSync, readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// After a recording (VISUAL_RECORD=1), delete each response body in har/ that no
// HAR names any more. A HAR stores its bodies as separate files named by their
// hash, and shares them between HARs; re-recording a page writes new bodies but
// leaves the old ones behind. Runs once, after every worker has saved its HARs,
// so it never deletes a body that a HAR still being written is about to name.
export default async function pruneHar() {
  if (!process.env.VISUAL_RECORD) return
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'har')
  const files = readdirSync(dir)
  const named = new Set()
  for (const f of files.filter((f) => f.endsWith('.har'))) {
    for (const e of JSON.parse(readFileSync(path.join(dir, f), 'utf8')).log.entries) {
      if (e.response.content?._file) named.add(e.response.content._file)
      if (e.request.postData?._file) named.add(e.request.postData._file)
    }
  }
  let removed = 0
  for (const f of files) {
    if (f.endsWith('.har') || named.has(f)) continue
    unlinkSync(path.join(dir, f))
    removed++
  }
  console.log(`[visual] kept ${named.size} recorded bodies, removed ${removed} no HAR names`)
}
