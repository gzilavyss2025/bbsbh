// Pure shapers for the Trade Deadline page's data pipeline: group a season's
// deduped trade rows into one story per real trade (however many teams/
// players are involved), detect non-player considerations (cash, a PTBNL,
// future considerations, international bonus-pool space, a draft pick —
// see CONSIDERATION_TYPES), and build the cutline prose — plus the reader
// half that loads the static, per-season
// files scripts/gen-trade-deadline.mjs precomputes from these same
// functions (the gen-team-transactions.mjs "import the app's own shaper so
// script and app can't drift" convention). Full design: the scoping plan at
// .claude/plans (session-local) informed this; see root CLAUDE.md's
// build-time-fetch pattern for the general shape.
//
// Spoiler note: completed trades and their dates carry no score, so nothing
// here is reveal-only — this module is as spoiler-free as teamTransactions.js.

import { txnDate } from './rehab-policy.js'

// ---------------------------------------------------------------------------
// Season windows — trade deadline dates carry no API field (verified against
// MLB.com/ESPN reporting; the Commissioner's Office picks a date within a
// CBA-mandated late-July/early-August window each year, no formula). This
// table is the single source of truth both the generator and the frontend
// import — adding a future season is a one-line append here.
// ---------------------------------------------------------------------------
export const SEASONS = [
  { year: 2021, deadlineDate: '2021-07-30', windowStart: '2021-07-02', windowEnd: '2021-07-31' },
  { year: 2022, deadlineDate: '2022-08-02', windowStart: '2022-07-05', windowEnd: '2022-08-03' },
  { year: 2023, deadlineDate: '2023-08-01', windowStart: '2023-07-04', windowEnd: '2023-08-02' },
  { year: 2024, deadlineDate: '2024-07-30', windowStart: '2024-07-02', windowEnd: '2024-07-31' },
  { year: 2025, deadlineDate: '2025-07-31', windowStart: '2025-07-03', windowEnd: '2025-08-01' },
  { year: 2026, deadlineDate: '2026-08-03', windowStart: '2026-07-06', windowEnd: '2026-08-04' },
]

export function seasonMeta(year) {
  return SEASONS.find((s) => s.year === Number(year)) ?? null
}

// ---------------------------------------------------------------------------
// Grouping — one story per distinct (date, description) pair, NOT connected
// components over the team-id graph (tried first; see below for why that
// failed against real data). Every statsapi trade description is already a
// complete, self-contained bilateral swap — "{ActingClub} traded {sent} to
// {OtherClub}[ for {returned}]" — verified live to be byte-identical across
// every row belonging to the same trade (a multi-player deal logs one row
// per player, all sharing that one sentence). So the description text
// itself is the correct grouping key; no synthetic group-id is needed.
//
// A connected-components approach (union same-day rows sharing a team,
// merge transitively) was tried first, on the theory that it would
// correctly fold a real 3-team trade's separately-logged legs into one
// story. Verified LIVE against the actual 2022-08-02 deadline-day feed that
// this is wrong in practice: deadline day is exactly when a team makes
// SEVERAL unrelated trades with different partners, so any hub team chains
// otherwise-unrelated deals together — one real run produced a single
// 27-team "story" merging roughly a dozen unconnected trades (e.g. the
// Twins' separate, unrelated deals with the Reds and the Orioles) purely
// because the Twins were a shared node. Grouping by description text avoids
// this entirely, at the honest cost that a genuine 3+-team trade statsapi
// happens to log as SEVERAL independent bilateral descriptions (rather than
// one combined sentence) would render as separate 2-team cards instead of
// one unified card. `buildTradeStory` supports more than two teams for
// exactly this reason, and it IS exercised by real data: the 2024-07-29
// Dodgers/White Sox/Cardinals Vargas-Kopech-Fedde-Edman blockbuster is
// logged as a single transaction record whose one `description` already
// names all three clubs' legs, semicolon-joined — confirmed live in
// public/data/trade-deadline/2024.json.
// ---------------------------------------------------------------------------

function groupByDateAndDescription(rows) {
  const groups = new Map()
  for (const t of rows ?? []) {
    const date = txnDate(t)
    const desc = t.description ?? ''
    if (!date || !desc) continue
    const key = `${date}|${desc}`
    if (!groups.has(key)) groups.set(key, { date, rows: [] })
    groups.get(key).rows.push(t)
  }
  return [...groups.values()]
}

