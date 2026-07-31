// Recompress the curated club marks under public/team-logos/ in place.
//
// The art arrives through the Identity Lab's drag-and-drop (or by hand) as
// whatever bytes the source export carried — routinely a 250-300 KB RGBA PNG
// for a mark the app renders at 56 CSS px. This script palette-quantizes each
// PNG with sharp (the same lossy-but-invisible reduction TinyPNG performs),
// which typically lands 5-10x smaller with identical on-screen appearance.
//
// Runs standalone (`node scripts/compress-logos.mjs`) and as a nightly step in
// .github/workflows/update-nightly-data.yml, where it sweeps up anything newly
// uploaded since the last run. Idempotency comes from the PNG's own color
// type, not a ledger: quantization writes a palette PNG (color type 3), so a
// palette file has been through this — or TinyPNG, or any equivalent — and is
// SKIPPED. That guard is load-bearing: without it each nightly pass
// re-quantizes the previous night's output, shaving another 10-30% and a
// little more fidelity every single night (measured, not hypothetical —
// quality degrades cumulatively). Uploads from design exports are RGBA
// (color type 6), so new art is always picked up.
//
// Safety rails, because this overwrites hand-procured art:
//   - PNG only (the .svg art and the custom/ recolored-mark library are text
//     and stay untouched).
//   - The output must still parse as a PNG with the exact same pixel
//     dimensions as the input (readPngHeader — the same header reader the
//     upload contract validates with), or the original is kept.
//   - Any per-file failure keeps the original and is reported at the end;
//     the run exits non-zero so the nightly job's fail-check surfaces it.
//
// After a run that changed anything, the coverage manifest must be rebuilt
// (`node scripts/gen-logo-art.mjs`) — it records each file's exact byte size
// and test/logo-upload.test.js pins it against disk. The nightly workflow runs
// that step right after this one; do the same by hand.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { LOGO_ART_ROOT, readPngHeader } from '../src/lib/logoArt.js'

// Rewrite only when quantization actually pays. 0.9 (10% savings) is the
// no-op threshold that makes re-running safe: a second quantization pass
// lands within a few percent of the first, well under this bar.
const MIN_SAVINGS_RATIO = 0.9

const root = path.resolve(LOGO_ART_ROOT)

async function pngFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      out.push(path.join(entry.parentPath ?? entry.path, entry.name))
    }
  }
  return out.sort()
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`

const files = await pngFiles(root)
const rows = []
const failures = []
let beforeTotal = 0
let afterTotal = 0

for (const file of files) {
  const rel = path.relative(root, file).replaceAll('\\', '/')
  const input = await readFile(file)
  beforeTotal += input.length
  const inHeader = readPngHeader(input)
  if (inHeader?.colorType === 3) {
    afterTotal += input.length
    continue
  }
  try {
    const output = await sharp(input)
      .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
      .toBuffer()
    const outHeader = readPngHeader(output)
    const intact =
      inHeader &&
      outHeader &&
      outHeader.width === inHeader.width &&
      outHeader.height === inHeader.height
    if (intact && output.length < input.length * MIN_SAVINGS_RATIO) {
      await writeFile(file, output)
      afterTotal += output.length
      rows.push({ rel, before: input.length, after: output.length })
    } else {
      afterTotal += input.length
    }
  } catch (err) {
    afterTotal += input.length
    failures.push({ rel, message: err.message })
  }
}

if (rows.length === 0) {
  console.log(`compress-logos: ${files.length} PNGs checked, nothing to compress`)
} else {
  rows.sort((a, b) => b.before - b.after - (a.before - a.after))
  for (const { rel, before, after } of rows) {
    console.log(
      `${rel.padEnd(34)} ${kb(before).padStart(9)} -> ${kb(after).padStart(9)}  (-${Math.round((1 - after / before) * 100)}%)`,
    )
  }
  console.log(
    `compress-logos: ${rows.length} of ${files.length} PNGs rewritten, ` +
      `${kb(beforeTotal)} -> ${kb(afterTotal)} (-${Math.round((1 - afterTotal / beforeTotal) * 100)}%) — ` +
      `now run: node scripts/gen-logo-art.mjs`,
  )
}

for (const { rel, message } of failures) {
  console.error(`compress-logos: FAILED ${rel}: ${message}`)
}
if (failures.length > 0) process.exit(1)
