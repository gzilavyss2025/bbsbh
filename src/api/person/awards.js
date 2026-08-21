// The player page's Awards section (components/player/AwardsLedger.jsx), and
// the weight order that decides what it leads with.
//
// Split out of transactions.js, which carried the retired Trophy Case and is
// at its own size budget. Nothing here fetches; `awards` is the raw
// /people/{id}/awards feed person-fetch.js already returns.
//
// WHAT CHANGED, AND WHY IT MATTERS. The Trophy Case read two hand-kept
// allowlists and DROPPED every award outside them — which meant a prospect's
// whole minor-league case, every writers'/players' honor, and the WBC simply
// did not exist on the page. This module reads EVERY award the feed carries
// and ranks them instead, so the fix for "the wrong thing is at the top" is an
// ordering the site owner edits (/admin -> Award weight), not an allowlist an
// agent has to grow. An award nobody has ranked sorts LAST, never first.
//
// NOT A SPOILER SURFACE. An award is a season-level fact about a career, on a
// page CLAUDE.md keeps deliberately outside the scoring flow (ADR-0034), and
// nothing here reads a linescore, a box score or a play. The one date rule it
// does honour is `endDate`: the same "entering today" cutoff every other
// dated section of the player page respects, so a game-scoped view of a player
// cannot show an award he had not won yet on that date.

import { MONTH_ABBR } from './shared.js'

// The majors, keyed by the stable award `id` (league-prefixed AL*/NL* pairs),
// mapped to the short label both leagues' versions collapse into. Still
// exported for scripts/gen-awards-history.mjs, so the league-wide Awards
// History page cannot drift from what a player's own page calls the same
// award. Verified live against GET /api/v1/awards.
export const MAJOR_AWARDS = {
  ALMVP: 'MVP', NLMVP: 'MVP',
  ALCY: 'Cy Young', NLCY: 'Cy Young',
  ALROY: 'Rookie of the Year', NLROY: 'Rookie of the Year',
  ALSS: 'Silver Slugger', NLSS: 'Silver Slugger',
  ALGG: 'Gold Glove', NLGG: 'Gold Glove',
  ALPG: 'Platinum Glove', NLPG: 'Platinum Glove',
  ALREL: 'Reliever of the Year', NLREL: 'Reliever of the Year',
  ALAS: 'All-Star', NLAS: 'All-Star',
  ALCPOY: 'Comeback Player', NLCPOY: 'Comeback Player',
  ALHAA: 'Hank Aaron Award', NLHAA: 'Hank Aaron Award',
  MLBRC: 'Roberto Clemente Award',
  MLBAFIRST: 'All-MLB First Team', MLBSECOND: 'All-MLB Second Team',
}

// Curated beyond MAJOR_AWARDS: ids whose feed `name` carries a sponsor or a
// namesake that reads as noise in a table header ("Willie Mays World Series
// MVP"), or an AL/NL pair that should collapse the same way MAJOR_AWARDS does.
// Everything NOT listed here keeps the feed's own name — that is the point of
// opening the allowlist, and a new award MLB adds still renders correctly on
// the day it appears.
const CURATED = {
  ...MAJOR_AWARDS,
  MLBHOF: 'Hall of Fame',
  WSMVP: 'World Series MVP',
  ALCSMVP: 'LCS MVP', NLCSMVP: 'LCS MVP',
  ALMOY: 'Manager of the Year', NLMOY: 'Manager of the Year',
  ASMVP: 'All-Star Game MVP',
  DHOY: 'Outstanding DH of the Year',
  ALPOM: 'Player of the Month', NLPOM: 'Player of the Month',
  ALPITOM: 'Pitcher of the Month', NLPITOM: 'Pitcher of the Month',
  ALROM: 'Rookie of the Month', NLROM: 'Rookie of the Month',
  ALRRELMON: 'Reliever of the Month', NLRRELMON: 'Reliever of the Month',
  ALPOW: 'Player of the Week', NLPOW: 'Player of the Week',
}

