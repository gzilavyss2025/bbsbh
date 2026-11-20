// Each level's OPS and ERA percentile cut points for the season in play
// (public/data/level-lines.json, built nightly by
// scripts/trade/gen-level-lines.mjs). The trade card's "By level" sort reads
// it. A missing file leaves that sort with no percentiles, never a failed page.
import { staticJson } from '../staticJson.js'

export const fetchLevelLines = staticJson('/data/level-lines.json', { fallback: null })
