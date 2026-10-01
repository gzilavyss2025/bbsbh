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