// Honors won DURING a season rather than after it: their dates render to the
// month, because "2012, 2012, 2012" for three Rookie of the Month nods is not
// a date list, it is the same token printed three times.
const IN_SEASON_IDS = new Set([
  'ALPOM', 'NLPOM', 'ALPITOM', 'NLPITOM', 'ALROM', 'NLROM',
  'ALRRELMON', 'NLRRELMON', 'ALPOW', 'NLPOW', 'MLBCLUTCHPOM', 'DHLDMOM',
])

// The shipped weight order, most consequential first, with the tier each key
// draws its rule colour from. This is the DEFAULT the /admin panel opens with
// and the fallback whenever the stored order is missing or empty — it is not
// the authority. Keys are RANK keys (see rankKeyOf): one entry governs a
// family, so 'Post-Season All-Star' weighs the Midwest League's, the Texas
// League's and the Arizona Complex League's version together.
const AWARD_WEIGHTS = [
  ['Hall of Fame', 'yearEnd'],
  ['MVP', 'yearEnd'],
  ['Cy Young', 'yearEnd'],
  ['Rookie of the Year', 'yearEnd'],
  ['World Series MVP', 'yearEnd'],
  ['LCS MVP', 'yearEnd'],
  ['Manager of the Year', 'yearEnd'],
  ['All-MLB First Team', 'yearEnd'],
  ['Hank Aaron Award', 'yearEnd'],
  ['Platinum Glove', 'yearEnd'],
  ['Gold Glove', 'yearEnd'],
  ['Silver Slugger', 'yearEnd'],
  ['Reliever of the Year', 'yearEnd'],
  ['Outstanding DH of the Year', 'yearEnd'],
  ['Comeback Player', 'yearEnd'],
  ['Roberto Clemente Award', 'yearEnd'],
  ['All-MLB Second Team', 'yearEnd'],
  ['Warren Spahn Award', 'yearEnd'],
  ['Babe Ruth Award', 'yearEnd'],
  ['The Hutch Award', 'yearEnd'],
  ['Lou Gehrig Award', 'yearEnd'],
  ['All-Star', 'allStar'],
  ['All-Star Game MVP', 'allStar'],
  ['Home Run Derby Winner', 'allStar'],
  ['Home Run Derby Participant', 'allStar'],
  ['Players Choice Player of the Year', 'press'],
  ['Players Choice AL Outstanding Player', 'press'],
  ['Players Choice NL Outstanding Player', 'press'],
  ['Players Choice AL Outstanding Rookie', 'press'],
  ['Players Choice NL Outstanding Rookie', 'press'],
  ['Baseball America Major League Player of the Year', 'press'],
  ['Baseball America Major League Rookie of the Year', 'press'],
  ['Baseball America Major League All-Rookie Team', 'press'],
  ['Wilson AL Defensive Player of the Year', 'press'],
  ['Wilson NL Defensive Player of the Year', 'press'],
  ['Wilson Team Defensive Player of the Year', 'press'],
  ['MLBPAA Heart and Hustle Award', 'press'],
  ['Player of the Month', 'inSeason'],
  ['Pitcher of the Month', 'inSeason'],
  ['Rookie of the Month', 'inSeason'],
  ['Reliever of the Month', 'inSeason'],
  ['Player of the Week', 'inSeason'],
  ['All-Tournament Team', 'intl'],
  ['Baseball America Minor League Player of the Year', 'minors'],
  ['Topps Minor League Player of the Year', 'minors'],
  ['Most Valuable Player', 'minors'],
  ['Prospect of the Year', 'minors'],
  ['Futures Game Selection', 'minors'],
  ['Baseball America Minor League All-Star', 'minors'],
  ['MiLB.com Organization All-Star', 'minors'],
  ['Post-Season All-Star', 'minors'],
  ['Mid-Season All-Star', 'minors'],
  ['Rising Stars', 'minors'],
]

