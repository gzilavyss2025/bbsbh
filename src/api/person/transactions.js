// Transaction timeline — the career roster-move ledger at the foot of the
// player page — plus the Trophy Case, the career-honors card. See
// ../person.js's header for the module's overall spoiler footing.
//
// The raw /transactions feed is verbose and duplicative (a single IL stint
// emits 3-4 near-identical "Status Change" rows; the #42/#21 ceremonial number
// swaps repeat every April and September), so transactionTimelineView CURATES
// it down to the moves that tell a career story and drops the administrative
// noise:
//
//   • KEEP by type (TXN_TYPES whitelist): trades, signings (FA / int'l /
//     amateur), the draft & Rule 5, contract selections & purchases, recalls &
//     options, waivers & claims, DFAs & releases, retirements, suspensions.
//   • KEEP an "Assigned" (ASG) row ONLY when it moves the player BETWEEN two
//     clubs (both fromTeam + toTeam) and isn't a rehab — that isolates genuine
//     affiliate-to-affiliate promotions/demotions (a prospect's climb up the
//     farm) while dropping rehab stints, spring-training invites, and All-Star /
//     winter-ball / national-team call-ups (which all lack a fromTeam).
//   • KEEP the injured list, but as one row per STINT, never per raw row —
//     see injuredListStints (activity.js). The type whitelist alone used to
//     drop it, which hid the defining stretch of a lot of careers: Gerrit
//     Cole's ledger was EMPTY from 2023 through 2026, the Tommy John years,
//     and Aaron Judge's stopped at his 2022 re-signing. It is also the one
//     omission the app contradicted itself on — the page's own header banner,
//     the career register's "Injured — missed season" note, and the Team
//     Page's transaction card all show IL moves already.
//   • DROP everything else: the rest of Status Change (roster status, bare
//     activations, spring reassignments), number changes, arbitration filings.
//     The paternity, bereavement, family-medical and restricted lists are
//     dropped DELIBERATELY and are not an oversight to be "completed" later:
//     they are a player's private life rather than roster strategy — a newborn,
//     a death in the family, a sick child — and this app has no editorial hand
//     to render them with care. The information cost is a couple of dozen rows
//     across a career; the downside isn't symmetric.
//
// Then dedupe exact repeats (same type + date + teams) and sort NEWEST-first,
// so the strip reads top-to-bottom as most-recent to least-recent. Synthetic
// award and draft rows (which aren't in the raw feed) are merged in by the
// caller-supplied enrichment before the sort. Degrades to null when nothing
// survives.
//
// Spoiler footing: unchanged. An IL row carries a date, a club and an injury
// ("Right elbow inflammation.") — never game state — and `push` already drops
// anything after the caller's `endDate` cutoff, so a game-scoped view can't see
// a placement that hasn't happened yet. No seal, no ADR exception.

import { SPORT_LABEL } from '../../lib/teams.js'
import { MONTH_ABBR } from './shared.js'
import { injuredListStints, ilStintRow } from './activity.js'

// typeCode -> { label (short chip text), tone }. `tone` drives the chip/node
// color: 'add' a club gained him, 'out' a club lost him, 'move' a lateral or
// administrative move. ASG (an affiliate transfer) is handled separately below.
const TXN_TYPES = {
  TR:  { label: 'Trade',        tone: 'move' },
  SFA: { label: 'Signed',       tone: 'add' },
  SGN: { label: 'Signed',       tone: 'add' },
  IFA: { label: 'Signed',       tone: 'add' },
  DR:  { label: 'Drafted',      tone: 'add' },
  R5:  { label: 'Rule 5',       tone: 'add' },
  R5M: { label: 'Rule 5',       tone: 'add' },
  SE:  { label: 'Selected',     tone: 'add' },
  CU:  { label: 'Recalled',     tone: 'add' },
  PUR: { label: 'Purchased',    tone: 'add' },
  CP:  { label: 'Purchased',    tone: 'add' },
  CLW: { label: 'Claimed',      tone: 'add' },
  ACQ: { label: 'Acquired',     tone: 'add' },
  OBT: { label: 'Acquired',     tone: 'add' },
  AWD: { label: 'Awarded',      tone: 'add' },
  OPT: { label: 'Optioned',     tone: 'out' },
  OUT: { label: 'Outrighted',   tone: 'out' },
  DES: { label: 'DFA',          tone: 'out' },
  WA:  { label: 'Waived',       tone: 'out' },
  REL: { label: 'Released',     tone: 'out' },
  URL: { label: 'Released',     tone: 'out' },
  DFA: { label: 'Free Agent',   tone: 'out' },
  RET: { label: 'Retired',      tone: 'out' },
  SU:  { label: 'Suspended',    tone: 'move' },
  NC:  { label: 'New Contract', tone: 'move' },
}

