// Which bucket a personId's record lives in, for the datasets sharded on
// `personId % 100` — rookie records, career WAR, coaching history.
//
// One definition, imported by every reader AND by the generators that write the
// buckets (through those readers), because the arithmetic is a JOIN: the
// generator files a player under a name the reader recomputes from his id alone.
// Two copies that drift by one player is a record that exists and can never be
// found, and nothing fails loudly when it happens.
//
// A hundred buckets is the middle of the two bad ends. One file per player means
// thousands of ~200-byte files to ship and cache; one file for the league means
// a player page downloads every player. At ~15-25 people a bucket these land in
// the low single-digit KB.
export function shardKey100(personId) {
  return String(Math.abs(Number(personId) || 0) % 100).padStart(2, '0')
}

// The historical-contract TERMS buckets are the same kind of join, on a
// different axis: the generator files a row's dollar terms under a name the
// reader recomputes from the rowKey alone (ADR-0067). The size lives here, next
// to shardKey100, for the reason the header above gives — two copies that drift
// are a row whose money can never be found.
//
// A rowKey used to carry the row's position in its source file, so the bucket
// was arithmetic on that position and grew with the file for free. A content
// key carries no position (ADR-0069), so the bucket is a slice of the key's own
// hash instead, and the DIVISOR has to be stated rather than derived. These
// counts are picked to hold each source at roughly 500 rows a bucket, which is
// where the positional scheme sat: one 1.5 MB download for salaries.csv is the
// bad end on one side, a directory of per-row files the bad end on the other.
// A reader typically fetches none of these — only an admin's override sends it
// looking.
//
// Measured against the real files, these divisors put salaries.csv's 27,349
// rows in 56 buckets of 433 to 544 rows, and reproduce the file count the
// positional scheme produced for all four sources.
// test/contract-row-key.test.js asserts the realised sizes stay in band, so a
// source file that grows past this shape fails a test rather than shipping one
// enormous bucket in silence.
export const TERMS_BUCKET_COUNT = {
  salaries: 56,
  free_agency: 12,
  arbitration: 5,
  extensions: 2,
}

// Matches only a CONTENT rowKey — `${sourceFile}#${16 hex}`. A legacy
// positional key has no bucket to name: the buckets are rebuilt under content
// keys, so no file holds it. Returning null says exactly that, and the caller
// skips the row. Computing a plausible-looking bucket from `parseInt('24340')`
// instead would send the reader to a real file that cannot contain the key,
// which is the same silent miss with more steps.
const CONTENT_ROW_KEY_RE = /^([a-z_]+)#([0-9a-f]{16})$/

// `${sourceFile}#${contentHash}` -> the bucket file's basename, or null.
export function termsBucketKey(rowKey) {
  const match = CONTENT_ROW_KEY_RE.exec(String(rowKey))
  if (!match) return null
  const [, sourceFile, hash] = match
  const count = TERMS_BUCKET_COUNT[sourceFile]
  if (!count) return null
  // The first 32 bits of the digest. `parseInt` of eight hex characters stays
  // inside a safe integer, so this needs no BigInt in a browser bundle.
  return `${sourceFile}-${parseInt(hash.slice(0, 8), 16) % count}`
}
