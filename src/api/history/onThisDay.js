import { staticJsonBy } from '../staticJson.js'

// "On this day": the players born, and the players who debuted, on one calendar day
// in past years. Reads public/data/on-this-day/{MM-DD}.json, which
// scripts/gen-bio-history.mjs builds BY HAND from Retrosheet's biographical files
// (ADR-0100). The app never fetches Retrosheet or the Chadwick register.
//
// SPOILER FOOTING: spoiler-FREE. A birthday or a debut date from history says
// nothing about a game, so an open surface may show it with no SealBox (ADR-0034).
//
// ONE FILE PER DAY (366): a month's file was up to 415 KB, because debuts bunch in April
// and September; a day's is at most 21 KB.
// THE SHARD: { credit: [line, ...], born, debuted }, each entry { personId, name, year }. `year` is the birth year in `born` and the debut year in
// `debuted`. The caller passes the month and day of THE PAGE'S OWN date, never a
// clock of its own. The shard's `credit` lines must print beside the data, so a
// surface reads `fetchOnThisDayShard` when it draws them.
export const fetchOnThisDayShard = staticJsonBy((mmdd) => `/data/on-this-day/${mmdd}.json`, { fallback: null })

const two = (n) => String(n).padStart(2, '0')

// month 1-12, day 1-31 -> { born: [], debuted: [] }; both empty when the day has none.
export async function onThisDay(month, day) {
  const shard = await fetchOnThisDayShard(`${two(month)}-${two(day)}`)
  return { born: shard?.born ?? [], debuted: shard?.debuted ?? [] }
}
