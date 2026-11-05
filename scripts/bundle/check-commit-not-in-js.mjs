// Post-build guard (#2873): nothing that changes per deploy lives in the JS.
//
// A per-deploy value inside a chunk changes that chunk's hash, and every chunk
// that imports it is renamed with it. When the commit SHA sat in the entry
// chunk, each deploy (even a nightly data-only one) renamed ~340 of 548 files
// in dist/assets, and every installed PWA downloaded ~40 precached chunks again.
// vite.config.js's buildCommitMeta writes it to <meta name="build-commit"> in
// index.html, and src/lib/buildInfo.js reads it from there.
//
// Three checks on the shipped bytes, every file under dist/assets:
// 1. index.html carries the meta tag (or the footer stamp goes blank).
// 2. No asset holds that SHA, full or short.
// 3. No asset holds Vite's inlined env OBJECT (`SSR:!1,VITE_…`). A bare
//    `import.meta.env` read inlines every VITE_* variable, and on Vercel those
//    include VITE_VERCEL_GIT_COMMIT_SHA and VITE_VERCEL_URL, which change on
//    every deploy. CI has neither, so check 2 alone can't see that leak. Read
//    keys statically (`import.meta.env.VITE_X`) instead.
//
// Needs a build, so it runs in CI after `npm run build`, not in `npm run lint`.
// Locally: `npm run build && npm run check:commit`. Pure half tested in
// test/commit-guard.test.js.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const DIST = path.resolve(import.meta.dirname, '../../dist')

export function metaCommit(html) {
  return html.match(/<meta name="build-commit" content="([0-9a-f]{7,40})"/)?.[1] ?? null
}

// What in one asset's text would change on the next deploy. The short SHA is
// matched only between non-alphanumerics, so a hash-like run inside an
// identifier or a filename hash can't trip it by chance.
export function assetProblems(text, sha) {
  const problems = []
  if (sha && (text.includes(sha) || new RegExp(`(^|[^0-9A-Za-z])${sha.slice(0, 7)}($|[^0-9A-Za-z])`).test(text))) {
    problems.push(`the build commit ${sha.slice(0, 7)}`)
  }
  if (/SSR:!1,VITE_/.test(text)) problems.push('the inlined import.meta.env object (a bare `import.meta.env` read)')
  return problems
}

async function main() {
  const sha = metaCommit(await readFile(path.join(DIST, 'index.html'), 'utf8'))
  if (!sha) {
    console.error('check-commit-not-in-js: dist/index.html has no <meta name="build-commit">; the footer build stamp would be blank.')
    process.exit(1)
  }
  const leaks = []
  for (const entry of await readdir(path.join(DIST, 'assets'), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(js|css)$/.test(entry.name)) continue
    const file = path.join(entry.parentPath, entry.name)
    for (const problem of assetProblems(await readFile(file, 'utf8'), sha)) {
      leaks.push(`${path.relative(DIST, file)}: ${problem}`)
    }
  }
  if (leaks.length) {
    console.error('check-commit-not-in-js: per-deploy values in the JS. Every deploy would rename these chunks and everything that imports them:')
    for (const leak of leaks) console.error(`  ${leak}`)
    console.error('The commit belongs in the index.html meta tag (src/lib/buildInfo.js); read env keys statically.')
    process.exit(1)
  }
  console.log(`check-commit-not-in-js: ok (commit ${sha.slice(0, 7)} only in index.html, no inlined env object)`)
}

if (import.meta.main) main()