// The non-player return types statsapi's free-form description text
// actually uses — surveyed across all six generated seasons' cutlines
// (grep every " for ..." tail, 2021-2026) rather than assumed. "Future
// Considerations" and "Other Considerations" are the same vague
// unspecified-later-value bucket under two different wordings (statsapi
// isn't internally consistent year to year); "International Bonus Pool
// Money"/"International Signing Bonus Pool Space"/"International Signing
// Bonus Cap Space" are three wordings of the same real mechanism (teams
// trading international amateur signing-bonus-pool allocation). A
// compound description often chains several of these after a period
// rather than a comma ("... for Future Considerations. International
// Bonus Pool Money."), which is why detection below scans the whole
// sent/returned half rather than stopping at the first delimiter.
const CONSIDERATION_TYPES = [
  { type: 'cash', re: /\bcash\b/i, label: 'Cash considerations' },
  { type: 'ptbnl', re: /player(s)?\s+to\s+be\s+named\s+later/i, label: 'Player to be named later' },
  { type: 'futureConsiderations', re: /\b(?:future|other)\s+considerations?\b/i, label: 'Future considerations' },
  {
    type: 'intlBonus',
    re: /international\s+(?:signing\s+)?bonus(?:\s+pool)?\s+(?:space|money|cap\s+space)/i,
    label: 'International bonus pool space',
  },
  { type: 'draftPick', re: /\bdraft\s+pick\b/i, label: 'Draft pick' },
]

