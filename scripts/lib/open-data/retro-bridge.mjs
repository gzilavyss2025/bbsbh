// Retrosheet id <-> MLBAM id, from Chadwick register rows (ADR-0100). PURE: the
// caller parses the register's people-*.csv files and passes the rows in.
//
// A row bridges only when it carries BOTH `key_retro` and `key_mlbam`. A register
// row for a man who never played pro ball has neither, and a prospect who never
// reached the majors has an MLBAM id and no Retrosheet id (spike, 2026-10-06).
// Ids are strings throughout, as the CSV gives them.
//
// If the register repeats an id, the FIRST row wins and the repeat counts in
// `conflicts`, so a bad pairing shows in the report instead of overwriting a good one.
//
// -> { retroToMlbam: Map, mlbamToRetro: Map, rows, matched, noMatch, conflicts }
export function buildRetroBridge(rows) {
  const retroToMlbam = new Map()
  const mlbamToRetro = new Map()
  let noMatch = 0
  let conflicts = 0
  for (const { key_retro: retro, key_mlbam: mlbam } of rows) {
    if (!retro || !mlbam) {
      noMatch += 1
    } else if (retroToMlbam.has(retro) || mlbamToRetro.has(mlbam)) {
      conflicts += 1
    } else {
      retroToMlbam.set(retro, mlbam)
      mlbamToRetro.set(mlbam, retro)
    }
  }
  return { retroToMlbam, mlbamToRetro, rows: rows.length, matched: retroToMlbam.size, noMatch, conflicts }
}
