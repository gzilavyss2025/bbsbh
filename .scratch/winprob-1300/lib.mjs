import { chromium } from 'playwright'

// Chromium does not trust this sandbox's egress CA; Node does. So Node fetches
// every external request and hands the body to the page (no TLS checks off).
export async function launch({ width = 390, height = 844 } = {}) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.route(/^https:\/\/(?!localhost)/, async (route) => {
    const req = route.request()
    const url = req.url()
    if (/vercel-scripts|vercel\.com|clerk/.test(url)) return route.abort()
    try {
      const r = await fetch(url, { method: req.method(), headers: { accept: req.headers().accept ?? '*/*' } })
      const body = Buffer.from(await r.arrayBuffer())
      const headers = { 'access-control-allow-origin': '*', 'content-type': r.headers.get('content-type') ?? 'application/octet-stream' }
      await route.fulfill({ status: r.status, headers, body })
    } catch { await route.abort() }
  })
  return { browser, ctx, page: await ctx.newPage() }
}

export const GAME_URL = 'http://localhost:5173/05272025/bosmil/boxscore?nointro'
