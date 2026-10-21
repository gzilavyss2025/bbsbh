// Hand-run: node .scratch/milb-rename-candidates/convert.mjs <in.gif|webp|jpg|png> <out.png> [--clear-bg]
// --clear-bg: the picture sits on a flat non-white rectangle (a black or green
// box). Pixels matching the most common edge colour and connected to the edge
// go transparent first. Opt in per file: a logo that IS a coloured box (the
// Bakersfield Dodgers' blue tile) must not have its fill cleared.
// Turns a found logo into the PNG the Eras tab takes: first frame, edge white
// cleared and edges trimmed with the SAME function the tab runs on a drop
// (src/lib/image/imageTrim.js), so the file is what an upload would have made.
import sharp from 'sharp'
import { trimAndClear } from '../../src/lib/image/imageTrim.js'

const [input, output] = process.argv.slice(2).filter((a) => !a.startsWith('--'))

function clearFlatBackground(px, width, height, tolerance = 24) {
  // The fill is the most common colour on the edge: a corner pixel alone can be
  // an anti-aliased or dithered one.
  const tally = new Map()
  const edge = (x, y) => {
    const at = (y * width + x) * 4
    const key = `${px[at]},${px[at + 1]},${px[at + 2]}`
    tally.set(key, (tally.get(key) ?? 0) + 1)
  }
  for (let x = 0; x < width; x++) (edge(x, 0), edge(x, height - 1))
  for (let y = 0; y < height; y++) (edge(0, y), edge(width - 1, y))
  const c = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number)
  const close = (at) => Math.abs(px[at] - c[0]) <= tolerance && Math.abs(px[at + 1] - c[1]) <= tolerance && Math.abs(px[at + 2] - c[2]) <= tolerance
  const seen = new Uint8Array(width * height)
  const stack = []
  const push = (x, y) => {
    const at = y * width + x
    if (seen[at] || !close(at * 4)) return
    seen[at] = 1
    stack.push(at)
  }
  for (let x = 0; x < width; x++) (push(x, 0), push(x, height - 1))
  for (let y = 0; y < height; y++) (push(0, y), push(width - 1, y))
  while (stack.length) {
    const at = stack.pop()
    px[at * 4 + 3] = 0
    const x = at % width
    const y = (at - x) / width
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }
}
// A flat-background picture usually has a 1-3 px frame of dithered or anti-aliased
// pixels the flood fill cannot match; cut it off first.
const FRAME = 4
let img = sharp(input).ensureAlpha()
if (process.argv.includes('--clear-bg')) {
  const { width, height } = await sharp(input).metadata()
  img = img.extract({ left: FRAME, top: FRAME, width: width - 2 * FRAME, height: height - 2 * FRAME })
}
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
if (process.argv.includes('--clear-bg')) clearFlatBackground(data, info.width, info.height)
const out = trimAndClear({ data, width: info.width, height: info.height })
if (!out) throw new Error('nothing left after clearing the background')
await sharp(Buffer.from(out.data), { raw: { width: out.width, height: out.height, channels: 4 } }).png().toFile(output)
console.log(`${input}: ${info.width}x${info.height} -> ${out.width}x${out.height}`)
