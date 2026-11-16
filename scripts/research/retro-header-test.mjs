// The one-file Blob header test (#3135, decided on #2234 before any history build):
// does Vercel Blob serve a public JSON file compressed, with CORS, and does it answer a
// Range request? Uploads a ~1 MB throwaway JSON to `retro/v1/_header-test.json`, reads its
// headers with curl as a browser would ask, deletes it, and exits 1 when the file comes
// back uncompressed or without an Access-Control-Allow-Origin header (the page could not
// read it, or would download about ten times the gzip size). Range is reported, not
// required. Run by .github/workflows/retro-store.yml before the build. Needs
// BLOB_READ_WRITE_TOKEN.

import { execFileSync } from 'node:child_process'

if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('needs BLOB_READ_WRITE_TOKEN')
const { put, del } = await import('@vercel/blob')

// About 1 MB of column-array JSON shaped like a month shard, so it compresses like one.
const rows = 60000
const body = JSON.stringify({ v: 1, test: true, c: [Array.from({ length: rows }, (_, i) => 380000 + (i >> 6)), Array.from({ length: rows }, (_, i) => ['SBBFX', 'CX', 'BBBB', ''][i % 4])] })
const { url } = await put('retro/v1/_header-test.json', body, { access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 60 })
console.log(`uploaded ${(body.length / 1e6).toFixed(2)} MB to ${url}`)

const headers = (extra) => {
  const out = execFileSync('curl', ['-sS', '-D', '-', '-o', '/dev/null', '-H', 'Accept-Encoding: gzip, br', '-H', 'Origin: https://bbsbh.vercel.app', ...extra, url]).toString()
  const status = out.split('\r\n')[0]
  const h = Object.fromEntries(out.split('\r\n').slice(1).filter((l) => l.includes(':')).map((l) => [l.slice(0, l.indexOf(':')).toLowerCase(), l.slice(l.indexOf(':') + 1).trim()]))
  return { status, h }
}

let failed = false
try {
  // A blob just written can miss on the CDN for a moment: ask up to three times.
  let full = headers([])
  for (let t = 1; t < 3 && !/ 200\b/.test(full.status); t++) {
    await new Promise((r) => setTimeout(r, 5000))
    full = headers([])
  }
  const range = headers(['-H', 'Range: bytes=0-1023'])
  const show = (k, r) => console.log(`  ${k}: ${r.h[k] ?? '(none)'}`)
  console.log(`GET: ${full.status}`)
  for (const k of ['content-encoding', 'content-length', 'access-control-allow-origin', 'cache-control', 'accept-ranges']) show(k, full)
  console.log(`GET with Range 0-1023: ${range.status}`)
  for (const k of ['content-range', 'content-length', 'content-encoding']) show(k, range)
  if (!/ 200\b/.test(full.status)) {
    console.error(`::error::the test file answered ${full.status}, not 200: the checks below mean nothing`)
    failed = true
  } else if (!full.h['content-encoding']) {
    console.error('::error::Blob served the JSON uncompressed: the history store would download about 10 times its gzip size')
    failed = true
  }
  if (/ 200\b/.test(full.status) && !full.h['access-control-allow-origin']) {
    console.error('::error::no Access-Control-Allow-Origin header: the page could not read the store')
    failed = true
  }
} finally {
  await del(url)
  console.log('deleted the test file')
}
if (failed) process.exit(1)
