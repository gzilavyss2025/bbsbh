#!/usr/bin/env node
// #2578 spike, unknown 2: does MLB's push socket accept a BROWSER? A browser
// sends an Origin header; the Node capture script sends none.
//
//   node browser-check.mjs --gamePk=849805 [--holdSec=20] [--origin=http://127.0.0.1]
//
// Opens a page on a local HTTP server (so the Origin is a real, local one),
// connects the socket from that page in headless Chromium, and reports the
// handshake status, the Origin header actually sent, and how the socket closed.
// Same spoiler rule as capture.mjs: message SHAPES only, never values.
//
// It does not pretend to be the production site. To test the production
// origin, serve this page there with Gary's agreement.
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { parseArgs } from '../../scripts/lib/args.mjs'
import { statsapiUrl } from '../../scripts/lib/statsapi.mjs'
import { classify, shape } from './shape.mjs'

const args = parseArgs(process.argv.slice(2))
const gamePk = Number(args.gamePk)
if (!Number.isInteger(gamePk)) {
  console.error('usage: node browser-check.mjs --gamePk=849805 [--holdSec=20]')
  process.exit(2)
}
const holdMs = Number(args.holdSec || 20) * 1000
const url = statsapiUrl(`/api/v1/game/push/subscribe/gameday/${gamePk}`).replace('https://', 'wss://ws.')

const server = createServer((_, res) => {
  res.setHeader('content-type', 'text/html')
  res.end('<!doctype html><title>push probe</title><p>push probe</p>')
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const pageUrl = `http://127.0.0.1:${server.address().port}/`

const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }))
const context = await browser.newContext()
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('Network.enable')

const seen = { origin: null, handshakeStatus: null, frames: 0, shapes: {} }
cdp.on('Network.webSocketWillSendHandshakeRequest', (e) => {
  seen.origin = e.request.headers.Origin || e.request.headers.origin || '(none)'
})
cdp.on('Network.webSocketHandshakeResponseReceived', (e) => {
  seen.handshakeStatus = e.response.status
})
cdp.on('Network.webSocketFrameReceived', (e) => {
  seen.frames++
  const { json, ack } = classify(e.response.payloadData)
  const key = JSON.stringify(json === undefined ? `<${ack ? 'ack' : 'non-json'} ${e.response.payloadData.length} chars>` : shape(json))
  seen.shapes[key] = (seen.shapes[key] || 0) + 1
})

await page.goto(pageUrl)
const result = await page.evaluate(
  ({ url, holdMs }) =>
    new Promise((resolve) => {
      const t0 = performance.now()
      const out = { opened: false, openMs: null, closeCode: null, closeReasonChars: null, errored: false, heldMs: null }
      let ka
      const ws = new WebSocket(url)
      const done = () => {
        clearInterval(ka)
        out.heldMs = Math.round(performance.now() - t0)
        resolve(out)
      }
      ws.onopen = () => {
        out.opened = true
        out.openMs = Math.round(performance.now() - t0)
        ka = setInterval(() => ws.readyState === 1 && ws.send('Gameday5'), 10_000)
        setTimeout(() => ws.close(1000), holdMs)
      }
      ws.onerror = () => {
        out.errored = true
      }
      ws.onclose = (e) => {
        out.closeCode = e.code
        out.closeReasonChars = e.reason.length
        done()
      }
    }),
  { url, holdMs },
)

console.log(JSON.stringify({ gamePk, pageOrigin: new URL(pageUrl).origin, originHeaderSent: seen.origin, handshakeStatus: seen.handshakeStatus, ...result, frames: seen.frames, shapes: seen.shapes }, null, 2))
await browser.close()
server.close()
