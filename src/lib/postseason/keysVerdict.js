// The one-sentence verdict under the series page's Nine Keys comparison.
//
// Pure, and built from the file's own numbers (`limit`, `firstSeason`) so a
// regenerate cannot leave a sentence that quotes yesterday's rule. Each case is
// pinned in test/postseason/keys-verdict.test.js.
//
//   a, b: { abbr: 'SD', failed: 2 } — a club and how many keys it failed
//   rule: { limit: 3, firstSeason: 2000 }
//
// The rule: no World Series champion since `firstSeason` failed more than
// `limit` keys (api/nineKeys.js). Copy is plain English (house word list).

const keys = (n) => `${n} ${n === 1 ? 'key' : 'keys'}`

export function keysVerdict(a, b, { limit, firstSeason }) {
  const since = `No champion since ${firstSeason}`
  const ruleSentence = `${since} failed more than ${limit}.`
  const over = (c) => c.failed > limit
  if (over(a) && over(b)) return `Both clubs fail more than ${limit} keys. ${since} did that.`
  if (over(a) || over(b)) {
    const high = over(a) ? a : b
    return `${high.abbr} fails ${keys(high.failed)}. ${ruleSentence}`
  }
  if (a.failed === b.failed) {
    return a.failed === 0
      ? `Neither club fails a key. ${ruleSentence}`
      : `Both clubs fail ${keys(a.failed)}. ${ruleSentence}`
  }
  const [few, many] = a.failed < b.failed ? [a, b] : [b, a]
  const first = few.failed === 0 ? `${few.abbr} fails no keys.` : `${few.abbr} fails ${keys(few.failed)}.`
  return `${first} ${many.abbr} fails ${keys(many.failed)}. ${ruleSentence}`
}

// The two clubs' rows from the Nine Keys file, in the order asked, or null when the card has
// nothing to draw: no file, another season's file, no keys, or a club with no row. The series
// page's card and the World Series scouting jump bar both ask it, so they agree on "no data".
//   data    loadNineKeys()'s shape; clubs  [{ id }, { id }]; season  the series' year
export function nineKeysTeams(data, clubs, season) {
  const [a, b] = clubs.map((c) => data?.current?.teams?.find((t) => t.teamId === c.id))
  return a && b && data.current.season === season && data.keys?.length ? [a, b] : null
}

// Did a club fail this key? A rank worse than `bar` fails, and so does a missing rank.
// scripts/gen-nine-keys.mjs writes each club's `failed` list by this rule. The views read
// that list, not this, so a row's mark and the "Failed keys" tally can never disagree.
export const isFailedKey = (rank, bar) => rank == null || rank > bar
