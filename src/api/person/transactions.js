// Transaction timeline — the career roster-move ledger at the foot of the
// player page. See ../person.js's header for the module's overall spoiler
// footing. Career honors used to live here too; they now have their own
// module and their own section (./awards.js, AwardsLedger.jsx).
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
// longer ride this timeline — see ./awards.js, which feeds the player page's
// dedicated Awards section.
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