// Competition level rank, high number = higher level, so an ASG that moves a
// prospect between affiliates reads as a promotion (CALLED UP) or demotion
// (SENT DOWN) by comparing the two clubs' ranks. Unknown sportIds (complex
// leagues, alternate sites) have no rank, so their move stays a plain "Assigned".
const LEVEL_RANK = { 1: 6, 11: 5, 12: 4, 13: 3, 14: 2, 16: 1 }

// The awards worth surfacing — the majors only, keyed by the stable award `id`
// (league-prefixed AL*/NL* pairs), mapped to a short label. All-Star selections
// (ALAS/NLAS) live here too — the awards feed carries them with the game's own
// date, so they need no separate roster lookup. Verified live. Used by
// trophyCaseView below (the transaction timeline no longer carries awards —
// see ADR note there) and exported for scripts/gen-awards-history.mjs, so the
// league-wide Awards History page can't drift from what a player's own Trophy
// Case counts as hardware.
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

// In-season honors — the majors only, same AL/NL-pair collapse as MAJOR_AWARDS
// above. Kept separate from it (rather than folded in) because these belong in
// the Trophy Case's own "in-season" tier, grouped into one badge with a count
// per label — a decorated veteran can rack up a dozen Player of the Week nods,
// which would drown the hardware tier if treated the same way. Ids verified
// live against GET /api/v1/awards.
const INSEASON_AWARDS = {
  ALPOM: 'Player of the Month', NLPOM: 'Player of the Month',
  ALPITOM: 'Pitcher of the Month', NLPITOM: 'Pitcher of the Month',
  ALROM: 'Rookie of the Month', NLROM: 'Rookie of the Month',
  ALRRELMON: 'Reliever of the Month', NLRRELMON: 'Reliever of the Month',
  ALPOW: 'Player of the Week', NLPOW: 'Player of the Week',
}

function awardMonthYear(iso) {
  const [y, m] = (iso || '').split('-')
  return m ? `${MONTH_ABBR[Number(m) - 1]} ${y}` : ''
}

// The league a league-partitioned award's id belongs to (its own AL*/NL*
// prefix) — null for an MLB-wide award (MLBRC, MLBAFIRST, MLBSECOND) with
// no league split at the source. Every occurrence of a label is either
// all-set or all-null (it comes from the id prefix, never mixed), which is
// what lets labelWithLeague below fold a single league in with no ambiguity.
function leagueOf(id) {
  if (id.startsWith('AL')) return 'AL'
  if (id.startsWith('NL')) return 'NL'
  return null
}

// Broadcast convention: "AL MVP" / "NL Cy Young" is how these are actually
// said. Folded into the row's label when every occurrence agrees (the
// common case — a player who's only ever won something in one league) —
// left as the plain base label, with a per-date league tag instead, only
// once a trade actually splits a repeat award across leagues.
function labelWithLeague(baseLabel, entriesDesc) {
  const leagues = new Set(entriesDesc.map((e) => e.league).filter(Boolean))
  return leagues.size === 1 ? `${[...leagues][0]} ${baseLabel}` : baseLabel
}