// One text half (the "sent" or "returned" side of a row's description) ->
// every consideration type it names, each entry `{ type, label, detail? }`.
// `draftPick` picks up the specific pick number when the description names
// one ("... for Draft Pick. CBA Pick # 35." -> detail "CBA #35").
function detectConsiderations(text) {
  const found = []
  for (const c of CONSIDERATION_TYPES) {
    if (!c.re.test(text)) continue
    const entry = { type: c.type, label: c.label }
    if (c.type === 'draftPick') {
      const pick = text.match(/CBA\s+Pick\s*#\s*(\d+)/i)?.[1]
      if (pick) entry.detail = `CBA #${pick}`
    }
    found.push(entry)
  }
  return found
}

// Merges newly-found consideration entries into a side's running list,
// keyed by `type` so the same consideration mentioned on more than one row
// in a multi-row trade doesn't duplicate — a later entry only overwrites an
// earlier one when it adds a `detail` the earlier one lacked (e.g. a second
// row's description happens to carry the CBA pick number the first didn't).
function mergeConsiderations(list, additions) {
  for (const entry of additions) {
    const existing = list.find((e) => e.type === entry.type)
    if (!existing) list.push(entry)
    else if (entry.detail && !existing.detail) existing.detail = entry.detail
  }
}

function surnameOf(fullName) {
  const s = (fullName || '').trim()
  const i = s.indexOf(' ')
  return i === -1 ? s : s.slice(i + 1)
}

// Every statsapi trade description reads "{ActingClub} traded {sent} to
// {OtherClub}[ for {returned}]." — but in a multi-player deal, ONE shared
// description covers every player's row, and a given row's own
// fromTeam/toTeam reflects that ONE PLAYER's movement direction, not the
// description's narrative direction (verified live: Fielder's own row in
// the McCullers Jr./Gordon/cash-for-Fielder trade carries fromTeam=Brewers,
// toTeam=Astros — the reverse of "Astros traded ... to Brewers" — because
// Fielder moved Brewers-to-Astros, the RETURN leg). So the acting/other
// split must come from the text itself, not this row's own fromTeam/toTeam.
//
// The literal team name in the text is EVERYTHING BEFORE " traded " — but
// it does not always match either candidate's structured `.name` field
// exactly. Verified live, two ways this breaks an exact/startsWith match:
//   - team 133's `.name` is the bare "Athletics" (every other current club's
//     `.name` already includes its city), while the description always
//     spells it "Oakland Athletics" — a superset, not an exact match.
//   - a full rename between the trade's real date and today shares no
//     substring at all: a 2021 description reads "Cleveland Indians" (the
//     team's actual name then), but the row's `.name` field is a live join
//     against CURRENT team data — "Cleveland Guardians" (renamed Nov 2021).
//     Confirmed this silently broke direction entirely: the 2021-07-30
//     Eddie Rosario/Pablo Sandoval trade showed CASH RECEIVED on both
//     sides and sent by neither, since acting resolved to neither
//     candidate.
// A contains-check in either direction bridges the Athletics case. For a
// full rename, sharing NO substring, the fallback can't key off this row's
// own fromTeam — every row in a multi-player trade shares one description,
// but which candidate is THIS row's fromTeam varies per player (the very
// problem the text-based split exists to work around in the first place),
// so a per-row fallback resolved Cleveland correctly for Rosario's own row
// but flipped to Atlanta for Sandoval's row of that SAME trade, corrupting
// exactly one of the two sides. A city name usually survives a mascot
// rename even when the mascot doesn't (Cleveland stayed Cleveland), so the
// fallback instead picks whichever candidate shares the most whole words
// with the acting text — a signal derived purely from the shared
// description, so every row of one trade agrees on the same answer.
function sharedWordCount(a, b) {
  const wordsB = new Set((b || '').split(/\s+/).filter(Boolean))
  return (a || '').split(/\s+/).filter((w) => w && wordsB.has(w)).length
}
function actingAndOtherTeams(row) {
  const desc = row.description || ''
  const candidates = [row.fromTeam, row.toTeam].filter((t) => t?.name)
  const actingText = desc.split(' traded ')[0]
  let acting = candidates.find((t) => actingText.includes(t.name) || t.name.includes(actingText))
  if (!acting) {
    acting = candidates.reduce(
      (best, t) => (sharedWordCount(actingText, t.name) > sharedWordCount(actingText, best?.name) ? t : best),
      null,
    )
  }
  const other = candidates.find((t) => t !== acting)
  return { acting, other }
}

// Splits one row's shared description into what the acting club sent
// (before the return clause) vs. what came back in return (from it on) —
// the return clause always opens with " for ", so this needs no knowledge
// of the other club's name at all (avoiding the same name-mismatch trap
// actingAndOtherTeams works around above). No " for " at all means nothing
// came back.
function splitSentReturned(row) {
  const desc = row.description || ''
  const { acting, other } = actingAndOtherTeams(row)
  const idx = desc.search(/ for /i)
  if (idx !== -1) {
    return { acting, other, sent: desc.slice(0, idx), returned: desc.slice(idx) }
  }
  return { acting, other, sent: desc, returned: '' }
}

// A trade is sometimes logged at the AFFILIATE level, not the MLB parent
// club — verified live (2021-07-30: "Lake Elsinore Storm traded SS Jordy
// Barley to Fredericksburg Nationals," both Single-A affiliates, no MLB
// team id anywhere in the row) for a real prospect-only deal between two
// real MLB organizations. Resolving every team id up through
// `ctx.affilToOrg` (same map/convention as teamTransactions.js's
// bucketToOrg) before it becomes a story's `teamId` is what lets the page
// attribute the deal to "San Diego Padres" / "Washington Nationals" (what a
// reader expects a trade-deadline report to say) instead of showing a blank
// team card for two ids `teamFullName` has never heard of. Falls back to
// the raw id unchanged when `ctx.affilToOrg` is absent (unit tests) or the
// id is already an MLB org's own.
function resolveOrgId(rawId, ctx) {
  if (rawId == null) return null
  return ctx?.affilToOrg?.get(rawId) ?? rawId
}

// One connected group of same-day TR rows -> a trade "team" entry: what this
// team sent (its outgoing rows, i.e. rows where fromTeam.id === teamId) and
// what it received (rows where toTeam.id === teamId), plus every non-player
// consideration it sent/got in return (CONSIDERATION_TYPES — no structured
// field exists for any of these, see the module header). `teamId` here is
// already the resolved MLB org id.
function buildTeamSide(teamId, rows, ctx) {
  const sends = []
  const receives = []
  const considerationsOut = []
  const considerationsIn = []
  for (const row of rows) {
    const isSender = resolveOrgId(row.fromTeam?.id, ctx) === teamId
    const isReceiver = resolveOrgId(row.toTeam?.id, ctx) === teamId
    if (row.person?.id != null) {
      const entry = {
        playerId: row.person.id,
        name: row.person.fullName ?? '',
        surname: surnameOf(row.person.fullName),
        pos: (row.description && extractPos(row.description, row.person.fullName)) || ctx?.positions?.[row.person.id] || '',
        // Every card's teamId is the MLB parent org (resolveOrgId), so a
        // prospect who's never appeared in the majors would otherwise read
        // as "confirmed MLB" and skip Headshot's milb rung entirely — see
        // ctx.debutedIds (gen-trade-deadline.mjs's fetchPositionsAndDebuts).
        isMlb: ctx?.debutedIds?.has(row.person.id) ?? true,
      }
      if (isSender) sends.push(entry)
      if (isReceiver) receives.push(entry)
    }
    const { acting, other, sent, returned } = splitSentReturned(row)
    const sentConsiderations = detectConsiderations(sent)
    const returnedConsiderations = detectConsiderations(returned)
    // Direction follows the description's own acting/other split (the
    // narrative direction), NOT this row's fromTeam/toTeam (that's the
    // moving PLAYER's direction — see actingAndOtherTeams).
    if (resolveOrgId(acting?.id, ctx) === teamId) {
      mergeConsiderations(considerationsOut, sentConsiderations)
      mergeConsiderations(considerationsIn, returnedConsiderations)
    }
    if (resolveOrgId(other?.id, ctx) === teamId) {
      mergeConsiderations(considerationsIn, sentConsiderations)
      mergeConsiderations(considerationsOut, returnedConsiderations)
    }
  }
  return { teamId, sends, receives, considerationsOut, considerationsIn }
}

function extractPos(description, fullName) {
  if (!description || !fullName) return null
  const idx = description.indexOf(fullName)
  if (idx <= 0) return null
  const before = description.slice(0, idx).trimEnd()
  const m = before.match(/([A-Z0-9]{1,3}(?:\/[A-Z0-9]{1,3})?)$/)
  return m ? m[1] : null
}

// Every row in one pairwise leg of a trade carries the identical statsapi
// sentence (verified live) — the cutline is just the deduped set of raw
// sentences across every leg of this story, in first-seen order.
function cutlineFor(rows) {
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const desc = (row.description ?? '').trim()
    if (desc && !seen.has(desc)) {
      seen.add(desc)
      out.push(desc)
    }
  }
  return out
}

