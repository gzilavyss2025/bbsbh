// Current-activity views: rehab-assignment detection, injured-list detection
// and stints, promoted other-level tiles, and buildBlock — the orchestrator
// that assembles one stat block (tiles + career + splits + logs). See
// ../person.js's header for the module's overall spoiler footing.

import { SPORT_LABEL } from '../../lib/teams.js'
import {
  meetsStintCap,
  txnDate,
  isRehabTxn,
  isRehabEndingTxn,
  mentionsInjuredList,
  injuredListDays,
} from '../rehab-policy.js'
import { MONTH_ABBR } from './shared.js'
import { pitcherRole } from './identity.js'
import { aggregateSplits, hitterTiles, pitcherTiles, splitsView } from './stats.js'
import { gameLogView } from './gameLog.js'
import { milestoneWatchView, mlbCareerThroughCutoff } from './milestones.js'
import { arsenalView } from './advanced.js'
import { careerRegisterView, levelSeasonStat, LEVEL_ORDER_DESC } from './careerRegister.js'

// ---------------------------------------------------------------------------
// Rehab assignment — whether the player is CURRENTLY on a minor-league rehab
// stint, inferred from the same roster-move feed the timeline uses. A rehab
// starts with an "Assigned" (ASG) row whose description says "rehab" (verified
// live: "sent RHP Coleman Crow on a rehab assignment to Nashville Sounds") and
// ends when he returns to the majors — a recall, an activation off the MLB
// injured list, a real option down, or any non-rehab reassignment. So: find the
// most recent rehab ASG, and treat it as active only when no such closing move
// is dated after it. The feed is already capped at the spoiler cutoff, so a
// game-scoped view reflects his status AS OF that game (a big leaguer only, so
// it's gated on debutYear). Returns the rehab club { id, name } or null — the
// caller shows a banner and pins his current-activity sections to MLB, since a
// rehabber is a major leaguer passing through the minors, not a demotion.
//
// txnDate / isRehabTxn / isRehabEndingTxn: see
// rehab-policy.js — shared with gen-rehab.mjs so the app's per-player detector
// and the league-wide Rehab Assignments generator agree on when a rehab ends.
//
// A rehab stint never carries ACROSS a season boundary, same reasoning as
// detectInjuredList below: an uncaptured closing transaction from a prior
// season must not keep painting today's (now-active) player with the amber
// rehab banner. `asOf` is the same spoiler cutoff the caller already used to
// cap the transactions feed.
// ---------------------------------------------------------------------------
export function detectRehabAssignment(transactions, debutYear, asOf) {
  if (!debutYear) return null
  const rehabs = (transactions ?? []).filter((t) => isRehabTxn(t) && txnDate(t))
  if (!rehabs.length) return null
  const latest = rehabs.reduce((a, b) => (txnDate(a) >= txnDate(b) ? a : b))
  const start = txnDate(latest)
  if (asOf && start.slice(0, 4) < asOf.slice(0, 4)) return null
  const ends = (transactions ?? []).some((t) => txnDate(t) > start && isRehabEndingTxn(t))
  if (ends) return null
  const club = latest.toTeam
  return club?.id ? { id: club.id, name: club.name || '' } : null
}