// Two Player of the Week awards can land in the same month — formatOne's
// month granularity then renders the same token twice in a row, which
// reads as a duplicate-content bug rather than "this happened twice."
// Collapses adjacent equal tokens (the list is already most-recent-first,
// so same-month awards are always adjacent) into one with a "×N" suffix —
// still uncapped, still every occurrence accounted for, just not printed
// as if it were copy-pasted.
function collapseRepeatedTokens(tokens) {
  const out = []
  for (const t of tokens) {
    const last = out[out.length - 1]
    if (last && last.text === t) last.count += 1
    else out.push({ text: t, count: 1 })
  }
  return out.map((o) => (o.count > 1 ? `${o.text} ×${o.count}` : o.text))
}

// Every date a player earned an honor, most recent first — uncapped (a
// heavily-decorated veteran's 11-time Player of the Week is real, and
// truncating it behind a "+N more" hides real information the card exists
// to show). Each date only carries its OWN league tag when the row's label
// couldn't already say it for all of them.
function dateStrings(entriesAsc, formatOne) {
  const desc = entriesAsc.slice().reverse()
  const leagues = new Set(desc.map((e) => e.league).filter(Boolean))
  const tagEach = leagues.size > 1
  const tokens = desc.map((e) => (tagEach && e.league ? `${formatOne(e.value)} ${e.league}` : formatOne(e.value)))
  return collapseRepeatedTokens(tokens)
}

// One row's worth of shape from its raw {value, league} instances —
// `label` already carries any folded league prefix, `dates` is the full
// formatted, most-recent-first list a ledger row or the marquee renders
// directly, and `count` is the raw occurrence count (used to size the
// collapsed tally and to rank the in-season hero).
function badgeRow(label, entriesAsc, formatOne) {
  return {
    key: label,
    label: labelWithLeague(label, entriesAsc.slice().reverse()),
    count: entriesAsc.length,
    dates: dateStrings(entriesAsc, formatOne),
  }
}

// Hero rank — the single most prestigious honor, promoted to the Trophy
// Case's marquee. Keyed on the UNLABELED base name (before any league
// fold). An award missing from this list (MAJOR_AWARDS grew a new entry
// nobody updated this for) ranks LAST, never first, rather than jumping
// the queue via a stray Array.indexOf === -1.
const HERO_RANK = [
  'MVP', 'Cy Young', 'Rookie of the Year', 'Platinum Glove', 'Hank Aaron Award',
  'All-MLB First Team', 'Gold Glove', 'Silver Slugger', 'Reliever of the Year',
  'Comeback Player', 'Roberto Clemente Award', 'All-MLB Second Team',
]
function heroRank(key) {
  const i = HERO_RANK.indexOf(key)
  return i === -1 ? Infinity : i
}
// The top half of HERO_RANK — season-defining, single-winner honors (MVP
// through All-MLB First Team) — get the marquee's full typographic
// treatment; the rest (Gold Glove down through All-MLB Second Team) are
// real honors but not career-defining the same way, so the marquee renders
// them smaller (see TrophyCase.jsx's Marquee). Keeps the demotion in sync
// with HERO_RANK's own ordering rather than a second hand-curated list.
const PREMIER_HERO_RANK_CUTOFF = 6

// The single most prestigious honor a player has — major hardware outranks
// an All-Star selection outranks the in-season honor won most often (a
// player with neither hardware nor All-Star still gets a marquee, built
// from whichever in-season honor repeats most). `row` is a REFERENCE into
// the same array groupRows below filters against, so identity comparison
// (`r === hero.row`) is what pulls it out of its own tier's ledger group.
function pickHero(hardwareRows, allStarRow, inSeasonRows) {
  if (hardwareRows.length) {
    const sorted = hardwareRows.slice().sort((a, b) => heroRank(a.key) - heroRank(b.key))
    const premier = heroRank(sorted[0].key) < PREMIER_HERO_RANK_CUTOFF
    return { kind: 'hardware', row: sorted[0], premier }
  }
  if (allStarRow) return { kind: 'allstar', row: allStarRow }
  if (inSeasonRows.length) {
    const sorted = inSeasonRows.slice().sort((a, b) => b.count - a.count)
    return { kind: 'inseason', row: sorted[0] }
  }
  return null
}

