// The next draft's Competitive Balance picks, the only tradable MLB draft
// picks (public/data/cb-picks.json, built nightly by
// scripts/trade/gen-cb-picks.mjs). Empty until MLB posts the order; a missing
// file means no picks on the card, never a failed page.
import { staticJson } from '../staticJson.js'

export const fetchCbPicks = staticJson('/data/cb-picks.json', { fallback: null })
