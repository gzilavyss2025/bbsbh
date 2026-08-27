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
// reader recomputes from the rowKey alone (ADR-0067). 500 rows a bucket keeps
// salaries.csv's 27k rows at ~55 files rather than one 1.5 MB download, and a
// reader typically needs none of them — only an admin's override sends it
// looking. The size lives here, next to shardKey100, for the reason the header
// above gives: two copies that drift are a row whose money can never be found.
export const TERMS_BUCKET_SIZE = 500

// `${sourceFile}#${csvRowIndex}` -> the bucket file's basename.
export function termsBucketKey(rowKey) {
  const [sourceFile, seq] = String(rowKey).split('#')
  return `${sourceFile}-${Math.floor(Number(seq) / TERMS_BUCKET_SIZE)}`
}
