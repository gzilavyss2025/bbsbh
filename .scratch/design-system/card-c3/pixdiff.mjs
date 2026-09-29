import sharp from 'file:///C:/Users/gzilavy/bbsbh-card-c3/node_modules/sharp/dist/index.cjs'
import { readdirSync, mkdirSync } from 'node:fs'
mkdirSync('diff', { recursive: true })
for (const f of readdirSync('before').filter((f) => f.endsWith('.png'))) {
  let a, b
  try { a = await sharp(`before/${f}`).raw().ensureAlpha().toBuffer({ resolveWithObject: true }); b = await sharp(`after/${f}`).raw().ensureAlpha().toBuffer({ resolveWithObject: true }) } catch (e) { console.log(f, 'missing'); continue }
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) { console.log(f, 'SIZE', a.info.width + 'x' + a.info.height, '->', b.info.width + 'x' + b.info.height); continue }
  const { width, height } = a.info
  let n = 0, minx = 1e9, miny = 1e9, maxx = -1, maxy = -1
  const out = Buffer.from(b.data)
  const rows = new Map()
  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    const d = Math.max(Math.abs(a.data[o] - b.data[o]), Math.abs(a.data[o + 1] - b.data[o + 1]), Math.abs(a.data[o + 2] - b.data[o + 2]))
    if (d > 10) { n++; const x = i % width, y = (i / width) | 0; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); out[o] = 255; out[o + 1] = 0; out[o + 2] = 255; const band = (y / 50) | 0; rows.set(band, (rows.get(band) ?? 0) + 1) }
  }
  if (n) { await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(`diff/${f}`) }
  console.log(f, n ? `DIFF ${n}px box ${minx},${miny}-${maxx},${maxy} bands ${[...rows.entries()].slice(0, 8).map(([k, v]) => k * 50 + ':' + v).join(' ')}` : 'same')
}
