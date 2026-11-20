// Regenerates public/data/cb-picks.json: the next draft's Competitive
// Balance picks (Rounds A and B), the only MLB draft picks a club may trade.
// The trade card offers them on each club's roster card.
//
// statsapi's /draft/{year} lists the order with rounds labelled 'CB-A' and
// 'CB-B' (checked 2026-11-19 against 2026: 7 and 8 picks). It stays empty
// until MLB loads the order, some time after the December lottery, so the
// file holds no picks until then and the card shows none.
//
// The feed does not say which picks are untradable (a first-rounder dropped
// into Round A as a tax penalty, or compensation for an unsigned pick); the
// card says so in its note. Research: docs/trade-draft-picks-research.html.
// Nightly, in the structural data block of update-nightly-data.yml (1 request).
// Run by hand: node scripts/trade/gen-cb-picks.mjs [year]
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { writeJsonAtomic } from '../lib/io.js'
import { getJson } from '../lib/statsapi.mjs'
import { cbPicksOf } from '../../src/lib/trade/deal.js'

const out = join(import.meta.dirname, '..', '..', 'public', 'data', 'cb-picks.json')
// The draft is in July: from August on, the next one is next year's.
const now = new Date()
const year = Number(process.argv[2]) || now.getUTCFullYear() + (now.getUTCMonth() >= 7 ? 1 : 0)

const picks = cbPicksOf(await getJson(`/api/v1/draft/${year}`), year)

// Only rewrite when the picks change, so the nightly run doesn't churn the file.
const prev = JSON.parse(await readFile(out, 'utf8').catch(() => '{}'))
if (prev.year === year && JSON.stringify(prev.picks) === JSON.stringify(picks)) {
  console.log(`cb-picks: ${year} unchanged (${picks.length} picks)`)
} else {
  await writeJsonAtomic(out, { generatedAt: now.toISOString(), year, picks })
  console.log(`cb-picks: ${picks.length} picks for ${year}`)
}
