import { chromium, devices } from '/Users/garyzilavy/bbsbh/node_modules/playwright-core/index.mjs'
const OUT='/private/tmp/claude-501/-Users-garyzilavy-bbsbh/275509d8-188c-4591-8826-7795468455e6/scratchpad'
const b=await chromium.launch()
const ctx=await b.newContext({...devices['iPhone 14 Pro']})
const p=await ctx.newPage()
for(const [route,tag] of [['/08222026/athhou/lineup1','lineup'],['/08222026/athhou/top1','inning'],['/08222026/athhou/boxscore','boxscore']]){
  await p.goto(`http://localhost:5172${route}?nointro`,{waitUntil:'networkidle',timeout:60000})
  await p.waitForTimeout(3000)
  await p.screenshot({path:`${OUT}/app-${tag}.png`})
  await p.screenshot({path:`${OUT}/app-${tag}-full.png`,fullPage:true})
}
await b.close(); console.log('ok')