// Groups the user asked for, in order: in-season honors (won DURING the
// year), Year-End Awards (decided AFTER it — MVP, Cy Young, Gold Glove, ...;
// named for when it's announced, not "Hardware," and deliberately not
// "Postseason Honors" — those are regular-season awards, not playoff ones),
// then All-Star, since a mid-season selection is neither. Whichever row
// became the hero is pulled out of its tier so it isn't shown twice; each
// group carries its own occurrence COUNT for the collapsed tally.
function buildGroups(hardwareRows, allStarRow, inSeasonRows, hero) {
  const groups = []

  const isRows = inSeasonRows.filter((r) => !(hero.kind === 'inseason' && r === hero.row))
  if (isRows.length) {
    groups.push({ key: 'inSeason', label: 'In-season honors', count: isRows.reduce((n, r) => n + r.count, 0), rows: isRows })
  }

  const hwRows = hardwareRows.filter((r) => !(hero.kind === 'hardware' && r === hero.row))
  if (hwRows.length) {
    groups.push({ key: 'yearEnd', label: 'Year-End Awards', count: hwRows.reduce((n, r) => n + r.count, 0), rows: hwRows })
  }

  if (allStarRow && hero.kind !== 'allstar') {
    groups.push({ key: 'allStar', label: 'All-Star', count: allStarRow.count, rows: [allStarRow] })
  }

  return groups
}

// Trophy Case — the player page's career-honors card: a marquee for the
// single most prestigious honor (`hero`), then everything else in ledger
// `groups` below it. `awards` is the same raw per-player awards feed the
// transaction timeline used to carry a single buried chip from — that row
// type is retired in favor of this dedicated card. `endDate` is the same
// spoiler cutoff every other date-bound section of the player page respects
// ("entering today" for a game-scoped view) — an award dated after it
// hasn't happened yet from the page's vantage point, so it's excluded same
// as a too-late transaction row used to be. Returns null when the player
// has none of the three tiers, so the card can skip rendering entirely
// rather than show an empty case.
export function trophyCaseView(awards, endDate = null) {
  const hardwareByLabel = new Map() // label -> Map<year, league>
  const inSeasonByLabel = new Map() // label -> [{ value: date, league }]
  const allStarByYear = new Map() // year -> league

  for (const a of awards ?? []) {
    // Every tier keys off the award's own date — required to enforce the
    // cutoff above, so an award with no date can't be graded either way.
    if (!a.season || !a.date) continue
    if (endDate && a.date > endDate) continue
    const league = leagueOf(a.id)
    if (a.id === 'ALAS' || a.id === 'NLAS') {
      allStarByYear.set(Number(a.season), league)
      continue
    }
    const hw = MAJOR_AWARDS[a.id]
    if (hw) {
      if (!hardwareByLabel.has(hw)) hardwareByLabel.set(hw, new Map())
      hardwareByLabel.get(hw).set(Number(a.season), league)
      continue
    }
    const label = INSEASON_AWARDS[a.id]
    if (label) {
      if (!inSeasonByLabel.has(label)) inSeasonByLabel.set(label, [])
      inSeasonByLabel.get(label).push({ value: a.date, league })
    }
  }

  // Row order stays chronological-by-first-won (a career reads left to
  // right the way it happened); it's only the DATES inside a row that are
  // most-recent-first.
  const hardwareRows = [...hardwareByLabel.entries()]
    .map(([label, yearMap]) => [
      label,
      [...yearMap.entries()].map(([year, league]) => ({ value: year, league })).sort((a, b) => a.value - b.value),
    ])
    .sort((a, b) => a[1][0].value - b[1][0].value)
    .map(([label, entriesAsc]) => badgeRow(label, entriesAsc, String))

  const inSeasonRows = [...inSeasonByLabel.entries()]
    .map(([label, entries]) => [label, entries.slice().sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))])
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, entriesAsc]) => badgeRow(label, entriesAsc, awardMonthYear))

  const allStarEntriesAsc = [...allStarByYear.entries()]
    .map(([year, league]) => ({ value: year, league }))
    .sort((a, b) => a.value - b.value)
  const allStarRow = allStarEntriesAsc.length ? badgeRow('All-Star', allStarEntriesAsc, String) : null

  if (!hardwareRows.length && !allStarRow && !inSeasonRows.length) return null

  const hero = pickHero(hardwareRows, allStarRow, inSeasonRows)
  return { hero, groups: buildGroups(hardwareRows, allStarRow, inSeasonRows, hero) }
}

