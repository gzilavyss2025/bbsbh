// The pure half of scripts/gen-bio-history.mjs (ADR-0100):
// Retrosheet's biofile0.csv, joined to MLBAM ids, as two sets of shards. It lives
// here because a generator file runs on import (scripts/CLAUDE.md).
//
// Only a PLAYER counts: a row with a `debut_p`. Managers, coaches and umpires who
// never played are left out, and not counted as dropped. A player with no MLBAM id
// is dropped and counted: he has no id to link to. No deaths, by design.
//
// A missing birthdate keeps the man's debut and his birthplace, and leaves out his
// birthday. A missing city, or a US birth with no state, leaves out his birthplace.
// Both are counted. Dates are YYYYMMDD in the file; a date with month or day 00 is no date.
//
// One on-this-day shard per calendar day, named 'MM-DD' (a month's shard was 415 KB).
//
// No clock: same input, same bytes. Input order does not matter.
import { birthplaceKey, birthplaceShard } from '../../../src/api/history/birthplaces.js'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from './credits.mjs'

// 'YYYYMMDD' -> [, 'YYYY', 'MM', 'DD'], or null when the date is missing or has no month or day.
const dateOf = (s) => {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  // Year 2000 is a leap year, so 02-29 stands and 02-30 does not.
  return m && new Date(Date.UTC(2000, +m[2] - 1, +m[3])).getUTCDate() === +m[3] && +m[2] <= 12 && +m[2] >= 1 ? m : null
}
const credit = () => [RETROSHEET_CREDIT, CHADWICK_JOIN]
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const byYear = (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity) || byText(a.name, b.name) || a.personId - b.personId
const shardOf = (map, key) => map.get(key) ?? map.set(key, { credit: credit() }).get(key)
const sortedShards = (map) => [...map].sort(([a], [b]) => byText(a, b))

// bio: biofile0.csv rows. retroToMlbam: Map from retro-bridge.mjs.
// -> { onThisDay: [['MM-DD', shard]], birthplaces: [[letter, shard]], report }
export function buildBioShards({ bio, retroToMlbam }) {
  const report = { people: bio.length, players: 0, noMlbam: 0, noDebutDate: 0, noBirthdate: 0, noPlace: 0, born: 0, debuted: 0, places: 0 }
  const days = new Map()
  const letters = new Map()
  const dayOf = (mm, dd) => {
    const shard = shardOf(days, `${mm}-${dd}`)
    shard.born ??= []
    shard.debuted ??= []
    return shard
  }

  for (const b of bio) {
    if (!b.debut_p) continue
    report.players += 1
    const mlbam = retroToMlbam.get(b.id)
    if (!mlbam) {
      report.noMlbam += 1
      continue
    }
    const personId = Number(mlbam)
    const name = `${b.usename} ${b.lastname}`.trim()
    const debut = dateOf(b.debut_p)
    if (debut) {
      dayOf(debut[2], debut[3]).debuted.push({ personId, name, year: Number(debut[1]) })
      report.debuted += 1
    } else report.noDebutDate += 1

    const born = dateOf(b.birthdate)
    if (born) {
      dayOf(born[2], born[3]).born.push({ personId, name, year: Number(born[1]) })
      report.born += 1
    } else report.noBirthdate += 1

    const place = b.birthcountry === 'USA' ? b.birthstate : b.birthcountry
    if (!b.birthcity || !place) {
      report.noPlace += 1
      continue
    }
    const key = birthplaceKey(b.birthcity, place)
    const places = (shardOf(letters, birthplaceShard(key)).places ??= {})
    ;(places[key] ??= []).push({ personId, name, year: born ? Number(born[1]) : null })
    report.places += 1
  }

  for (const d of days.values()) for (const l of [d.born, d.debuted]) l.sort(byYear)
  for (const shard of letters.values()) {
    for (const l of Object.values(shard.places)) l.sort(byYear)
    // Sort keys so the bytes do not depend on input order.
    shard.places = Object.fromEntries(Object.entries(shard.places).sort(([a], [b]) => byText(a, b)))
  }
  return { onThisDay: sortedShards(days), birthplaces: sortedShards(letters), report }
}