// The lowest raw transaction `id` in the group anchors this story's own id
// (same technique as teamTransactions.js's shapeStory) — guarantees
// uniqueness even in the rare case of the same team pair trading twice in
// one day (two distinct descriptions, so two groups, but a naive
// date+teamIds key alone could still collide).
function tradeIdFor(date, teamIds, rows) {
  const anchor = rows.reduce(
    (min, r) => (r.id != null && (min == null || r.id < min) ? r.id : min),
    null,
  )
  return `${date}_${[...teamIds].sort((a, b) => a - b).join('-')}_${anchor ?? 'x'}`
}

// One story per (date, description) group.
function buildTradeStory(date, rows, ctx) {
  const teamIds = [
    ...new Set(
      rows
        .flatMap((r) => [resolveOrgId(r.fromTeam?.id, ctx), resolveOrgId(r.toTeam?.id, ctx)])
        .filter((id) => id != null),
    ),
  ]
  const teams = teamIds.map((id) => buildTeamSide(id, rows, ctx))
  return {
    id: tradeIdFor(date, teamIds, rows),
    date,
    shape: teams.length >= 3 ? `${teams.length}-team` : '2-team',
    teams,
    cutline: cutlineFor(rows),
  }
}

// ---------------------------------------------------------------------------
// Split-record merge — some real trades are logged as TWO independent
// one-directional TR records instead of one shared sentence: verified live
// against 5 real pairs (2021 Kevin Kramer/Nathan Kirby, Pirates-Brewers,
// 2 days apart; 2022 Trey Mancini/Chayce McDermott, Orioles-Astros, same
// day; 2022 Jose Siri/Jayden Murray, Astros-Rays, same day; 2022 Daniel
// Vogelbach/Colin Holderman, Pirates-Mets, same day; 2024 CJ Weins/Trey
// Wingenter, Red Sox-Tigers, 2 days apart). Each half's story looks exactly
// like a genuine no-return giveaway (buildTradeStory's normal, correct
// output for what IS a complete record on its own) — the tell is a same
// SEASON pair of these "bare" stories between the same two clubs, reversed
// (whichever team gave nothing in one gave something in the other).
// ---------------------------------------------------------------------------