// MLB Draft first-round (Day 1) dates — the API carries no draft date anywhere
// (verified: neither the person `drafts` hydrate nor /draft/{year} has one), so
// a draft record is pinned to a small hand-kept table. Approximate by design
// (the user only wants "the day of that year's first round"); years outside the
// table fall back by era — the draft sat in early June through 2020, then moved
// to All-Star week in July from 2021 on.
const DRAFT_DATES = {
  2012: '06-04', 2013: '06-06', 2014: '06-05', 2015: '06-08', 2016: '06-09',
  2017: '06-12', 2018: '06-04', 2019: '06-03', 2020: '06-10', 2021: '07-11',
  2022: '07-17', 2023: '07-09', 2024: '07-14', 2025: '07-13', 2026: '07-12',
}
function draftDate(year) {
  const md = DRAFT_DATES[year] ?? (year >= 2021 ? '07-14' : '06-06')
  return `${year}-${md}`
}

// A trade's identity, independent of which player's feed it came from: the day
// plus the unordered club pair. Both the queried player's TR row and every
// other player's row in the same swap hash to this, so the caller can attach
// the cohort of other players to the right trade.
export function tradeKey(date, aId, bId) {
  const [lo, hi] = [aId, bId].sort((x, y) => x - y)
  return `${date}|${lo ?? ''}|${hi ?? ''}`
}

// Rebuild an "Assigned" description with each club's level tagged after its
// name — "SS Cooper Pratt assigned to Nashville Sounds (AAA) from Biloxi
// Shuckers (AA)." — reusing the feed's own "{POS} {Name} assigned to …" prefix
// so the player descriptor stays exact. Falls back to the raw description if
// the prefix can't be parsed.
function assignedDescription(t, fromLevel, toLevel) {
  const desc = t.description || ''
  const prefix = desc.match(/^(.*?)\s+assigned to\s+/i)?.[1]
  const toName = t.toTeam?.name || ''
  const fromName = t.fromTeam?.name || ''
  if (!prefix || !toName || !fromName) return desc
  const withLevel = (name, lvl) => (lvl ? `${name} (${lvl})` : name)
  return `${prefix} assigned to ${withLevel(toName, toLevel)} from ${withLevel(fromName, fromLevel)}.`
}

// Undrafted / international signees carry no draft record (`personBio`'s
// `draft` comes back null — see `draftInfo`), so the player page's Draft fact
// falls back to this: the year of the earliest transaction the raw feed
// itself labels 'Signed' via TXN_TYPES (SFA/SGN/IFA — free agent, amateur, or
// international). Reuses the SAME lookup the transaction timeline already
// applies rather than a second whitelist, so the two can't drift.
export function signedFallback(transactions) {
  let earliest = null
  for (const t of transactions ?? []) {
    if (TXN_TYPES[t.typeCode]?.label !== 'Signed') continue
    const date = t.effectiveDate || t.date
    if (date && (!earliest || date < earliest)) earliest = date
  }
  return earliest ? Number(earliest.slice(0, 4)) : null
}

