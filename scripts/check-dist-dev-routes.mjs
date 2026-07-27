// Post-build guard: assert the dev-only write-back never reaches production —
// and that the art it writes still does.
//
// The Team Identity Lab and the Uniform Names page POST to vite.config.js's
// devDataSave() middleware, which writes straight to files in this repo. Four
// independent layers keep that out of the deployed app (ADR-0029); three of them
// are code you can read, and this is the fourth — the one that actually checks
// the artifact. If a refactor ever drops the `import.meta.env.DEV` gate in
// App.jsx, or someone imports a lab module from a shipped screen, the tree-shake
// stops working and the '/__dev' string turns up in dist/. That is the signal.
//
// The logo upload (/__dev/team-logo) inverts the same question, so this checks
// both halves of it: the endpoint must not ship, but the files it writes — the
// curated marks under public/team-logos/ — must, since those are ordinary
// static art the deployed app renders on every slate card. A build that carried
// the endpoint would be a security problem; a build that dropped the art would
// be a blank tile on every game.
//
// Wired into the CI lint-and-build job (.github/workflows/ci.yml) after
// `npm run build`, not into `npm run lint`, because it needs a build to inspect.
// Run it locally the same way: `npm run build && npm run check:dist-dev`.
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)))

// The endpoint prefix every dev-only save posts to, plus the one route that
// takes bytes instead of JSON. Deliberately literal strings rather than
// imports: this checks the SHIPPED BYTES, so it must not be able to drift by
// following the same refactor it exists to catch. The second is redundant with
// the prefix today and is here on purpose — if the logo upload is ever remounted
// somewhere other than /__dev, this still names it.
const FORBIDDEN = ['/__dev', 'team-logo?teamId']

// The curated art the upload endpoint writes. Vite copies public/ into dist/
// verbatim, so this is a low bar — but it is the assertion that says the
// pipeline's OUTPUT ships even though the pipeline doesn't.
const REQUIRED_DIR = 'team-logos'

// Text formats a bundler could carry the string in. Images and fonts can't.
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.map', '.svg', '.txt'])

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

let distExists = true
try {
  await stat(DIST)
} catch {
  distExists = false
}
if (!distExists) {
  console.error('check-dist-dev-routes: no dist/ — run `npm run build` first.')
  process.exit(1)
}

const offenders = []
let scanned = 0
let artFiles = 0
for await (const file of walk(DIST)) {
  const rel = path.relative(DIST, file).split(path.sep).join('/')
  if (rel.startsWith(`${REQUIRED_DIR}/`)) artFiles++
  if (!TEXT_EXT.has(path.extname(file))) continue
  scanned++
  const text = await readFile(file, 'utf8')
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) offenders.push(`${rel} (${needle})`)
  }
}

if (offenders.length) {
  console.error(
    'check-dist-dev-routes: a dev-only endpoint reached the production build in:\n' +
      offenders.map((f) => `  dist/${f}`).join('\n') +
      '\n\nA dev-only save endpoint must never ship. Check that every lab screen is\n' +
      'still gated behind `import.meta.env.DEV` in src/App.jsx, and that no shipped\n' +
      'module imports one — see docs/adr/0029-dev-only-data-write-back.md.',
  )
  process.exit(1)
}

if (!artFiles) {
  console.error(
    `check-dist-dev-routes: dist/${REQUIRED_DIR}/ is empty or missing.\n\n` +
      'The curated club marks are ordinary static art the deployed app renders on\n' +
      'every slate card and in-game masthead — only the endpoint that WRITES them is\n' +
      'dev-only. Check that public/team-logos/ is still being copied into the build.',
  )
  process.exit(1)
}

console.log(
  `check-dist-dev-routes: ok — no dev-only endpoint in ${scanned} built files, ` +
    `and ${artFiles} curated marks shipped.`,
)