// Widened the match window from the observed max real gap (2 days) up to
// 14 days against a full season and the pair count never changed (still
// exactly the 5 confirmed pairs above, at every window from 3-14 days) —
// the mutual-uniqueness requirement below is already what keeps this safe,
// not the window size. 7 days is a comfortable margin over the observed
// max with no evidence it invites a false match.
const SPLIT_RECORD_WINDOW_DAYS = 7

function isEmptyGivingSide(side) {
  return side.sends.length === 0 && side.considerationsOut.length === 0
}

// A trade story is a "split half" when it's a plain 2-team story where
// EXACTLY ONE side gave nothing at all (no players, no considerations) —
// the other side, by construction, gave at least a player. Already-merged
// stories are never themselves a candidate half again.
function splitHalfShape(trade) {
  if (trade.teams.length !== 2 || trade.merged) return null
  const [a, b] = trade.teams
  const aEmpty = isEmptyGivingSide(a)
  const bEmpty = isEmptyGivingSide(b)
  if (aEmpty === bEmpty) return null
  return aEmpty ? { giver: b, emptySide: a } : { giver: a, emptySide: b }
}

function daysBetween(d1, d2) {
  return Math.abs((new Date(d1) - new Date(d2)) / 86_400_000)
}

// Unions two same-team sides from the pair's two halves into one — exactly
// one of each pair's sends/receives/considerations is ever non-empty (the
// other half's record has nothing to say about this side beyond what it
// received), so a plain concat is safe; considerations still route through
// mergeConsiderations to dedup by type the same way a single multi-row
// story already does.
function combineSide(sideA, sideB) {
  const considerationsOut = []
  const considerationsIn = []
  mergeConsiderations(considerationsOut, sideA.considerationsOut)
  mergeConsiderations(considerationsOut, sideB.considerationsOut)
  mergeConsiderations(considerationsIn, sideA.considerationsIn)
  mergeConsiderations(considerationsIn, sideB.considerationsIn)
  return {
    teamId: sideA.teamId,
    sends: [...sideA.sends, ...sideB.sends],
    receives: [...sideA.receives, ...sideB.receives],
    considerationsOut,
    considerationsIn,
  }
}

// `merged: true` marks a reconstructed story so a future pass never treats
// it as a fresh split-half candidate, and so a caller that wants to be
// transparent about it (e.g. a UI note) can key off it — see the module
// header's account of the real pairs this recovers.
function mergeSplitPair(t1, t2) {
  const teams = t1.teams.map((side) => combineSide(side, t2.teams.find((s) => s.teamId === side.teamId)))
  return {
    id: `${t1.id}+${t2.id}`,
    date: t1.date < t2.date ? t1.date : t2.date,
    shape: '2-team',
    teams,
    cutline: [...t1.cutline, ...t2.cutline],
    merged: true,
  }
}