// Curate + shape the career roster-move ledger. `transactions` is the raw
// player-scoped feed; the rest is async-resolved enrichment the caller gathers
// (see loadPlayer): `levelByTeamId` maps a club id to its sportId (for the
// CALLED UP / SENT DOWN direction and the level tags, plus each Injured List
// row's rehab-stop levels — see ilArcClause), `tradeOthers` maps a
// tradeKey to the other players in that swap (for the in-description links),
// `draft` is the shaped draft record, and `rookieUntil` is the date (from
// public/data/rookies.json) he exceeded the rookie limit, if ever. Rows dated
// after `endDate` (the spoiler cutoff) are dropped. Newest first. Awards no
// longer ride this timeline — see trophyCaseView, the player page's dedicated
// honors card.
export function transactionTimelineView(
  transactions,
  {
    selfId,
    levelByTeamId = new Map(),
    tradeOthers = new Map(),
    draft = null,
    rookieUntil = null,
    endDate = null,
  } = {},
) {
  const rows = []
  const seen = new Set()
  const push = (row) => {
    if (endDate && row.date > endDate) return
    const sig = row.sig ?? `${row.code}|${row.date}`
    if (seen.has(sig)) return
    seen.add(sig)
    delete row.sig
    rows.push({ ...row, year: Number(row.date.slice(0, 4)) })
  }

  for (const t of transactions ?? []) {
    const code = t.typeCode
    const fromId = t.fromTeam?.id ?? null
    const toId = t.toTeam?.id ?? null
    const desc = t.description || ''
    const date = t.effectiveDate || t.date
    if (!date) continue
    let label
    let tone
    let description = desc
    let links = null
    if (code === 'ASG') {
      // Real affiliate-to-affiliate move only — both clubs present, not rehab.
      if (!fromId || !toId || /rehab/i.test(desc)) continue
      const fromLvl = levelByTeamId.get(fromId)
      const toLvl = levelByTeamId.get(toId)
      const fRank = LEVEL_RANK[fromLvl]
      const tRank = LEVEL_RANK[toLvl]
      if (fRank && tRank && tRank > fRank) { label = 'Called Up'; tone = 'add' }
      else if (fRank && tRank && tRank < fRank) { label = 'Sent Down'; tone = 'out' }
      else { label = 'Assigned'; tone = 'move' }
      description = assignedDescription(t, SPORT_LABEL[fromLvl], SPORT_LABEL[toLvl])
    } else {
      const type = TXN_TYPES[code]
      if (!type) continue
      label = type.label
      tone = type.tone
      if (code === 'TR') {
        // Linkify the other players in this swap — resolved by tradeKey from a
        // team+date lookup (the player-scoped feed names them only as free text).
        const others = tradeOthers.get(tradeKey(date, fromId, toId)) ?? []
        links = others.filter((p) => p.id !== selfId)
      }
    }
    push({
      sig: `${code}|${date}|${fromId ?? ''}|${toId ?? ''}`,
      date,
      code,
      label,
      tone,
      description,
      links,
      // The club to anchor the row's logo: the destination the move put him at,
      // else the club he left (a release/DFA carries only a toTeam = old club).
      club: toId
        ? { id: toId, name: t.toTeam.name }
        : fromId
          ? { id: fromId, name: t.fromTeam.name }
          : null,
    })
  }

  // Injured list — one row per STINT, folded from the placement / transfer /
  // rehab / activation rows the loop above deliberately skipped.
  for (const stint of injuredListStints(transactions)) push(ilStintRow(stint, levelByTeamId))

  // Draft — a synthetic row on that year's first-round date, alongside (not
  // instead of) the signing the raw feed already carries.
  if (draft && draft.year && draft.round && draft.overall) {
    push({
      code: 'DRAFT',
      date: draftDate(Number(draft.year)),
      label: 'Drafted',
      tone: 'add',
      description: `Drafted by the ${draft.teamName || 'club'} in Round ${draft.round} (#${draft.overall} overall).`,
      links: null,
      club: draft.teamId ? { id: draft.teamId, name: draft.teamName } : null,
    })
  }

  // Rookie status lost — a synthetic row on the date his career AB/IP crossed
  // the rookie limit (public/data/rookies.json), same style as DRAFT above.
  if (rookieUntil) {
    push({
      code: 'ROOKIE_LOST',
      date: rookieUntil,
      label: 'Lost Rookie Status',
      tone: 'move',
      description: 'Exceeded the rookie limit of 130 at-bats or 50 innings pitched.',
      links: null,
      club: null,
    })
  }

  if (!rows.length) return null
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return { rows }
}
