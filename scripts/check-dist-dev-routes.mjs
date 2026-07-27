// Post-build guard: assert the dev-only write-back never reaches production.
//
// The Team Identity Lab and the Uniform Names page POST to vite.config.js's
// devDataSave() middleware, which writes straight to files in this repo. Four
// independent layers keep that out of the deployed app (ADR-0029); three of them
// are code you can read, and this is the fourth — the one that actually checks
// the artifact. If a refactor ever drops the `import.meta.env.DEV` gate in
// App.jsx, or someone imports a lab module from a shipped screen, the tree-shake
// stops working and the '/__dev' string turns up in dist/. That is the signal.
//
// Wired into the CI lint-and-build job (.github/workflows/ci.yml) after
// `npm run build`, not into `npm run lint`, because it needs a build to inspect.
// Run it locally the same way: `npm run build && npm run check:dist-dev`.
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)))

// The endpoint prefix every dev-only save posts to. Deliberately the literal
// string rather than an import: this checks the SHIPPED BYTES, so it must not
// be able to drift by following the same refactor it exists to catch.
const FORBIDDEN = '/__dev'

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
for await (const file of walk(DIST)) {
  if (!TEXT_EXT.has(path.extname(file))) continue
  scanned++
  const text = await readFile(file, 'utf8')
  if (text.includes(FORBIDDEN)) offenders.push(path.relative(DIST, file))
}

if (offenders.length) {
  console.error(
    `check-dist-dev-routes: "${FORBIDDEN}" reached the production build in:\n` +
      offenders.map((f) => `  dist/${f}`).join('\n') +
      '\n\nA dev-only save endpoint must never ship. Check that every lab screen is\n' +
      'still gated behind `import.meta.env.DEV` in src/App.jsx, and that no shipped\n' +
      'module imports one — see docs/adr/0029-dev-only-data-write-back.md.',
  )
  process.exit(1)
}

console.log(`check-dist-dev-routes: ok — no "${FORBIDDEN}" in ${scanned} built files.`)
