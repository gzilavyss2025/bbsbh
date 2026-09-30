import { staticJson } from '../staticJson.js'

// A player's PROSPECT RANKING HISTORY -- the years he sat on a top-prospect
// list, and where (issue #1111). Reads public/data/prospect-rank-history.json,
// which scripts/gen-prospect-rank-history.mjs builds by hand from the research
// pull in .scratch/top-prospects-history/. Spoiler-free: a ranking is a scout's
// opinion of a man, not a fact about a game, so the player page shows it open
// (ADR-0034). No SealBox, no reveal-only import.
//
// THE FILE, in one glance:
//   sources: { [id]: { label, seasons: [first, last], credit: [line, ...] } }
//   depths:  { [season]: how many players that season's list ranked }
//   players: { [mlbId]: [[season, rank, sourceId], ...] }
//
// NOTHING HERE NAMES A SOURCE OR A YEAR. The 2005-2008 rows come from a source
// Gary may one day drop with one generator change, and this module has to keep
// working on the smaller file. Labels, credits and the years covered are all
// read from the file itself, so no page code changes when a source goes.
//
// THE HISTORY HAS EDGES, and the card must not hide them:
//   - It ends at the last pulled season. A season after that has NO DATA. It is
//     not a season he dropped off the list, and the note says so.
//   - A season the file covers where a player has no row means "not on that
//     year's list", and the lists differ in depth (`depths`): a row reads
//     "18 of 50" so the 2009-2011 top-50 lists are not mistaken for top-100s.
//   - Today's rank is not in this file. It comes from top-prospects.json, which
//     the player page already reads, and arrives as `currentRank`.

const fileRead = staticJson('/data/prospect-rank-history.json', {
  // Anything that is not a file of this shape reads as "no history".
  shape: (d) => (d && typeof d === 'object' && d.players && typeof d.players === 'object' ? d : null),
  fallback: null,
})

// The whole file, once per session. Null when it is missing or malformed.
export function fetchProspectRankHistory() {
  return fileRead()
}

// What the "Prospect rankings" card draws for one player, or null when there is
// nothing to draw. Pure.
//
//   history        the parsed file (fetchProspectRankHistory), or null.
//   playerId       the player's MLBAM id, number or string.
//   debutYear      the year of his MLB debut, or null/undefined before it.
//   currentRank    his rank on today's list (top-prospects.json), or null.
//   currentSeason  this season, so the note can name a gap in the history.
//
// Returns { entries, credits, note }:
//   entries  in season order. { kind: 'rank', season, rank, of, source,
//            sourceLabel }, then { kind: 'debut', season } placed where the
//            debut happened (after that season's rank, before the next), and
//            { kind: 'today', rank } last.
//   credits  the credit lines for the sources actually shown, each once,
//            oldest source first.
//   note     the one-line coverage sentence for under the card.
//
// A player with no row gets null, even when he is on today's list: the Prospect
// Card already shows a current rank, and this card is the past.
export function prospectRankView({ history, playerId, debutYear, currentRank, currentSeason }) {
  const list = playerId == null ? null : history?.players?.[String(playerId)]
  if (!Array.isArray(list) || !list.length) return null

  const sources = history.sources ?? {}
  const depths = history.depths ?? {}
  const rows = [...list].sort((a, b) => a[0] - b[0])

  const entries = []
  let debutPlaced = !Number.isFinite(debutYear)
  const placeDebut = () => {
    entries.push({ kind: 'debut', season: debutYear })
    debutPlaced = true
  }
  for (const [season, rank, source] of rows) {
    // A debut before this season's row goes first; one in the same season goes
    // after it, so the row that year reads before the man arrives.
    if (!debutPlaced && debutYear < season) placeDebut()
    entries.push({
      kind: 'rank',
      season,
      rank,
      of: depths[season] ?? null,
      source,
      sourceLabel: sources[source]?.label ?? null,
    })
    if (!debutPlaced && debutYear === season) placeDebut()
  }
  if (!debutPlaced) placeDebut()
  if (Number.isFinite(currentRank)) entries.push({ kind: 'today', rank: currentRank })

  // Credit only what is on screen, oldest source first, and never twice.
  const shown = [...new Set(rows.map((row) => row[2]))]
    .filter((id) => sources[id])
    .sort((a, b) => sources[a].seasons[0] - sources[b].seasons[0])
  const credits = []
  for (const id of shown) for (const line of sources[id].credit ?? []) if (!credits.includes(line)) credits.push(line)

  return { entries, credits, note: coverageNote(depths, currentSeason, Number.isFinite(currentRank)) }
}

// "Lists cover 2005–2024 and today's list. A year with no line means he was not
// on that year's list. There is no data for 2025." The last sentence appears
// only while the history trails the current season, so the gap is never left to
// read as a fall from the list.
function coverageNote(depths, currentSeason, hasToday) {
  const seasons = Object.keys(depths).map(Number).filter(Number.isFinite)
  if (!seasons.length) return ''
  const first = Math.min(...seasons)
  const last = Math.max(...seasons)
  let note = `Lists cover ${first}–${last}${hasToday ? " and today's list" : ''}. A year with no line means he was not on that year's list.`
  if (Number.isFinite(currentSeason) && currentSeason - 1 > last) {
    const gapStart = last + 1
    const gapEnd = currentSeason - 1
    note += ` There is no data for ${gapStart === gapEnd ? gapStart : `${gapStart}–${gapEnd}`}.`
  }
  return note
}
