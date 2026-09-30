// Usage: node measure.mjs <label>   -> appends a JSON line to runs.jsonl
// Counts WinProbChart commits and their actual render time (React dev build).
// Uses a stand-in DevTools hook so nothing is added to src/.
import { appendFileSync } from 'node:fs'
import { launch, GAME_URL } from './lib.mjs'

const label = process.argv[2] ?? 'run'
const SWEEPS = 5, STEPS = 200, THROTTLE = 4
const { browser, ctx, page } = await launch({ width: 390, height: 844 })
await page.addInitScript(() => {
  window.__wp = { on: false, durs: [] }
  const find = (f) => {
    for (let n = f; n; n = n.sibling) {
      if (n.type && n.type.name === 'WinProbChart') return n
      const r = n.child && find(n.child)
      if (r) return r
    }
    return null
  }
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), isDisabled: false,
    inject() { return 1 }, checkDCE() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      if (!window.__wp.on) return
      const f = find(root.current)
      if (f && (f.flags & 1)) window.__wp.durs.push(f.actualDuration)
    },
  }
})
await page.goto(GAME_URL, { waitUntil: 'networkidle' })
await page.getByText('TAP TO REVEAL', { exact: false }).first().click()
const svg = page.locator('.winprob__svg')
await svg.waitFor({ timeout: 30000 })
await svg.scrollIntoViewIfNeeded()
await page.waitForTimeout(1500)
const box = await svg.boundingBox()
const cdp = await ctx.newCDPSession(page)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })

const sweep = async () => {
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + 2, y)
  await page.evaluate(() => { window.__wp.durs = []; window.__wp.on = true })
  for (let i = 0; i <= STEPS; i++) await page.mouse.move(box.x + 2 + ((box.width - 4) * i) / STEPS, y)
  await page.waitForTimeout(300)
  const durs = await page.evaluate(() => { window.__wp.on = false; return window.__wp.durs })
  await page.mouse.move(5, 5)
  const s = [...durs].sort((a, b) => a - b)
  return { commits: durs.length, total: +durs.reduce((a, b) => a + b, 0).toFixed(2), median: +(s[Math.floor(s.length / 2)] ?? 0).toFixed(3) }
}
for (let i = 0; i < 3; i++) await sweep() // warm-ups (JIT), not counted
const out = []
for (let i = 0; i < SWEEPS; i++) out.push(await sweep())
console.log(label, JSON.stringify(out))
appendFileSync(new URL('./runs.jsonl', import.meta.url), JSON.stringify({ label, viewport: '390x844', throttle: THROTTLE, sweeps: out }) + '\n')
await browser.close()
