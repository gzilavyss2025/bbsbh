// Shoot each wireframe at true size: node frames.mjs <preview url> <outdir>
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const [url, out] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } })
const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
await p.goto(url + '#ladder'); await p.waitForTimeout(800)
for (const dir of ['hud', 'panels']) for (const st of ['waiting', 'revealed', 'menu']) {
  await p.evaluate(([dir, st]) => { document.querySelector(`#seg-dir [data-v="${dir}"]`).click(); document.querySelector(`#seg-state [data-v="${st}"]`).click() }, [dir, st])
  await p.waitForTimeout(250)
  for (const id of ['P', 'T', 'L', 'D']) {
    const el = await p.$(`.lad-col.${id} .wf`)
    await el.evaluate((e) => { e.style.transform = 'none'; e.parentElement.style.height = e.offsetHeight + 'px'; e.parentElement.style.width = e.offsetWidth + 'px' })
    await el.screenshot({ path: `${out}/${dir}-${st}-${id}.png` })
  }
}
console.log(errs.length ? errs.join('\n') : 'no errors')
await b.close()
