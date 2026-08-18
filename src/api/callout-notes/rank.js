// League ranks for the W-L record callout families — both halves in one file,
// on purpose.
//
// The MATH (`rankRecords`) is called by scripts/gen-callouts.mjs, which ranks
// every club at a level against the tallies it just built. The PROSE
// (`rankClause` / `withRank`) is called by the note builders here, which read
// the rank back off the bundle. Keeping them together is the same rule the
// checkpoint innings follow (checkpoints.js's header): a rank computed by one
// definition and printed by another would report a club's standing against a
// field the sentence never names.
//
// WHY THE GENERATOR RANKS, and not the app. A rank must come from the SAME
// tally that produced the record it ranks. public/data/team-records/* holds a
// league-wide ledger of the same splits, but it counts the walk-off inning
// gen-callouts.mjs deliberately skips and reads a later cutoff — measured up
// to seven games apart on one club's "leading after the 8th". Joining it would
// rank a number the note never printed. A client join would also cost 30 shard
// fetches on the in-game path (see situationalRecordRankings.js's own header).
//
// SPOILER-FREE. A rank is a season aggregate over Final games, exactly like
// the record it decorates, so it rides inside whichever `revealedThrough`
// gate its family already carries and changes no tense (ADR-0014).

import { ordinal } from './shared.js'

// How wide the field must be before a rank is worth printing at all. A "2nd of
// 5" is arithmetic, not a standing.
export const RANK_MIN_FIELD = 8
// How close to either end of the field a club must sit. The middle of the
// table is noise — the same call the lopsidedness floors in these families
// already make (LEAD_LOPSIDED, DOW_LOPSIDED, SCORELESS_LOPSIDED).
export const RANK_NOTABLE = 3

// The level a rank is measured inside, in broadcast words. Deliberately NOT
// src/lib/teams.js's SPORT_LABEL: that table is the level SWITCHER's vocabulary
// ('AAA', 'A+'), which is a control label, not something a sentence says out
// loud. A level this table does not know suppresses the clause rather than
// guessing at a name.
const LEVEL_PHRASE = {
  1: 'in the majors',
  11: 'in Triple-A',
  12: 'in Double-A',
  13: 'in High-A',
  14: 'in Single-A',
}

// One club's rank for one metric, off the bundle. `key` is the record family
// ('leadAfter', 'runsScored', 'oneRun', …); `sub` is the checkpoint inning,
// run bucket or weekday for the families that carry one. Absent on every
// bundle written before ranks shipped, and on any club that missed the
// family's sample floor — both degrade to null, which prints today's wording.
export function rankOf(bundle, side, key, sub) {
  const family = bundle?.teamRecords?.[side]?.ranks?.[key]
  if (!family) return null
  return (sub == null ? family : family[sub]) ?? null
}

// "2nd of 30 in the majors" / "the best mark in the majors" — the clause that
// follows the record, never the number that replaces it. Rank display rule:
// ordinal words only, no '#', and the field size always printed so a thin
// field reads honestly. Returns null (no clause) for a mid-table rank, a
// short field, or an unknown level.
export function rankClause(rank, sportId) {
  const where = LEVEL_PHRASE[sportId]
  if (!where || !rank) return null
  const { r, of } = rank
  if (!Number.isFinite(r) || !Number.isFinite(of) || of < RANK_MIN_FIELD) return null
  const tied = rank.t ? 'tied for ' : ''
  if (r === 1) return `${tied}the best mark ${where}`
  if (r === of) return `${tied}the worst mark ${where}`
  if (r <= RANK_NOTABLE || r > of - RANK_NOTABLE) return `${tied}${ordinal(r)} of ${of} ${where}`
  return null
}

// Would this rank ever print? The generator drops the ones that would not, so
// a bundle carries only the handful of standings a note can actually say —
// roughly a fifth of the ranks the pass computes. The cutoff lives HERE, next
// to the clause it mirrors, so the two cannot drift; a bundle regenerated
// after a wider cutoff simply carries more.
export const rankWorthPrinting = (rank) =>
  !!rank && Number.isFinite(rank.r) && Number.isFinite(rank.of) &&
  rank.of >= RANK_MIN_FIELD && (rank.r <= RANK_NOTABLE || rank.r > rank.of - RANK_NOTABLE)

