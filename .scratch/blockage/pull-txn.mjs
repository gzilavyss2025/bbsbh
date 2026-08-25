// Pull historical MLB transactions, one full-league dump per season, so a
// prospect's callup AND his incumbent's IL/DFA/trade can both be read off the
// same wire. Same shape/cache pattern as pull-mlb.mjs.
//
// typeCode vocabulary confirmed live against the 2015 dump before writing
// this (do not extend the CARE_ABOUT set below from guesswork):
//   SE  Selected            CU  Recalled            CP  Contract Purchased
//   OPT Optioned            OUT Outrighted          TR  Trade
//   DES Designated for Assignment (the "DFA" of common usage)
//   DFA Declared Free Agency (NOT the same thing - a name trap)
//   REL Released            RET Retired             CLW Claimed Off Waivers
//   SC  Status Change (IL placements/activations live here as free text,
//       e.g. "... placed RHP X on the 60-day disabled list")
//   ASG/SFA/SGN/NUM/LON/TRN/DEC/RTN/CP - mostly winter ball/minors noise
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const SEASONS = []
for (let y = 2008; y <= 2024; y += 1) SEASONS.push(y)

const CACHE = 'txn-season-cache.json'
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {}

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return await r.json()
    } catch (e) {
      if (i === tries - 1) throw e
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)))
    }
  }
}

// Keep only what the join needs. person/toTeam/fromTeam ids, the type, both
// dates (effectiveDate is often the one that actually matches a roster
// event), and the free-text description - IL language only lives there.
const CARE_ABOUT = new Set([
  'SE', 'CU', 'CP', 'OPT', 'OUT', 'TR', 'DES', 'DFA', 'REL', 'RET', 'CLW', 'SC',
])

for (const season of SEASONS) {
  const key = String(season)
  if (cache[key]) continue
  console.log(`fetching ${season}...`)
  const data = await get(`https://statsapi.mlb.com/api/v1/transactions?startDate=${season}-01-01&endDate=${season}-12-31`)
  const txns = data.transactions || []
  const slim = txns
    .filter((t) => CARE_ABOUT.has(t.typeCode))
    .map((t) => ({
      id: t.id,
      p: t.person ? t.person.id : null,
      from: t.fromTeam ? t.fromTeam.id : null,
      to: t.toTeam ? t.toTeam.id : null,
      code: t.typeCode,
      date: t.date,
      eff: t.effectiveDate || t.date,
      desc: t.description || '',
    }))
  cache[key] = slim
  console.log(`  ${season}: ${txns.length} total, ${slim.length} kept`)
  writeFileSync(CACHE, JSON.stringify(cache))
  await new Promise((r) => setTimeout(r, 250))
}
console.log('done')
