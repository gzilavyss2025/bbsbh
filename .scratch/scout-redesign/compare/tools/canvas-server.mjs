// Serves the downloaded canvas boards for local rendering. Usage: node canvas-server.mjs <dir with project/ and artifact-type/>
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root = process.argv[2]
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x').pathname
  let f
  if (u === '/support.js') f = path.join(root, 'artifact-type/dc-runtime.js')
  else f = path.join(root, 'project', u)
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' })
  fs.createReadStream(f).pipe(res)
}).listen(5199, () => console.log('canvas on 5199'))
