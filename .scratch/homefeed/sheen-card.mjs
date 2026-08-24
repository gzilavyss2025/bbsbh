import { chromium, devices } from '/Users/garyzilavy/bbsbh/node_modules/playwright-core/index.mjs'
const OUT='/private/tmp/claude-501/-Users-garyzilavy-bbsbh/275509d8-188c-4591-8826-7795468455e6/scratchpad'
const b=await chromium.launch()
for(const [port,tag] of [[5173,'before'],[5172,'after']]){
  const ctx=await b.newContext({...devices['iPhone 14 Pro']})
  const p=await ctx.newPage()
  await p.goto(`http://localhost:${port}/?nointro`,{waitUntil:'networkidle',timeout:60000})
  await p.waitForTimeout(2500)
  await p.evaluate(()=>window.scrollTo(0,520)); await p.waitForTimeout(800)
  const cards=await p.$$('.gamecard')
  // third card on screen at this offset — same index both sides
  await cards[2].screenshot({path:`${OUT}/card-${tag}.png`})
  await ctx.close()
}
await b.close(); console.log('card shots')