// Folds a season's split-record trades back into single stories. Only
// merges a pair when EACH side has EXACTLY ONE reversed-direction,
// same-team-pair candidate within SPLIT_RECORD_WINDOW_DAYS, and that
// candidate's own unique candidate points back — an ambiguous match (two-
// or-more candidates on either side) is left unmerged rather than guessed
// at. This is deliberately the same "under-merge over over-merge" call the
// connected-components grouping attempt got wrong (see this module's
// grouping-strategy comment above, which merged roughly a dozen unconnected
// deadline-day trades into one 27-team story) — a missed merge here just
// leaves two honest, individually-correct one-sided cards instead of one
// combined card; a wrong merge would fabricate a trade that didn't happen.
function mergeSplitRecordPairs(stories) {
  const halves = stories.map((trade) => ({ trade, half: splitHalfShape(trade) })).filter((x) => x.half)

  const candidatesOf = new Map() // trade.id -> matching halves[]
  for (const x of halves) {
    const matches = halves.filter(
      (y) =>
        y !== x &&
        x.half.giver.teamId === y.half.emptySide.teamId &&
        x.half.emptySide.teamId === y.half.giver.teamId &&
        daysBetween(x.trade.date, y.trade.date) <= SPLIT_RECORD_WINDOW_DAYS,
    )
    candidatesOf.set(x.trade.id, matches)
  }

  const consumed = new Set()
  const merged = []
  for (const x of halves) {
    if (consumed.has(x.trade.id)) continue
    const candidates = candidatesOf.get(x.trade.id)
    if (candidates.length !== 1) continue
    const y = candidates[0]
    const backCandidates = candidatesOf.get(y.trade.id)
    if (backCandidates.length !== 1 || backCandidates[0].trade.id !== x.trade.id) continue
    consumed.add(x.trade.id)
    consumed.add(y.trade.id)
    merged.push(mergeSplitPair(x.trade, y.trade))
  }

  if (!merged.length) return stories
  const untouched = stories.filter((t) => !consumed.has(t.id))
  return [...untouched, ...merged].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Deduped TR rows (already run through teamTransactions.js's
// dedupeTransactions) -> an array of trade stories for one season, newest
// day first. `ctx.positions` is the generator's batched /people fallback;
// `ctx.affilToOrg` (a Map<affiliateTeamId, orgId>) resolves an
// affiliate-level trade row up to its MLB parent club — see resolveOrgId;
// `ctx.debutedIds` (a Set<playerId>) flags which players have appeared in
// an MLB game, threaded onto each player entry as `isMlb` for Headshot's
// fallback-chain choice.
export function groupTradeStories(dedupedTrRows, ctx = {}) {
  const groups = groupByDateAndDescription((dedupedTrRows ?? []).filter((t) => t.typeCode === 'TR'))
  groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const stories = groups.map(({ date, rows }) => buildTradeStory(date, rows, ctx))
  return mergeSplitRecordPairs(stories)
}

// ---------------------------------------------------------------------------
// Player stat-line formatting — pure, testable string builders consumed by
// scripts/gen-trade-deadline.mjs's stats decoration pass (fetching + the
// MLB-vs-MiLB/role decision live there, since they need live API data; only
// the string formatting is pure enough to share + unit-test here). A draft
// round reads as an ordinal ("1st Round Pick") to match how the deadline
// page's other prose reads; a signing gets the ordinal-eligible-country
// check below to distinguish a domestic undrafted free agent from an
// international signee, since neither carries a structured flag of its own.
// ---------------------------------------------------------------------------

// byDateRange emits duplicate rows for an ordinary single-team stint, and a
// mid-stint team change adds a synthetic, team-less roll-up row equal to the
// sum of the real per-team rows — summing every row as-is double- or triple-
// counts games/stats (verified live: person.js's aggregateSplits carries the
// same two rules for the player page's own byDateRange reads, `person.js:183-207`).
// This is the raw-splits-preserving counterpart: aggregateSplits collapses
// straight to one formatted stat object, but the trade-deadline stat line
// needs to keep summing raw fields (plateAppearances, battersFaced) that
// aggregateSplits doesn't carry, and to combine several MiLB LEVELS' worth of
// already-deduped splits afterward — so this returns the deduped splits list,
// not a final stat object.
function statSig(s) {
  const stat = s.stat ?? {}
  return [stat.atBats, stat.hits, stat.inningsPitched, stat.strikeOuts, stat.gamesPlayed].join('|')
}
export function dedupeStatSplits(splits) {
  const rows = splits ?? []
  const hasTeamRow = rows.some((s) => s.team?.id)
  const withoutRollup = hasTeamRow ? rows.filter((s) => s.team?.id || !(Number(s.numTeams) > 1)) : rows
  const seen = new Set()
  return withoutRollup.filter((s) => {
    const sig = statSig(s)
    if (seen.has(sig)) return false
    seen.add(sig)
    return true
  })
}

function ordinalRound(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num <= 0) return String(n ?? '')
  const mod100 = num % 100
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`
  switch (num % 10) {
    case 1:
      return `${num}st`
    case 2:
      return `${num}nd`
    case 3:
      return `${num}rd`
    default:
      return `${num}th`
  }
}

// The amateur draft has only ever covered the US, Canada, and Puerto Rico —
// a signee born anywhere else reads as an international signing rather than
// a plain domestic "Signed {year}".
const DRAFT_ELIGIBLE_COUNTRIES = new Set(['USA', 'Canada', 'Puerto Rico'])

// How a MiLB player entered pro ball — drafted (with round/pick when known),
// signed, or (unknown birth country/no signing record found) omitted
// entirely rather than guessed at.
export function buildEntryLine({ draft, signedYear, birthCountry }) {
  if (draft?.year && draft?.round) {
    const pick = draft.overall ? `, #${draft.overall}` : ''
    return `${draft.year} ${ordinalRound(draft.round)} Round Pick${pick}`
  }
  if (draft?.year) return String(draft.year)
  if (signedYear) {
    const international = Boolean(birthCountry) && !DRAFT_ELIGIBLE_COUNTRIES.has(birthCountry)
    return international ? `International signee, ${signedYear}` : `Signed ${signedYear}`
  }
  return null
}

