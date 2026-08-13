// Mobile-sized WebP companions to the bundled ballpark photos.
//
// The slate card's scroll-triggered backdrop on a touch device
// (06a-gamecard-parkart.css + src/lib/ballpark/parkBackdrop.js) uses these
// instead of the 1000px hover JPEGs a desktop pointer arms, because the wash
// renders at 0.24 opacity — a phone screen has neither the pixels nor the
// bandwidth budget to justify full-size art for that.
//
// Hand-run, like the photos themselves (docs/ballpark-photos.md): re-run this
// (`npm run gen:ballpark-thumbs`) after adding or replacing a bundled park
// photo, never on a cron. Reads the CREDITS table in ballparkArt.js rather
// than globbing the directory, so a stray file under public/ballparks/ (a
// logo, a WIP drop) can never produce a stray thumbnail — the credited set IS
// the set of photos this app actually serves.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { CREDITS } from '../src/lib/ballpark/ballparkArt.js'

const SRC_DIR = path.resolve('public/ballparks')
const OUT_DIR = path.resolve('public/ballparks/thumb')

// Sized for the card's ~400px-wide phone slot at up to 2x density — sharper
// than the 0.24-opacity wash it feeds actually needs, a hand-off margin
// rather than a measured floor.
const WIDTH = 480
const QUALITY = 68

const kb = (n) => `${(n / 1024).toFixed(1)} KB`

await mkdir(OUT_DIR, { recursive: true })

const keys = Object.keys(CREDITS).sort()
const rows = []
const failures = []

for (const key of keys) {
  const srcFile = path.join(SRC_DIR, `${key}.jpg`)
  const outFile = path.join(OUT_DIR, `${key}.webp`)
  try {
    const input = await readFile(srcFile)
    const output = await sharp(input).resize({ width: WIDTH }).webp({ quality: QUALITY }).toBuffer()
    await writeFile(outFile, output)
    rows.push({ key, before: input.length, after: output.length })
  } catch (err) {
    failures.push({ key, message: err.message })
  }
}

rows.sort((a, b) => b.before - b.after - (a.before - a.after))
for (const { key, before, after } of rows) {
  console.log(
    `${key.padEnd(28)} ${kb(before).padStart(9)} -> ${kb(after).padStart(9)}  (-${Math.round((1 - after / before) * 100)}%)`,
  )
}
const beforeTotal = rows.reduce((s, r) => s + r.before, 0)
const afterTotal = rows.reduce((s, r) => s + r.after, 0)
console.log(
  `gen-ballpark-thumbs: ${rows.length} of ${keys.length} thumbnails written, ` +
    `${kb(beforeTotal)} -> ${kb(afterTotal)} (-${Math.round((1 - afterTotal / beforeTotal) * 100)}%)`,
)

for (const { key, message } of failures) {
  console.error(`gen-ballpark-thumbs: FAILED ${key}: ${message}`)
}
if (failures.length > 0) process.exit(1)