// The one call the note builders make: today's sentence, plus the rank clause
// when there is one. An ADDITION — the record itself never moves or leaves.
// NEVER call this on a folded, result-aware sentence ("moved to 59-2"): that
// number is tonight's, and the rank was computed against last night's.
export function withRank(text, bundle, side, key, sub) {
  const clause = rankClause(rankOf(bundle, side, key, sub), bundle?.sportId)
  return clause ? `${text} — ${clause}` : text
}

// --- the generator's half -----------------------------------------------------

// Standard competition ranking on win%, best first: tied clubs share a rank
// and carry `t`, and the next rank skips the tie's width. `of` is how many
// clubs cleared `minGames` — the family's OWN sample floor, applied to every
// club alike, so the field is never the set of clubs whose record happened to
// be lopsided enough to print.
//
// `rows` is [{ teamId, w, l }] for one metric across one level. Returns a Map
// of teamId -> { r, of, t? }; a club under the floor is simply absent.
export function rankRecords(rows, minGames = 1) {
  const pct = (x) => x.w / (x.w + x.l)
  const eligible = (rows ?? [])
    .filter((x) => Number.isFinite(x.w) && Number.isFinite(x.l) && x.w + x.l > 0 && x.w + x.l >= minGames)
    .sort((a, b) => pct(b) - pct(a))
  const of = eligible.length
  const out = new Map()
  const atRank = new Map()
  let rank = 0
  eligible.forEach((row, i) => {
    if (i === 0 || pct(row) !== pct(eligible[i - 1])) rank = i + 1
    out.set(row.teamId, { r: rank, of })
    atRank.set(rank, (atRank.get(rank) ?? 0) + 1)
  })
  for (const entry of out.values()) if (atRank.get(entry.r) > 1) entry.t = 1
  return out
}

// Families keyed by a checkpoint inning / run bucket / weekday, and the flat
// ones. Both read off the generator's raw `_tallies`.
//
// NOT here: the standings splits (one-run, extra-inning). Ranking them is free
// — fetchSplitRecords already reads all 30 clubs — but `buildCloseGameNotes`
// is Final-only and ALWAYS folds tonight's result into its sentence, so a rank
// could never be printed. Shipping one would be dead bytes in every bundle.
const NESTED_RANK_KEYS = [
  'leadAfter', 'tiedAfter', 'scorelessThrough', 'bothScoreless',
  'runsScored', 'runsAllowedByInning', 'dayOfWeek',
]
const FLAT_RANK_KEYS = ['scoringFirst', 'opponentScoringFirst', 'comeback']

// The generator's whole rank pass, in one call: every family, every level.
//
//   idsBySport  Map(sportId -> [teamId]) — one entry per level on the slate,
//               each holding EVERY club at that level, which is the field a
//               rank is measured against.
//   talliesFor  (teamId) -> the club's raw {family: …} tallies, or null.
//   floors      { [family]: minGames } — each family's own sample floor.
//
// Returns Map(teamId -> { [family]: {r,of,t?} | { [sub]: {r,of,t?} } }).
export function rankAllLevels(idsBySport, talliesFor, floors) {
  const ranks = new Map()
  const put = (teamId, key, sub, value) => {
    if (!rankWorthPrinting(value)) return
    const club = ranks.get(teamId) ?? ranks.set(teamId, {}).get(teamId)
    if (sub == null) club[key] = value
    else (club[key] ??= {})[sub] = value
  }
  for (const ids of idsBySport.values()) {
    for (const key of NESTED_RANK_KEYS) {
      const subs = new Set()
      for (const id of ids) for (const sub of Object.keys(talliesFor(id)?.[key] ?? {})) subs.add(sub)
      for (const sub of subs) {
        const rows = ids.map((id) => ({ teamId: id, ...(talliesFor(id)?.[key]?.[sub] ?? { w: 0, l: 0 }) }))
        for (const [id, v] of rankRecords(rows, floors?.[key])) put(id, key, sub, v)
      }
    }
    for (const key of FLAT_RANK_KEYS) {
      const rows = ids.map((id) => ({ teamId: id, ...(talliesFor(id)?.[key] ?? { w: 0, l: 0 }) }))
      for (const [id, v] of rankRecords(rows, floors?.[key])) put(id, key, null, v)
    }
  }
  return ranks
}
