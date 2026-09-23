// Which pages render which pill selectors — so the contact sheet knows where
// to look. Counts only; no screenshots.
//   node discover.mjs [baseURL] [sel,sel,...]
import { chromium } from '@playwright/test'

const base = process.argv[2] || 'http://localhost:5170'
const SELS = (process.argv[3] ||
  '.tierpill,.pbp__placed,.umpmodal__glevel,.cthist__fuzzy,.leaguerank__chip,.rankchip,.prospectpill,.milestonepill,.rookiepill,.simlike__term,.awards__chip,.dlab__verdict'
).split(',')
const URLS = (process.env.URLS || [
  '/team/158', '/team/158/roster', '/team/158/minors', '/team/158/leaders', '/team/158/contracts',
  '/standings', '/prospects', '/milestones', '/trade-deadline/2026', '/higha/10122025',
  '/player/freddy-peralta-642547', '/player/christian-yelich-592885', '/player/jackson-chourio-694192',
  '/player/jacob-misiorowski-694819', '/player/christian-yelich-592885/history',
  '/09222026/tbnyy/lineup1', '/09222026/tbnyy/lineup2', '/05272025/bosmil/top10', '/design-lab',
].join(' ')).split(' ')

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 900 } })
for (const u of URLS) {
  const sep = u.includes('?') ? '&' : '?'
  await p.goto(`${base}${u}${sep}nointro`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {})
  await p.waitForTimeout(1200)
  const counts = {}
  for (const s of SELS) {
    const n = await p.locator(s).count()
    if (n) counts[s] = n
  }
  console.log(u.padEnd(44), JSON.stringify(counts))
}
await b.close()
