// Rebuilds the Tally Baseball design system into a folder, from this repo.
//   node .design-sync/build/run.mjs [--out <dir>] [--capture]
// --out      where to write (default: ds-bundle in the repo root, which .gitignore skips).
// --capture  first re-capture the seven player cards from a running dev server on localhost:5173
//            (npm run dev). Without it the committed captures in .design-sync/captures/ are used.
// Needs `npm install` first: it copies fonts from node_modules/@fontsource and, for --capture, uses playwright.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const outArg = args.indexOf('--out')
const out = path.resolve(outArg >= 0 ? args[outArg + 1] : path.join(root, 'ds-bundle'))
const env = { ...process.env, DS_OUT: out }

const steps = [
  ...(args.includes('--capture') ? ['capture.mjs'] : []),
  'css.mjs', 'tokens.mjs', 'previews.mjs', 'motion.mjs', 'playercards.mjs',
]
for (const step of steps) {
  const r = spawnSync(process.execPath, [path.join(root, '.design-sync/build', step)], { cwd: root, env, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`design-sync: ${step} failed (exit ${r.status})`)
    process.exit(r.status || 1)
  }
}
console.log(`design-sync: built into ${out}`)
