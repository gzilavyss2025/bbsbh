#!/usr/bin/env node
// Screenshot a local dev route WITH LIVE MLB DATA from a Claude Code cloud
// session (claude.ai/code). Usage:
//
//   node .claude/skills/run/shot.mjs <url> <out.jpg> [width=390] [height=844] [full=0]
//   node .claude/skills/run/shot.mjs "http://localhost:5173/?nointro" /tmp/x.jpg 1440 1000 1
//
// Why this exists — three traps, each of which cost a session real time:
//
// 1. Chromium does not trust the cloud agent proxy's CA, so every statsapi
//    and mlbstatic request fails with ERR_CERT_AUTHORITY_INVALID and the slate
//    reads "Couldn't load games". Passing `proxy:` to launch() does not help.
//    Node's own `fetch` DOES go through the proxy with TLS verified, so every
//    https request is relayed through Node and handed back to the page (the
//    same relay e2e/fixtures/mock-api.js uses). Never turn off TLS checks.
// 2. Fulfil with MINIMAL headers (content-type + CORS). Copying the upstream
//    headers wholesale (content-encoding, length, vary …) makes the page's
//    fetches fail even though the relay answered 200.
// 3. Launch the preinstalled binary (/opt/pw-browsers/chromium). Never run
//    `playwright install`.
//
// The output is a JPEG on purpose: a full-page PNG is ~350 KB, past the Read
// tool's 250 KB guard, so the image could not be viewed.
import { chromium } from 'playwright'

const [, , url, out, w = '390', h = '844', full = '0'] = process.argv
if (!url || !out) {
  console.error('usage: shot.mjs <url> <out.jpg> [width] [height] [full=0|1]')
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
await page.route(/^https:\/\//, async (route) => {
  try {
    const res = await fetch(route.request().url())
    const body = Buffer.from(await res.arrayBuffer())
    await route.fulfill({
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
        'access-control-allow-origin': '*',
      },
      body,
    })
  } catch {
    await route.abort()
  }
})
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {})
await page.waitForTimeout(2500)
await page.screenshot({ path: out, fullPage: full === '1', type: 'jpeg', quality: 55 })
await browser.close()
console.log(out)
