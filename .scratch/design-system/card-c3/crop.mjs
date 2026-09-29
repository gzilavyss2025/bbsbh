import sharp from 'file:///C:/Users/gzilavy/bbsbh-card-c3/node_modules/sharp/dist/index.cjs'
const [f, x, y, w, h, out] = process.argv.slice(2)
const W = Number(w), H = Number(h)
const parts = []
for (const d of ['before', 'after', 'diff']) {
  try { parts.push(await sharp(`${d}/${f}`).extract({ left: Number(x), top: Number(y), width: W, height: H }).png().toBuffer()) } catch (e) { console.log(d, e.message) }
}
await sharp({ create: { width: W * parts.length + 10 * (parts.length - 1), height: H, channels: 4, background: { r: 136, g: 136, b: 136, alpha: 1 } } })
  .composite(parts.map((p, i) => ({ input: p, left: i * (W + 10), top: 0 }))).png().toFile(out)
