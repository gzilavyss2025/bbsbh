// Hand-run: node .scratch/milb-rename-candidates/convert.mjs <in.gif|webp|jpg|png> <out.png>
// Turns a found logo into the PNG the Eras tab takes: first frame, edge white
// cleared and edges trimmed with the SAME function the tab runs on a drop
// (src/lib/image/imageTrim.js), so the file is what an upload would have made.
import sharp from 'sharp'
import { trimAndClear } from '../../src/lib/image/imageTrim.js'

const [input, output] = process.argv.slice(2)
const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const out = trimAndClear({ data, width: info.width, height: info.height })
if (!out) throw new Error('nothing left after clearing the background')
await sharp(Buffer.from(out.data), { raw: { width: out.width, height: out.height, channels: 4 } }).png().toFile(output)
console.log(`${input}: ${info.width}x${info.height} -> ${out.width}x${out.height}`)
