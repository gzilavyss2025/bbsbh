// "Colleyville, TX" / "Montreal, QC, Canada" / "Oshu, Japan" from a statsapi
// person record. One rule for the player page and the crawler body (#1777).
// Pure, no imports: api/_lib/cards.js calls it and hands the string to crawl.js.
// A birthplace is open-surface biography, not a score (ADR-0034).
const text = (v) => String(v ?? '').trim()

export function birthplace(person) {
  const city = text(person?.birthCity)
  if (!city) return ''
  // The feed sends "-1" for an unknown state: keep it only if it has a letter.
  const state = text(person.birthStateProvince)
  const country = text(person.birthCountry)
  return [city, /\p{L}/u.test(state) && state, country !== 'USA' && country].filter(Boolean).join(', ')
}