// "{total} G (X G at Level, Y G at Level, …)" in MILB_LEVELS' low-to-high
// order, dropping any level with zero games; a single level skips the
// parenthetical (nothing to break out). `levelGames` is `[{ label, games }]`.
export function buildLevelGamesLine(levelGames) {
  const present = (levelGames ?? []).filter((l) => (l.games ?? 0) > 0)
  if (!present.length) return null
  const total = present.reduce((sum, l) => sum + l.games, 0)
  if (present.length === 1) return `${total} G at ${present[0].label}`
  return `${total} G (${present.map((l) => `${l.games} G at ${l.label}`).join(', ')})`
}

// ".302" style: three decimals, no leading zero (baseball convention) — same
// shape as person.js's own (unexported) rate3.
function avg3(x) {
  return Number.isFinite(x) ? x.toFixed(3).replace(/^0(?=\.)/, '') : '.000'
}

function pct(n, d) {
  return d > 0 ? Math.round((100 * n) / d) : 0
}

// One hitter's line-to-date: ".288 AVG, 34 HR, 78 RBI, 33% SO%, 15% BB%" —
// same categories whether the hitter is MLB or MiLB. `strikeOuts`/
// `baseOnBalls`/`plateAppearances` come straight off a summed hitting stat
// (sumHitting in statsLevels.js already computes `avg`).
export function formatHittingLine({ avg, homeRuns, rbi, strikeOuts, baseOnBalls, plateAppearances }) {
  const soPct = pct(strikeOuts, plateAppearances)
  const bbPct = pct(baseOnBalls, plateAppearances)
  return `${avg3(avg)} AVG, ${homeRuns ?? 0} HR, ${rbi ?? 0} RBI, ${soPct}% SO%, ${bbPct}% BB%`
}

// One pitcher's line-to-date, role-gated: a starter's record is meaningful
// (W-L), a reliever's mostly isn't (dropped), a closer's save count is the
// headline number instead. `battersFaced` is summed by the caller alongside
// sumPitching's own totals (sumPitching doesn't track it). `role` is
// person.js's pitcherRole() output: 'SP' | 'RP' | 'CL' | null (treated as RP).
export function formatPitchingLine(role, { era, wins, losses, saves, inningsPitched, strikeOuts, baseOnBalls, battersFaced }) {
  const kPct = pct(strikeOuts, battersFaced)
  const bbPct = pct(baseOnBalls, battersFaced)
  const parts = [`${Number.isFinite(era) ? era.toFixed(2) : '0.00'} ERA`]
  if (role === 'SP') parts.push(`${wins ?? 0}-${losses ?? 0}`)
  if (role === 'CL') parts.push(`${saves ?? 0} SV`)
  parts.push(`${inningsPitched ?? '0.0'} IP`, `${kPct}% SO%`, `${bbPct}% BB%`)
  return parts.join(', ')
}

// ---------------------------------------------------------------------------
// Reader — static, per-season files (mirrors team-transactions.js's own
// reader half). Degrades to null on a confirmed historical 404 so the page
// can show a friendly empty state rather than an error.
// ---------------------------------------------------------------------------

const fileCache = new Map()

async function loadJson(path) {
  if (fileCache.has(path)) return fileCache.get(path)
  const promise = Promise.resolve()
    .then(async () => {
      const res = await fetch(path)
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`${path} ${res.status}`)
      }
      return await res.json()
    })
    .catch((error) => {
      if (fileCache.get(path) === promise) fileCache.delete(path)
      throw error
    })
  fileCache.set(path, promise)
  return promise
}

export function loadTradeDeadlineSeason(year) {
  return loadJson(`/data/trade-deadline/${year}.json`)
}
