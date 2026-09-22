// Injects a .door.door--block.txcard__door into the LIVE deck and measures it
// against its tallest sibling. The React condition that renders it for real
// (canRevealMore) is false whenever a club's moves already all fit, so this
// exercises the cascade rather than waiting for the right day's data.
import { chromium } from 'playwright'

const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage()
try {
  await p.goto(`http://localhost:${process.env.PORT || 5173}/team/158?nointro`, {
    waitUntil: 'networkidle', timeout: 45000,
  })
} catch { /* the slate keeps polling; networkidle can time out */ }
await p.waitForTimeout(2500)

const r = await p.evaluate(() => {
  const deck = document.querySelector('.txcard__scroll')
  if (!deck) return { err: 'no deck on this page' }
  const tallest = Math.max(...[...deck.children].map((e) => e.getBoundingClientRect().height))

  const door = document.createElement('button')
  door.type = 'button'
  door.className = 'door door--block txcard__door'
  door.textContent = 'Load more transactions'
  deck.appendChild(door)

  const withFix = door.getBoundingClientRect().height
  door.style.alignSelf = 'auto'  // what the rule looked like before the fix
  const withoutFix = door.getBoundingClientRect().height
  door.style.alignSelf = ''
  const cs = getComputedStyle(door)
  const h = door.getBoundingClientRect().height
  door.remove()
  return {
    alignSelf: cs.alignSelf,
    doorHeight: Math.round(h),
    tallestSibling: Math.round(tallest),
    fullHeight: Math.round(h) >= Math.round(tallest) - 1,
    withFix: Math.round(withFix),
    withoutFix: Math.round(withoutFix),
  }
})
console.log(JSON.stringify(r, null, 2))
await b.close()
