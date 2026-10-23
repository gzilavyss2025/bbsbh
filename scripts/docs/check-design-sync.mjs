#!/usr/bin/env node
// The design-sync build must still build, and build the same twice (#2527). `node
// .design-sync/build/run.mjs` makes every file of the "Tally Baseball" design project; nothing ran
// it except a person about to upload, so a token added with no usage line (usage-data.json) broke
// it quietly until then. This runs it twice into temp folders: a failed build prints its own
// message (it names the token), and two builds of one tree must hash the same. It never writes into
// the repo and never uploads. Whether the project is up to date is a separate question,
// answered by `node .design-sync/build/run.mjs` against .design-sync/sync-manifest.json.
// Run by `npm run lint`.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from '../lib/walk.mjs'

const { hashDir } = await import(pathToFileURL(join(ROOT, '.design-sync/build/manifest.mjs')).href)

const built = []
try {
  for (let i = 0; i < 2; i++) {
    const out = mkdtempSync(join(tmpdir(), 'design-sync-'))
    built.push(out)
    const r = spawnSync(process.execPath, [join(ROOT, '.design-sync/build/run.mjs'), '--out', out], { cwd: ROOT, encoding: 'utf8' })
    if (r.status !== 0) {
      console.error('✗ design-sync guard: the build failed.')
      console.error(`${r.stdout}${r.stderr}`.trim().split('\n').slice(-12).map((l) => `  ${l}`).join('\n'))
      console.error('  A token with no usage line: add it to .design-sync/build/usage-data.json.')
      process.exit(1)
    }
  }
  const [a, b] = built.map(hashDir)
  const differs = Object.keys({ ...a, ...b }).filter((p) => a[p] !== b[p])
  if (differs.length) {
    console.error(`✗ design-sync guard: two builds of one tree differ (${differs.length} file(s)).`)
    for (const p of differs.slice(0, 10)) console.error(`  ${p}`)
    console.error('  The build must not read a clock or a random value.')
    process.exit(1)
  }
  console.log(`✓ design-sync guard holds — the build runs and writes the same ${Object.keys(a).length} files twice.`)
} finally {
  for (const dir of built) rmSync(dir, { recursive: true, force: true })
}
