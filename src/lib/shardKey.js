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