export const DEFAULT_AWARD_ORDER = AWARD_WEIGHTS.map(([key]) => key)
const TIER_BY_KEY = new Map(AWARD_WEIGHTS)

// A league or level code standing at the head of the feed's award name —
// "MID Most Valuable Player", "WBC All-Tournament Team". Two to four capitals
// followed by a space, which is narrow enough that "Topps …", "Baseball
// America …" and "MLBPAA …" all fall through untouched, and "All-MLB First
// Team" does too (its second letter is lowercase).
const LEADING_CODE = /^([A-Z]{2,4}) (?=\S)/

// Which league or level an award belongs to, for the table's League column.
// Ordering is load-bearing: an id like MLBPCALOP carries BOTH a leading "MLB"
// in its name and a standalone " AL " inside it, and the AL half is the one
// that says which league actually voted. Returns null when nothing in the
// feed says — MiLB and writers' awards mostly — and the column prints a dash
// rather than guessing, the same graceful degradation every MiLB field gets.
export function awardLeague(award) {
  const name = award?.name ?? ''
  if (/\bNL\b/.test(name)) return 'NL'
  if (/\bAL\b/.test(name)) return 'AL'
  const lead = LEADING_CODE.exec(name)
  if (lead) return lead[1]
  const id = award?.id ?? ''
  if (id.startsWith('AL')) return 'AL'
  if (id.startsWith('NL')) return 'NL'
  if (id.startsWith('MLB')) return 'MLB'
  return null
}

// The key the WEIGHT ORDER names — one entry per family. A curated id uses its
// collapsed label; anything else drops a leading league/level code so the three
// levels' "Post-Season All-Star" rank as one thing.
export function rankKeyOf(award) {
  const curated = CURATED[award?.id]
  if (curated) return curated
  const name = award?.name ?? ''
  return name.replace(LEADING_CODE, '') || name
}

// The key that makes a TABLE. A curated id collapses its AL/NL pair into one
// table (an MVP is an MVP either side of a trade); everything else keeps the
// feed's own name, so "MID Post-Season All-Star" and "TEX Post-Season
// All-Star" stay the two separate tables MLB.com shows them as, even though
// one weight entry governs both.
function categoryKeyOf(award) {
  return CURATED[award?.id] ?? award?.name ?? award?.id ?? ''
}

function monthYear(iso) {
  const [y, m] = (iso || '').split('-')
  return m ? `${MONTH_ABBR[Number(m) - 1]} ${y}` : y || ''
}

// Broadcast convention: "AL MVP" / "NL Cy Young" is how these are said. Folded
// into the label when every occurrence agrees — the common case — and left as
// the plain base label, with each row keeping its own League cell, once a
// trade actually splits a repeat award across leagues.
function labelFor(baseLabel, rows) {
  const leagues = new Set(rows.map((r) => r.league).filter(Boolean))
  if (leagues.size !== 1) return baseLabel
  const league = [...leagues][0]
  // ONLY AL and NL. Those two are a real split — the same award exists on both
  // sides and the broadcast convention names which one. "MLB" and a level code
  // are not: there is no other Roberto Clemente Award to distinguish it from,
  // and "MLB Roberto Clemente Award" is nobody's name for it. They stay in the
  // League column, which is where a structural fact belongs.
  if (league !== 'AL' && league !== 'NL') return baseLabel
  // And never twice. A label can already carry the league inside it, either
  // because the feed's own name does ("Players Choice AL Outstanding Player")
  // or because it is spelled into a word ("All-MLB First Team" against MLB) —
  // a word-boundary test catches both, where a startsWith check caught neither.
  return new RegExp(`\b${league}\b`).test(baseLabel) ? baseLabel : `${league} ${baseLabel}`
}

