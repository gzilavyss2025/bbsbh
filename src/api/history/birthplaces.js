import { staticJsonBy } from '../staticJson.js'

// The BIRTHPLACE INDEX: players grouped by birth city, from Retrosheet's biographical
// files. Reads public/data/birthplaces/{ab}.json, built BY HAND by
// scripts/gen-bio-history.mjs (ADR-0100). The app never fetches Retrosheet.
//
// SPOILER FOOTING: spoiler-FREE. Where a man was born says nothing about a game
// (ADR-0034); an open surface may show it with no SealBox.
//
// THE KEY: lower-case city + '|' + lower-case place. The place is the full state name
// for a US birth ('mobile|alabama') and the country for any other ('toronto|canada').
// A caller that holds a ballpark's venue.location passes `state` for a US park and
// `country` for any other. The match is EXACT: 'AL' does not find 'Alabama', and a
// neighbouring town finds nothing.
//
// THE SHARD: { credit: [line, ...], places: { [key]: [{ personId, name, year }] } }.
// `year` is the birth year, or null when the file has no birthdate.
export const birthplaceKey = (city, place) => `${String(city).trim().toLowerCase()}|${String(place).trim().toLowerCase()}`

// The shard file is the first two letters of the city, accents and spaces stripped
// ('st' holds St. Louis); a city with no letter shares `_`. One letter put 185 KB in
// the biggest shard; two put 93 KB (the 'sa' of San and Saint).
export const birthplaceShard = (key) => key.split('|')[0].normalize('NFD').replace(/[^a-z]/g, '').slice(0, 2) || '_'

export const fetchBirthplaceShard = staticJsonBy((ab) => `/data/birthplaces/${ab}.json`, { fallback: null })

export async function bornIn(city, stateOrCountry) {
  if (!city || !stateOrCountry) return []
  const key = birthplaceKey(city, stateOrCountry)
  const shard = await fetchBirthplaceShard(birthplaceShard(key))
  return shard?.places?.[key] ?? []
}