// Injured-list stint detection — the same most-recent-open-stint shape as the
// rehab detector, over the same (already spoiler-capped) transactions feed. A
// placement is an SC row reading "…placed/transferred … on/to the N-day injured
// list"; it closes on a later SC "activated … from the … injured list", a
// return to the active roster — recall (CU), option (OPT), contract selection
// (SE): a stint that ends via a rehab-then-option or a straight recall leaves NO
// "activated from the injured list" row, exactly the return-to-majors codes the
// rehab detector already treats as closers — or a roster-removing move (release /
// free agency / DFA / retirement).
//
// Deliberately NOT a bare "activated" (without a named list): an All-Star or
// international-tournament roster emits "American League All-Stars activated …"
// mid-season, which must NOT be read as coming off the IL (it wrongly cleared
// Buxton's live 10-day stint when we tried it). The All-Star form is excluded
// even WHEN it names the injured list ("American League All-Stars activated RF
// Aaron Judge from the 10-day injured list" is a phantom reinstatement generated
// by an injured player's All-Star selection — he's still hurt).
//
// The list NAME test is mentionsInjuredList (rehab-policy.js), shared so the
// pre-2019 "disabled list" era can't go missing from one consumer and not
// another. The RESERVE list is the third name that can close a stint, and it is
// the reason an injured All-Star used to stay flagged hurt all year: a selection
// re-parks him on the All-Star club's reserve list ("National League All-Stars
// placed RF Mookie Betts on the reserve list"), and his own club then activates
// him from THAT list ("Los Angeles Dodgers activated RF Mookie Betts from the
// reserve list") — so the stint never gets an "activated from the injured list"
// row at all and hung open until the season-boundary reset. Verified on Betts
// (2024), Trout (2022), Alvarez (2022) and Kershaw (2023). Only the ACTIVATION
// side accepts "reserve list": a PLACEMENT on one is either that same All-Star
// parking or a winter-ball club's roster move (Aguilas Cibaenas, Cangrejeros de
// Santurce), never an injury.
const IL_END_CODES = new Set(['CU', 'OPT', 'SE', 'REL', 'RET', 'DFA', 'SFA', 'FA', 'DES'])
export function isIlPlacementTxn(t) {
  return (
    t.typeCode === 'SC' &&
    mentionsInjuredList(t) &&
    /(placed|transferred)/i.test(t.description || '')
  )
}
function isIlEndingTxn(t) {
  if (IL_END_CODES.has(t.typeCode)) return true
  return (
    t.typeCode === 'SC' &&
    /activat/i.test(t.description || '') &&
    (mentionsInjuredList(t) || /reserve list/i.test(t.description || '')) &&
    !/all-stars? activated/i.test(t.description || '')
  )
}

// The player's CURRENT injured-list stint, or null. Takes the most recent IL
// placement and treats it as active unless a later transaction closes it. The day
// count ('7'|'10'|'15'|'60') is parsed from the placement description; a placement
// with no day count (a plain / full-season "injured list") yields days:null and a
// generic label. Score-safe: transactions are already capped at the spoiler
// cutoff by the caller, so this reflects IL status AS OF the game being viewed.
//
// An IL stint never carries ACROSS a season boundary — a season-ending (typically
// 60-day) placement "refreshes" back to active over the offseason as rosters
// reset, and a player still hurt in the spring gets a fresh placement. So a
// placement from a season before the one being viewed (`asOf`, the same cutoff the
// caller capped the feed with) is treated as cleared even if no explicit
// closing transaction was recorded.
export function detectInjuredList(transactions, asOf) {
  const placements = (transactions ?? []).filter((t) => isIlPlacementTxn(t) && txnDate(t))
  if (!placements.length) return null
  const latest = placements.reduce((a, b) => (txnDate(a) >= txnDate(b) ? a : b))
  const start = txnDate(latest)
  if (asOf && start.slice(0, 4) < asOf.slice(0, 4)) return null
  const ends = (transactions ?? []).some((t) => txnDate(t) > start && isIlEndingTxn(t))
  if (ends) return null
  const days = injuredListDays(latest)
  return {
    days,
    label: days ? `${days}-Day` : 'Injured List',
    // The placing club — an MLB parent org, since only a big-league IL
    // placement reads this way. Lets a caller check "is HE announced to
    // start for THAT club today" (loadPlayer.js's `startingToday` override)
    // without a second lookup for which org actually has him on the list.
    team: latest.toTeam?.id ? { id: latest.toTeam.id, name: latest.toTeam.name || '' } : null,
  }
}

// ---------------------------------------------------------------------------
// Injured-list STINTS — the career-ledger counterpart to detectInjuredList's
// "is he hurt right now". Same feed, same predicates, different granularity:
// that one answers a yes/no about today, this one folds the whole feed into one
// entry per stay on the list.
//
// Granularity is the entire point. The raw feed spreads a single stint across
// three to a dozen rows — a placement, sometimes a duplicate placement the same
// day at a different day count (Ohtani, 2023-09-16, is placed on BOTH a 10-day
// and a 15-day list), an optional transfer to the 60-day list, a rehab
// assignment per affiliate visited (Cole's 2026 stint emits ten across four
// clubs), and an activation. Admitting those as rows would bury a career's
// trades under its injuries; folding them into stints is what makes the ledger
// readable — see the transactionTimelineView header for why the timeline shows
// injuries at all.
//
// Walks chronologically holding at most one open stint:
//   • a placement OPENS one — unless a stint is already open on that same date
//     (the duplicate-day-count case above), which is the same stint;
//   • a transfer between lists EXTENDS the open one and upgrades its day count
//     (15-day → 60-day is the season-threatening signal, worth keeping);
//   • a rehab assignment records the affiliate, in visit order, deduped —
//     a rehab is by definition part of the stint it's rehabbing;
//   • any isIlEndingTxn CLOSES it, giving the stint an `end` and a `days` span.
// A stint left open by a missed closer is closed WITHOUT an end rather than
// running forward forever — the next placement, or a placement in a later
// season, ends it. `days` stays null there rather than inventing a span: an
// unclosed stint is a data hole, and a fabricated "693 days out" is worse than
// no number (that exact figure is what a naive placement→next-closer pairing
// produced for Betts's 2024 hand fracture while this was being written).
// ---------------------------------------------------------------------------