// One award category: every time this player won this thing, most recent
// first, with the club and league each time. Uncapped — a nine-time Silver
// Slugger's nine rows are the information the table exists to show.
//
// Rows carry `teamId` as well as the name so the table can draw the club's own
// mark (teamLogoUrl in lib/teams.js). A row whose feed entry names no club
// leaves it null and the cell prints the name alone.
export function awardsView(awards, endDate = null) {
  const byKey = new Map()
  let selections = 0

  for (const a of awards ?? []) {
    // Every row keys off the award's own date — required to enforce the cutoff
    // below, so an award with no date cannot be graded either way.
    if (!a?.season || !a?.date) continue
    if (endDate && a.date > endDate) continue
    const key = categoryKeyOf(a)
    if (!key) continue
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        rankKey: rankKeyOf(a),
        tier: TIER_BY_KEY.get(rankKeyOf(a)) ?? 'other',
        base: CURATED[a.id] ?? a.name,
        inSeason: IN_SEASON_IDS.has(a.id),
        rows: [],
      })
    }
    const cat = byKey.get(key)
    cat.rows.push({
      date: a.date,
      year: Number(a.season),
      when: cat.inSeason ? monthYear(a.date) : String(a.season),
      teamId: a.team?.id ?? null,
      teamName: a.team?.teamName ?? '',
      league: awardLeague(a),
    })
    selections += 1
  }

  const categories = [...byKey.values()].map((cat) => {
    // Most recent first, matching every other dated list on the player page.
    const rows = cat.rows.slice().sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    return {
      key: cat.key,
      rankKey: cat.rankKey,
      tier: cat.tier,
      label: labelFor(cat.base, rows),
      count: rows.length,
      rows,
    }
  })

  return { categories, totals: { categories: categories.length, selections } }
}

// Rank the shaped categories against an order of rank keys. An award the order
// does not name sorts LAST rather than first — the same guard HERO_RANK
// carried, and the reason a new award MLB invents cannot jump the queue on the
// day it appears. Ties (two families at the same weight, or two unranked ones)
// break on count, then alphabetically, so the result is stable rather than
// dependent on the order the feed happened to return.
export function rankAwards(categories, order = DEFAULT_AWARD_ORDER) {
  const weight = new Map()
  order.forEach((key, i) => {
    if (!weight.has(key)) weight.set(key, i)
  })
  const rank = (c) => weight.get(c.rankKey) ?? Number.MAX_SAFE_INTEGER
  return categories.slice().sort((a, b) => {
    const d = rank(a) - rank(b)
    if (d) return d
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label)
  })
}

// The stored order is one rank key per line — the shape a registry field can
// hold and an admin can read in a plain text box even if the reorder UI is
// unavailable. Blank or missing means "use what shipped": an empty box in the
// panel is already how every other copy field says "default", and an order
// nobody has set must not silently rank everything last.
export function parseAwardOrder(raw) {
  const keys = String(raw ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  return keys.length ? keys : DEFAULT_AWARD_ORDER
}

export function formatAwardOrder(keys) {
  return keys.join('\n')
}

// How many categories get a TABLE at this width. One to nine: zero would hide
// the section from a player who has awards, and the index below the cut is
// what keeps anything past it reachable.
export function parseAwardCap(raw, fallback) {
  const n = Number(String(raw ?? '').trim())
  return Number.isInteger(n) && n >= 1 && n <= 9 ? n : fallback
}

// Every rank key the panel can offer: what shipped, plus anything an earlier
// save added, plus whatever the sample player actually has — so a family the
// default order never named is still reorderable once it shows up on a real
// page. Order-preserving and deduped.
export function knownRankKeys(order = DEFAULT_AWARD_ORDER, categories = []) {
  const seen = new Set()
  const out = []
  for (const key of [...order, ...DEFAULT_AWARD_ORDER, ...categories.map((c) => c.rankKey)]) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}
