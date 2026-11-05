// Post-build guard (#2873): the commit SHA lives in index.html, never in the JS.
//
// A per-deploy value inside a chunk changes that chunk's hash, and every chunk
// that imports it is renamed with it. When the SHA sat in the entry chunk, each
// deploy (even a nightly data-only one) renamed ~340 of 548 files in
// dist/assets, and every installed PWA downloaded ~40 precached chunks again.
// vite.config.js's buildCommitMeta now writes it to <meta name="build-commit">,
// and src/lib/buildInfo.js reads it from there. This checks the shipped bytes:
// the tag is in dist/index.html, and its SHA is in no file under dist/assets.
//
// Needs a build, so it runs in CI after `npm run build`, not in `npm run lint`.
// Locally: `npm run build && npm run check:commit`.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '../../dist')

const html = await readFile(path.join(DIST, 'index.html'), 'utf8')
const sha = html.match(/<meta name="build-commit" content="([0-9a-f]{7,40})"/)?.[1]
if (!sha) {
  console.error('check-commit-not-in-js: dist/index.html has no <meta name="build-commit">; the footer build stamp would be blank.')
  process.exit(1)
}

const leaks = []
for (const name of await readdir(path.join(DIST, 'assets'))) {
  if (!/\.(js|css)$/.test(name)) continue
  const text = await readFile(path.join(DIST, 'assets', name), 'utf8')
  if (text.includes(sha)) leaks.push(name)
}
if (leaks.length) {
  console.error(`check-commit-not-in-js: the build commit ${sha} is inside ${leaks.length} asset(s): ${leaks.join(', ')}.`)
  console.error('Every deploy would rename these chunks and everything that imports them. Read it from the index.html meta tag instead (src/lib/buildInfo.js).')
  process.exit(1)
}
console.log(`check-commit-not-in-js: ok (commit ${sha.slice(0, 7)} only in index.html)`)