function isIlTransferTxn(t) {
  return t.typeCode === 'SC' && mentionsInjuredList(t) && /transferred/i.test(t.description || '')
}

// A transfer names BOTH lists — "transferred RHP Gerrit Cole from the 15-day
// injured list to the 60-day injured list" — so the shared injuredListDays,
// which takes the first day count it sees, would report the list he LEFT.
// The destination is the one that matters (15-day → 60-day is the
// season-threatening signal), so it gets its own read of the "to the" clause.
function transferDestinationDays(t) {
  return (t.description || '').match(/to the (\d+)[- ]day/i)?.[1] ?? injuredListDays(t)
}

function daysBetween(from, to) {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null
}

export function injuredListStints(transactions) {
  const rows = (transactions ?? []).filter((t) => txnDate(t)).slice()
  // Stable sort by date — same-day rows keep feed order, which puts a placement
  // ahead of the activation that can share its date on a one-day stint.
  rows.sort((a, b) => (txnDate(a) < txnDate(b) ? -1 : txnDate(a) > txnDate(b) ? 1 : 0))

  const stints = []
  let open = null
  const close = (end) => {
    if (!open) return
    open.end = end
    open.days = end ? daysBetween(open.start, end) : null
    stints.push(open)
    open = null
  }

  for (const t of rows) {
    const date = txnDate(t)
    if (isIlTransferTxn(t)) {
      if (open) open.days60 = transferDestinationDays(t) ?? open.days60
      continue
    }
    if (isIlPlacementTxn(t)) {
      if (open && open.start === date) continue // same-day duplicate placement
      // A placement while a stint is still open is an ESCALATION, not a second
      // stint — a player can't be put on the IL while already on it. MLB writes
      // the 10-day → 60-day move as a fresh "placed … on the 60-day injured
      // list" as often as it writes a "transferred" row (Judge's 2026 rib
      // fracture is the placed form), and splitting on it produced two rows for
      // one absence, the first of them showing no return at all. Guarded by
      // season so a genuinely missed closer can't fuse two years into one stint
      // — the same season-boundary reasoning detectInjuredList uses.
      if (open && open.start.slice(0, 4) === date.slice(0, 4)) {
        open.days60 = injuredListDays(t) ?? open.days60
        continue
      }
      if (open) close(null) // a missed closer across a season — never span it
      open = {
        start: date,
        end: null,
        days: null,
        days60: injuredListDays(t),
        placement: t,
        club: t.toTeam?.id ? { id: t.toTeam.id, name: t.toTeam.name || '' } : null,
        rehabClubs: [],
      }
      continue
    }
    if (!open) continue
    if (isRehabTxn(t)) {
      const name = t.toTeam?.name
      // id travels alongside the name so the row renderer can resolve each
      // stop's LEVEL (AAA/AA/A+/A/ROK) rather than naming the affiliate — see
      // ilArcClause. Deduped by name, same as before.
      if (name && !open.rehabClubs.some((c) => c.name === name)) {
        open.rehabClubs.push({ id: t.toTeam?.id ?? null, name })
      }
      continue
    }
    if (date > open.start && isIlEndingTxn(t)) close(date)
  }
  if (open) close(null)

  return stints
}

function ilMonthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTH_ABBR[Number(m) - 1]} ${Number(d)}` : ''
}

// One timeline row per stint, in the feed's own voice: the placement's raw
// description IS the opening sentence (it already names the club, position,
// player, day count and the injury — "New York Yankees placed RHP Gerrit Cole
// on the 60-day injured list. Tommy John surgery recovery."), same as every
// other row type on this timeline, with the stint's own arc told as a second,
// connected sentence (`ilArcClause`) rather than a string of bolted-on
// fragments — a duration figure reads as part of "activated May 23 after 60
// days," not an em-dash afterthought. A 15-day → 60-day transfer earns its own
// clause because that upgrade is the season-threatening signal; the rehab
// stops fold into the activation clause because a rehab is where the stint was
// actually spent. The span is omitted when no closer was recorded rather than
// guessed — see injuredListStints.
// The feed's own prose needs two small repairs before anything is appended to
// it: some descriptions end without terminal punctuation ("…on the 7-day
// disabled list. Concussion symptoms"), which would run straight into the next
// clause, and some repeat the injury sentence verbatim ("Right hip
// inflammation. Right hip inflammation." — Betts, 2021-08-11).
function tidyFeedProse(text) {
  const s = String(text ?? '').trim()
  if (!s) return ''
  const collapsed = s.replace(/([^.!?]+[.!?])(?:\s*\1)+/g, '$1')
  return /[.!?]$/.test(collapsed) ? collapsed : `${collapsed}.`
}

// Every other row on this timeline keeps the feed's full sentence, subject and
// all, because a trade or a signing genuinely needs to name the clubs. An IL
// row doesn't: "New York Yankees placed RHP Gerrit Cole on the" is the club
// already drawn as a mark beside the chip plus the player whose page this is,
// and it opened all four of Cole's stints identically. Dropping it leaves the
// part that differs — "60-day injured list. Tommy John surgery recovery." —
// which is also what the INJURED LIST chip reads into. Worth roughly a line and
// a half per row on a phone, on the longest rows the card has.
//
// The feed writes the day count and the injury as two separate sentences
// ("60-day injured list. Right elbow inflammation."), which reads like two
// unrelated facts bumping into each other. The injury is a modifier of the
// list, not its own clause, so it moves inline as a parenthetical —
// "60-day injured list (right elbow inflammation)." — ahead of any
// "retroactive to" date the feed also carries. Falls back to the whole
// (subject-stripped) sentence if this shape doesn't parse — a placement type
// the regex hasn't seen should degrade to the old wording, not vanish.
function ilPlacementProse(t) {
  const full = tidyFeedProse(t.description)
  const stripped = full.match(/\bon the ((?:\d+[- ]day )?(?:injured|disabled) list\b.*)$/is)?.[1] ?? full
  const m = stripped.match(/^((?:\d+[- ]day )?(?:injured|disabled) list)(\s+retroactive to [^.]+)?\.\s*(.*)$/is)
  if (!m) return stripped
  const [, listPhrase, retro = '', injury = ''] = m
  const injuryText = injury.trim().replace(/\.$/, '')
  const paren = injuryText ? ` (${injuryText.charAt(0).toLowerCase()}${injuryText.slice(1)})` : ''
  return `${listPhrase}${paren}${retro}.`
}

// "A", "A and B", "A, B and C" — never an Oxford-comma-less runon.
function humanJoin(items) {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// The affiliate's NAME is a detail the reader has to decode ("is Somerset
// higher or lower than Hudson Valley?"); its LEVEL is the fact that actually
// answers "how far back was he." levelByTeamId (built in loadPlayer from a
// live-or-static team lookup per rehab stop's toTeam id — see its own header)
// resolves each stop to a SPORT_LABEL; a still-unresolved id (a lookup that
// failed) is dropped rather than guessed. Deduped to unique LEVELS, in visit
// order — a five-affiliate tour still tops out around AAA/AA/A+/A/ROK, so
// unlike the old per-club list this never needs a "+N more" overflow.
function rehabLevels(clubs, levelByTeamId) {
  const levels = []
  for (const c of clubs) {
    const label = SPORT_LABEL[levelByTeamId.get(c.id)]
    if (label && !levels.includes(label)) levels.push(label)
  }
  return levels
}

// Rehab and activation are one clause, not two independent bolt-ons — they're
// really one fact ("how the stint ended") — so the total-days figure is folded
// in as "after N days" rather than dash-appended like a data field. Degrades
// by omission at every joint: no rehab stops → no "Rehabbed with" lead-in, no
// recorded closer → no "activated" clause at all (never a guessed date), no
// computed span → no "after N days" (see injuredListStints on why a missed
// closer's days stays null rather than invented). A rehab with no recorded
// activation yet reads as its own present-tense clause instead of vanishing.
function ilArcClause(s, levelByTeamId) {
  const levels = rehabLevels(s.rehabClubs, levelByTeamId)
  const rehab = levels.length ? `${humanJoin(levels)} team${levels.length === 1 ? '' : 's'}` : ''
  if (!s.end) return rehab ? `Rehabbing with ${rehab}.` : ''
  const span = s.days != null ? ` after ${s.days} ${s.days === 1 ? 'day' : 'days'}` : ''
  return rehab
    ? `Rehabbed with ${rehab}, then activated ${ilMonthDay(s.end)}${span}.`
    : `Activated ${ilMonthDay(s.end)}${span}.`
}

export function ilStintRow(s, levelByTeamId) {
  const parts = [ilPlacementProse(s.placement)]
  if (s.days60 && s.days60 !== injuredListDays(s.placement)) {
    parts.push(`Later transferred to the ${s.days60}-day list.`)
  }
  const arc = ilArcClause(s, levelByTeamId)
  if (arc) parts.push(arc)
  return {
    sig: `IL|${s.start}`,
    date: s.start,
    code: 'IL',
    label: 'Injured List',
    tone: 'out',
    description: parts.join(' '),
    links: null,
    club: s.club,
  }
}

// The league-wide counterpart to detectRehabAssignment — every big leaguer
// currently on a rehab assignment, for the standalone Rehab Assignments page —
// no longer lives here: that list can't be built spoiler-cheaply on a page load
// (each stint has to be verified against the player's game log to drop ones that
// have really ended), so it's precomputed on a cron into public/data/rehab.json.
// See scripts/gen-rehab.mjs (which keeps its own copy of the transaction-scan
// logic above) and src/api/rehab.js.

// ---------------------------------------------------------------------------
// Promoted other-level tiles — the current season's line at each level the
// player appeared at this year OTHER than his current-activity level: the AAA
// half of an up-and-down big leaguer (Rowdy Tellez — Braves + Gwinnett), or the
// MLB half of a player currently optioned down. Surfaced as their own tile row
// (see PlayerPage) right beside the main "Current season" tiles, so a split
// season shows BOTH levels prominently rather than only in the career register
// below.
//
// Rules — a tile row is a curated HIGHLIGHT, not a record, so unlike the career
// register (which now shows every stint at every level, with no threshold at
// all) this keeps a workload gate:
//   • the current-activity level is skipped — its line already leads the main
//     "Current season" tiles;
//   • MLB action is always real team history, so an MLB stint always promotes;
//   • a MiLB stint promotes only when it clears the rehab cap (meetsStintCap),
//     so a handful of rehab at-bats never lights up a promoted tile row. That
//     stint still gets its own line in the register — the tile row is what it
//     does not earn.
// Full-season figures (like the register rows they mirror — NOT the date-cut
// "entering today" the main tiles use), highest level first. Null when the
// player stayed at one level all year (the common case).
// ---------------------------------------------------------------------------

export function otherLevelSeasonBlocks({ mlbSplits, milbSplits, group, currentSeason, currentSportId }) {
  const cur = Number(currentSeason)
  const byLevel = new Map()
  for (const s of [...(mlbSplits ?? []), ...(milbSplits ?? [])]) {
    if (Number(s.season) !== cur) continue
    const sid = s.sport?.id
    if (!sid || sid === currentSportId) continue
    if (!byLevel.has(sid)) byLevel.set(sid, [])
    byLevel.get(sid).push(s)
  }
  if (!byLevel.size) return null
  const order = (sid) => {
    const i = LEVEL_ORDER_DESC.indexOf(sid)
    return i < 0 ? LEVEL_ORDER_DESC.length : i
  }
  const out = []
  for (const sid of [...byLevel.keys()].sort((a, b) => order(a) - order(b))) {
    const stat = levelSeasonStat(byLevel.get(sid), group)
    if (!stat) continue
    if (sid !== 1 && !meetsStintCap(stat, group)) continue
    const role = group === 'pitching' ? pitcherRole(stat) : null
    out.push({
      sportId: sid,
      level: SPORT_LABEL[sid] ?? '',
      role,
      tiles: group === 'pitching' ? pitcherTiles(stat, role) : hitterTiles(stat),
    })
  }
  return out.length ? out : null
}

// ---------------------------------------------------------------------------
// One stat block (a group's tiles + career + splits + logs). A normal player
// has one block; a two-way player has two (batting then pitching).
// ---------------------------------------------------------------------------

export function buildBlock({ group, role, seasonSplits, careerSplits, lrSplits, gameLogSplits, altGameLogSplits, arsenalSplits, mlbYbySplits, milbYbySplits, cutoff, currentSeason, currentSportId, debutYear, retiredYear = null, tileStat, levelOnlyStat, levelOnlySplits, logTagLevel = false, warByYear = {}, warByTeam = {}, transactions = [], orgOf = null }) {
  // The date-cut current-season stat at the player's CURRENT level. It leads
  // the "Current season" tiles, so it can't move mid-game. `tileStat` (see
  // loadPlayer) resolves to the live level for an active MLB/single-level
  // player but combines every MiLB level played this year when he hasn't
  // appeared in the majors this season — right for a one-line tile, but the
  // register's current-season row (see careerRegisterView) must stay
  // level-scoped, so it uses `levelOnlyStat` (the same date-cut window,
  // filtered to just this level) instead, falling back to `tileStat` only if
  // that level-only fetch came back empty.
  const season = aggregateSplits(seasonSplits, group)
  const career = aggregateSplits(careerSplits, group)
  const tile = tileStat ?? season
  // Season WAR for the tile is MLB-only: use it only when the tiles' level is
  // MLB (an up-and-down big leaguer's tiles resolve to MLB even while his live
  // club is a MiLB affiliate), else the tile shows a dash.
  const tileWar = currentSportId === 1 ? warByYear[currentSeason] ?? null : null
  // Milestone watch reads a cutoff-safe career total (mlbCareerThroughCutoff),
  // deliberately NOT `career` above — see that function's header for why the
  // API's live career total would leak a not-yet-revealed milestone.
  const milestoneStat = mlbCareerThroughCutoff(
    { mlbSplits: mlbYbySplits, tileStat: tile, tileSportId: currentSportId, currentSeason },
    group,
  )
  const otherLevels = otherLevelSeasonBlocks({
    mlbSplits: mlbYbySplits, milbSplits: milbYbySplits, group, currentSeason, currentSportId,
  })
  const logLimit = group === 'pitching' ? 6 : 8
  return {
    group,
    role,
    title: group === 'pitching' ? 'Pitching' : 'Batting',
    tiles: group === 'pitching' ? pitcherTiles(tile, role, tileWar) : hitterTiles(tile, tileWar),
    // The level the "Current season" tiles belong to (MLB for an up-and-down big
    // leaguer even while his live club is a MiLB affiliate) — the label uses it,
    // and it's the level the promoted other-level tiles below skip.
    tileSportId: currentSportId,
    // The current season's line at each OTHER level he played this year (the
    // AAA half of an up-and-down big leaguer, say) — promoted to their own tile
    // row beside the main tiles rather than buried in the register footnote.
    otherLevels,
    arsenal: group === 'pitching' ? arsenalView(arsenalSplits) : null,
    splits: splitsView(lrSplits, group),
    gameLog: gameLogView(gameLogSplits, group, cutoff, logLimit, { tagLevel: logTagLevel }),
    // The Game log's level toggle — offered only when `otherLevels` (above)
    // already found a second level worth a promoted tile THIS season, so the
    // toggle never appears without the tile giving it context. Reuses that
    // same gate rather than inventing a separate games-played floor: an
    // up-and-down player's AAA half is either substantial enough to headline
    // its own tile, or it isn't shown at all, and the log toggle should agree.
    // `altGameLogSplits` is fetched by loadPlayer for exactly the highest
    // other level (`otherLevels[0]`, already sorted MLB-first) — null here
    // for everyone else, including a rehab combined log (already both levels,
    // per-row tagged) so the two ways of seeing a split level never compete.
    gameLogAlt: otherLevels?.length
      ? gameLogView(altGameLogSplits, group, cutoff, logLimit)
      : null,
    gameLogAltLevel: otherLevels?.length ? otherLevels[0].level : null,
    // The unified MLB + MiLB career table. `career` (the API's MLB career line
    // for a debuted player) foots the MLB total; the current-season rows use
    // the date-cut `levelOnlySplits` so they can't move mid-game — the raw
    // per-club rows, since the register prints a line per club. `currentStat`
    // stays alongside them as the fallback for when that fetch came back empty.
    register: careerRegisterView({
      mlbSplits: mlbYbySplits, milbSplits: milbYbySplits, group, role, debutYear,
      currentStat: levelOnlyStat ?? tile, currentSplits: levelOnlySplits,
      currentSeason, currentSportId, retiredYear, careerStat: career, warByYear, warByTeam,
      transactions, orgOf,
    }),
    milestones: milestoneWatchView(milestoneStat, group),
  }
}
