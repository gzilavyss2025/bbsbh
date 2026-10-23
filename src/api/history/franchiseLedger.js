import { staticJsonBy } from '../staticJson.js'

// A club's season ledger: one row per season from the club's first in franchise-history to the
// last finished one, from public/data/franchise-ledger/{teamId}.json (hand-run
// scripts/gen-franchise-ledger.mjs, #2595). Keyed by the CURRENT team id, which a club keeps
// across a move (158 is the Pilots and the Brewers). A row is
//   { season, name, league, w, l, gb, divisionRank, leagueRank, rs, ra,
//     managers: [{ id, name, w?, l? }], postseason: { round, won } | null, note: string | null }
// `divisionRank` is null before 1969. `managers` is empty before 1969 (manager-history starts
// there). A shared season's managers carry no w/l. MLB clubs only: a MiLB id has no file and reads
// empty. The current, unfinished season is not here; the page reads it live.

const load = staticJsonBy((id) => `/data/franchise-ledger/${id}.json`, {
  fallback: { through: null, rows: [] },
})

// -> { through, rows }, oldest first. `through` is the last season in the file.
export async function franchiseLedger(teamId) {
  const d = await load(teamId)
  return { through: d.through ?? null, rows: d.rows ?? [] }
}
