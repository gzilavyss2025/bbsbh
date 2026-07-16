// Pure shapers for the Team Transactions card's data pipeline: de-dupe the raw
// statsapi transaction feed, drop noise, pair same-day moves into "stories",
// and build the cutline prose — plus the reader half that loads the static,
// season-chunked files scripts/gen-team-transactions.mjs precomputes from
// these same functions (the gen-callouts.mjs "import the app's own shaper so
// the two can't drift" convention). Full design:
// .scratch/team-transactions/data-layer-scope.md.
//
// Spoiler note: roster moves and their dates carry no score, so nothing here
// is reveal-only — this module is as spoiler-free as rehab.js/rookies.js.

import { txnDate } from './rehab-policy.js'

// ---------------------------------------------------------------------------
// §2 De-dupe
// ---------------------------------------------------------------------------
//
// Verified live against the real feed (2026-07-15, the Brewers' 2026-06-24 to
// 07-15 window): a transaction's `id` is reliably PRESENT, but NOT reliably
// STABLE across duplicate/re-logged rows of the very same move — the Logan
// Henderson rehab assignment that logged 3× on 2026-06-28 carries three
// DIFFERENT ids, as does Coleman Crow's 2× rehab row and Carlos Rodriguez's
// 2× rehab row. An `id`-first signature (`id != null ? id : composite`) would
// therefore fail to collapse exactly the byte-identical-repeat case it's
// meant to catch. The composite signature (date/typeCode/personId/fromId/
// toId/description) collapses all three real cases correctly and — since the
// two-perspective trade mirror (same id, but swapped fromTeam/toTeam and a
// missing `person` on one copy) has a DIFFERENT composite on each side by
// construction — never over-collapses a genuine trade, leaving that case for
// Pass B below exactly as designed. So Pass A keys on the composite alone.
function compositeSig(t, date) {
  return [
    'c',
    date,
    t.typeCode,
    t.person?.id ?? '',
    t.fromTeam?.id ?? '',
    t.toTeam?.id ?? '',
    t.description ?? '',
  ].join('|')
}

// How "full" a row is — used to pick the one survivor per personId in Pass B.
// A row naming the person, with both clubs, and the longer description wins.
function fullness(t) {
  let score = 0
  if (t.person) score += 2
  if (t.fromTeam && t.toTeam) score += 1
  score += Math.min((t.description ?? '').length, 900) / 1000
  return score
}

function clubPairKey(t) {
  return [String(t.fromTeam?.id ?? ''), String(t.toTeam?.id ?? '')].sort().join('|')
}

// Two passes over one org's raw transaction rows (see §2 of the scope doc):
// Pass A collapses byte-identical repeats; Pass B collapses a trade's
// two-team-perspective mirror (same date/typeCode/clubPair, keeping one row
// per distinct real personId and dropping any person-less row once at least
// one named row exists in the group).
export function dedupeTransactions(rows) {
  const seen = new Set()
  const passA = []
  for (const t of rows ?? []) {
    const date = txnDate(t)
    const sig = compositeSig(t, date)
    if (seen.has(sig)) continue
    seen.add(sig)
    passA.push(t)
  }

  const groups = new Map()
  for (const t of passA) {
    const key = [txnDate(t), t.typeCode, clubPairKey(t)].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }

  const result = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }
    const byPerson = new Map()
    let anyNamed = false
    for (const t of group) {
      const pid = t.person?.id
      if (pid == null) continue
      anyNamed = true
      const existing = byPerson.get(pid)
      if (!existing || fullness(t) > fullness(existing)) byPerson.set(pid, t)
    }
    if (anyNamed) {
      result.push(...byPerson.values())
    } else {
      // Step 4: the whole group is person-less — keep one rather than none.
      result.push(group[0])
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// §4 Noise filter
// ---------------------------------------------------------------------------

// Mirrors person.js's isIlPlacementTxn/isIlEndingTxn keyword logic, split into
// THREE disjoint categories (placement / activation / IL-to-IL transfer)
// rather than person.js's two — the story grouper needs to tell a transfer
// apart from a fresh placement, which person.js's own player-timeline use case
// never had to. Deliberately a small, self-contained copy rather than an
// export added to person.js (this pass doesn't touch person.js — same
// convention as gen-rehab.mjs mirroring detectRehabAssignment).
function isIlTransferTxn(t) {
  return (
    t.typeCode === 'SC' &&
    /transferred/i.test(t.description || '') &&
    /injured list/i.test(t.description || '')
  )
}
function isIlPlacementTxn(t) {
  return (
    t.typeCode === 'SC' &&
    /placed/i.test(t.description || '') &&
    /injured list/i.test(t.description || '') &&
    !isIlTransferTxn(t)
  )
}
function isIlEndingTxn(t) {
  return (
    t.typeCode === 'SC' &&
    /activat/i.test(t.description || '') &&
    /injured list/i.test(t.description || '') &&
    !/all-stars? activated/i.test(t.description || '')
  )
}

// The typeCode whitelist (§4 bullet 1). ASG is deliberately absent — every ASG
// row (a real rehab assignment OR a plain affiliate-to-affiliate promotion)
// touches only the minors, never the MLB club's active/40-man roster, so none
// of them are a team-transactions story; bullet 2's specific callout of rehab
// ASGs is the motivating case, not a second filter on top of this whitelist.
const STORY_WORTHY_CODES = new Set([
  'TR', 'SFA', 'SGN', 'IFA', 'SE', 'CU', 'OPT', 'OUT', 'DES', 'REL', 'URL',
  'CLW', 'PUR', 'WA', 'RET', 'SU',
])

// `ctx.orgId`, when given, requires a row to touch the MLB club DIRECTLY
// (fromTeam.id or toTeam.id === orgId), not merely an affiliate bucketToOrg
// mapped up to this org. Verified against the live feed: a release or
// suspension can be logged entirely at a single affiliate (e.g. "Wilson
// Warbirds released RHP Melvin Hernandez," toTeam the Single-A club, no
// fromTeam, never touching the MLB roster at all) — REL/SU/SFA/SGN/IFA are
// NOT inherently MLB-anchored the way a trade or a call-up/option is (those
// always name the MLB club on one side, confirmed against the live feed —
// see the module header). Rather than special-case which codes can leak,
// every row must clear this gate.
// A signing (SFA/SGN/IFA) is the one whitelisted family with no other signal
// separating a real roster move from anonymous org-filler — a mass minor-
// league-camp signing spree reads identically to a notable NRI in the raw
// feed, and (unlike REL/SU) it legitimately carries the MLB club as `toTeam`
// even when the player is purely organizational depth. `ctx.debutedIds`, when
// given (a Set of personIds who've appeared in an MLB game — see
// gen-team-transactions.mjs), is the 80/20 proxy: a signing is suppressed
// unless its personId is IN the set — a genuinely undebuted signee and a
// personId this generator run simply couldn't resolve land the same way
// (suppressed), since there's no way to tell those two apart from a plain Set.
const SIGNING_CODE_SET = new Set(['SFA', 'SGN', 'IFA'])
function isUndebutedSigning(t, debutedIds) {
  if (!debutedIds || !SIGNING_CODE_SET.has(t.typeCode)) return false
  const pid = t.person?.id
  return pid != null && !debutedIds.has(pid)
}

export function filterStoryworthy(rows, ctx = {}) {
  return (rows ?? []).filter((t) => {
    if (ctx.orgId != null && t.fromTeam?.id !== ctx.orgId && t.toTeam?.id !== ctx.orgId) return false
    if (isUndebutedSigning(t, ctx.debutedIds)) return false
    if (t.typeCode === 'SC') {
      return isIlPlacementTxn(t) || isIlEndingTxn(t) || isIlTransferTxn(t)
    }
    return STORY_WORTHY_CODES.has(t.typeCode)
  })
}

// Keep a row only if it touches this org's own MLB club or one of its
// affiliates (§4 bullet 3) — drops a pure affiliate-to-affiliate lateral that
// never involves the parent org. Runs BEFORE dedupe/filter in the generator
// (a league-wide fetch has to be bucketed to one org first — see §5).
export function bucketToOrg(rows, orgId, affilToOrg) {
  const ownsTeam = (id) => id != null && (id === orgId || affilToOrg?.get(id) === orgId)
  return (rows ?? []).filter((t) => ownsTeam(t.fromTeam?.id) || ownsTeam(t.toTeam?.id))
}

// ---------------------------------------------------------------------------
// Shared helpers: position resolution, name/label formatting, prose stitching
// ---------------------------------------------------------------------------

// Position: parse the "{POS} {Name}" token out of the row's own description
// first (every observed description embeds it verbatim right before the
// verb), falling back to the batched /people lookup (ctx.positions) the
// generator supplies — cheap, and avoids a per-player fetch.
function extractPosFromDescription(description, fullName) {
  if (!description || !fullName) return null
  const idx = description.indexOf(fullName)
  if (idx <= 0) return null
  const before = description.slice(0, idx).trimEnd()
  const m = before.match(/([A-Z0-9]{1,3}(?:\/[A-Z0-9]{1,3})?)$/)
  return m ? m[1] : null
}
function resolvePosition(row, ctx) {
  const fromDesc = extractPosFromDescription(row.description, row.person?.fullName)
  if (fromDesc) return fromDesc
  const pid = row.person?.id
  return (pid != null && ctx?.positions?.[pid]) || ''
}
function nameFor(row) {
  return row.person?.fullName || ''
}
// A plain "{POS} " prefix for the custom trade/injured-list leads below,
// which build their opening clause from scratch rather than searching an
// existing raw clause — the position stays in the sentence (e.g. "Acquired
// RHP Easton McGee…"), just as a plain segment ahead of the player's name,
// which is the only part that gets linked/emphasized.
function posPrefix(pos) {
  return pos ? `${pos} ` : ''
}
// First-space split, same convention as person.js's splitDisplayName (a small
// mirrored copy, not an import — see the module header).
function surnameOf(fullName) {
  const s = (fullName || '').trim()
  const i = s.indexOf(' ')
  return i === -1 ? s : s.slice(i + 1)
}
// Every statsapi transaction description reads "{ActingClub} {verb}…" (or, for
// a trade, "{OtherClub} traded … to {ThisClub}"), so stripping whichever club
// name actually leads the string yields a clause that already reads correctly
// mid-sentence (verb lowercase, e.g. "optioned RHP Craig Yoho to Nashville
// Sounds.") with no per-typeCode template needed. Falls back to the raw text
// when no candidate name matches (e.g. a suspension row, which carries no
// leading club name at all).
function stripLeadingClub(description, names) {
  const desc = description || ''
  for (const name of names) {
    if (name && desc.startsWith(`${name} `)) return desc.slice(name.length + 1)
  }
  return desc
}
function upperFirst(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}
function lowerFirst(s) {
  return s ? s[0].toLowerCase() + s.slice(1) : s
}
function stripPeriod(s) {
  return s.trim().replace(/\.$/, '')
}
// The raw feed's own clause for one row, capitalized for sentence-initial use
// (team name stripped, trailing period kept as-is).
function soloText(row) {
  return upperFirst(stripLeadingClub(row.description, [row.fromTeam?.name, row.toTeam?.name]))
}

// Wraps the substring of `text` matching a player's name in an emphasis
// segment, splitting the surrounding text into plain segments either side —
// the cutline segment shape the component renders as an all-caps, bold,
// linked player name plus plain surrounding prose.
function emphasizeClause(text, label, emphasis, playerId) {
  if (!label) return [{ text }]
  const idx = text.indexOf(label)
  if (idx === -1) return [{ text }]
  const segs = []
  if (idx > 0) segs.push({ text: text.slice(0, idx) })
  segs.push({ text: label, emphasis, playerId })
  const rest = text.slice(idx + label.length)
  if (rest) segs.push({ text: rest })
  return segs
}
// A bare label as its own single emphasized segment — used for the custom
// "Acquired {label} from the …" / "Placed {label} on the …" leads, where the
// label isn't being located inside pre-existing text.
function emphasizeLabel(label, emphasis, playerId) {
  return [{ text: label, emphasis, playerId }]
}

// The second sentence of an IL placement's own description, if any — "Right
// shoulder inflammation." — the feed's own injury note, not invented flavor.
function ilReason(description) {
  const parts = (description || '')
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts[1] : null
}

// ---------------------------------------------------------------------------
// §3 Story grouping
// ---------------------------------------------------------------------------

// Direction per row (§3): `in` gains a body, `out` loses one, `transfer` is
// neutral (no active-roster body), null (SU, or a TR with no orgId context)
// doesn't participate in pairing at all.
const SIGNING_CODES = new Set(['SFA', 'SGN', 'IFA'])
const IN_CODES = new Set(['CU', 'SE', 'CLW', 'PUR', ...SIGNING_CODES])
const OUT_CODES = new Set(['OPT', 'DES', 'OUT', 'REL', 'URL', 'WA', 'RET'])
function rowDirection(t, orgId) {
  const code = t.typeCode
  if (code === 'TR') {
    if (orgId != null && t.toTeam?.id === orgId) return 'in'
    if (orgId != null && t.fromTeam?.id === orgId) return 'out'
    return null
  }
  if (IN_CODES.has(code)) return 'in'
  if (OUT_CODES.has(code)) return 'out'
  if (code === 'SC') {
    if (isIlTransferTxn(t)) return 'transfer'
    if (isIlPlacementTxn(t)) return 'out'
    if (isIlEndingTxn(t)) return 'in'
    return null
  }
  return null
}

function pickPreferred(pool, codes) {
  for (const code of codes) {
    const found = pool.find((c) => c.row.typeCode === code)
    if (found) return found
  }
  return null
}

// One day's kept rows -> ordered stories, per the §3 priority order (each
// step consumes the rows it uses, so nothing is double-counted).
function buildDayStories(dayRows, ctx) {
  const pool = dayRows.slice()
  const remove = (rows) => {
    for (const r of rows) {
      const i = pool.indexOf(r)
      if (i !== -1) pool.splice(i, 1)
    }
  }
  const remaining = () => pool.map((t) => ({ row: t, dir: rowDirection(t, ctx.orgId) }))

  const drafts = []

  // Step 0: suspensions never pair with anything (no in/out/transfer
  // direction of their own) — matching person.js's treatment of SU as its own
  // move, retained as a rare solo story (§4).
  const suspensions = pool.filter((t) => t.typeCode === 'SU')
  for (const t of suspensions) {
    drafts.push({ storyType: 'suspension', rows: [{ row: t, role: 'out' }] })
  }
  remove(suspensions)

  // Step 1: same-player double-move (Crow case) — group by personId, emit one
  // story when a person has both an in AND an out row today.
  const byPerson = new Map()
  for (const c of remaining()) {
    const pid = c.row.person?.id
    if (pid == null) continue
    if (!byPerson.has(pid)) byPerson.set(pid, [])
    byPerson.get(pid).push(c)
  }
  for (const group of byPerson.values()) {
    const inRow = group.find((c) => c.dir === 'in')
    const outRow = group.find((c) => c.dir === 'out')
    if (inRow && outRow) {
      drafts.push({
        storyType: 'roster-move',
        subtype: 'double',
        rows: [{ row: inRow.row, role: 'in' }, { row: outRow.row, role: 'out' }],
      })
      remove([inRow.row, outRow.row])
    }
  }

  // Step 2: trades — every TR row on the day sharing the same (unordered)
  // club pair is ONE trade, however many players are on either side (a real
  // 2-for-1 stays one story, not three) — grouped by the same clubPairKey the
  // dedupe pass already uses. A net add pulls ONE clearing move, tagged
  // role:'clear' (not 'out') so the cutline can tell "a player we actually
  // traded away" from "an unrelated roster spot we cleared to make room".
  const tradeRows = remaining().filter((c) => c.row.typeCode === 'TR')
  const tradeGroups = new Map()
  for (const c of tradeRows) {
    const key = clubPairKey(c.row)
    if (!tradeGroups.has(key)) tradeGroups.set(key, [])
    tradeGroups.get(key).push(c)
  }
  for (const group of tradeGroups.values()) {
    const storyRows = group.map((c) => ({ row: c.row, role: c.dir === 'out' ? 'out' : 'in' }))
    remove(group.map((c) => c.row))
    if (group.some((c) => c.dir === 'in')) {
      const pick = pickPreferred(remaining().filter((c) => c.dir === 'out'), ['DES', 'OUT', 'REL'])
      if (pick) {
        storyRows.push({ row: pick.row, role: 'clear' })
        remove([pick.row])
      }
    }
    drafts.push({ storyType: 'trade', rows: storyRows })
  }

  // Step 3: IL placements — each seeds a story; pulls ONE replacement.
  const placements = remaining().filter((c) => isIlPlacementTxn(c.row))
  for (const pl of placements) {
    const storyRows = [{ row: pl.row, role: 'out' }]
    remove([pl.row])
    const pick = pickPreferred(remaining().filter((c) => c.dir === 'in'), ['SE', 'CU'])
    if (pick) {
      storyRows.push({ row: pick.row, role: 'in' })
      remove([pick.row])
    }
    drafts.push({ storyType: 'injured-list', rows: storyRows })
  }

  // Step 4: leftover churn — cluster into ONE shuffle when ≥2 remain with both
  // an add and a subtract; otherwise each leftover is its own solo story.
  // Signings DO participate here (e.g. a same-day option clearing a spot for
  // an unrelated signing reads as one shuffle) — a signing that ends up alone
  // still resolves as its own "signing" story rather than a generic
  // "roster-move," it just isn't excluded from clustering up front.
  const churn = remaining().filter((c) => c.dir === 'in' || c.dir === 'out')
  const hasAdd = churn.some((c) => c.dir === 'in')
  const hasSubtract = churn.some((c) => c.dir === 'out')
  if (churn.length >= 2 && hasAdd && hasSubtract) {
    drafts.push({
      storyType: 'shuffle',
      rows: churn.map((c) => ({ row: c.row, role: c.dir })),
    })
    remove(churn.map((c) => c.row))
  } else {
    for (const c of churn) {
      const isSigning = SIGNING_CODES.has(c.row.typeCode)
      drafts.push({
        storyType: isSigning ? 'signing' : 'roster-move',
        subtype: isSigning ? undefined : 'solo',
        rows: [{ row: c.row, role: c.dir }],
      })
      remove([c.row])
    }
  }

  // Step 5: leftover transfers — their own story, never folded into a
  // neighbor's cutline. Still shows a rail slot (the destination IL length as
  // its banner) — a rail-less transfer read as if the player had no photo on
  // file at all, which wasn't the intent.
  const transfers = remaining().filter((c) => c.dir === 'transfer')
  for (const t of transfers) {
    drafts.push({
      storyType: 'roster-move',
      subtype: 'transfer',
      rows: [{ row: t.row, role: 'transfer' }],
    })
    remove([t.row])
  }

  // Within-day significance order: trade -> injured-list -> shuffle/roster-
  // move -> signing -> suspension. (Ties within a bucket keep discovery
  // order, which is already the raw feed's own id-ascending order.)
  const TYPE_ORDER = { trade: 0, 'injured-list': 1, shuffle: 2, 'roster-move': 2, signing: 3, suspension: 4 }
  const ordered = drafts
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (TYPE_ORDER[a.d.storyType] - TYPE_ORDER[b.d.storyType]) || (a.i - b.i))
    .map(({ d }) => d)

  return ordered.map((draft) => shapeStory(draft, ctx))
}

const TYPE_LABELS = {
  trade: 'Trade',
  shuffle: 'Roster shuffle',
  'roster-move': 'Roster move',
  'injured-list': 'Injured list',
  signing: 'Signing',
  suspension: 'Suspension',
}

// The destination day-count for an IL placement OR an IL-to-IL transfer —
// takes the LAST "{N}-day injured list" mention in the description, which is
// the only one on a placement row ("placed … on the 10-day injured list")
// and the destination on a transfer row ("from the 15-day … to the 60-day
// injured list").
function ilBanner(row) {
  const matches = [...(row.description || '').matchAll(/(\d+)-day injured list/gi)]
  const days = matches[matches.length - 1]?.[1]
  return days ? `IL-${days}` : 'IL'
}
function bannerFor(storyType, role, row) {
  if (storyType === 'trade') return role === 'in' ? 'In' : 'Out'
  if (storyType === 'signing') return 'In'
  if (storyType === 'suspension') return 'Out'
  if (storyType === 'injured-list') return role === 'out' ? ilBanner(row) : 'Up'
  if (role === 'transfer') return ilBanner(row)
  return role === 'in' ? 'Up' : 'Down'
}

function railSlot(row, role, banner, ctx) {
  return {
    role,
    banner,
    playerId: row.person?.id ?? null,
    name: row.person?.fullName ?? '',
    surname: surnameOf(row.person?.fullName ?? ''),
    pos: resolvePosition(row, ctx),
    tintTeamId: ctx.orgId,
  }
}

function buildRail(draft, ctx) {
  if (draft.storyType === 'roster-move' && draft.subtype === 'transfer') {
    const row = draft.rows[0].row
    return [railSlot(row, 'move', ilBanner(row), ctx)]
  }
  if (draft.storyType === 'roster-move' && draft.subtype === 'double') {
    // The IL activation is transactional bookkeeping for the option that
    // follows (see cutlineDouble) — the banner reads "Down" like any other
    // option, not a neutral "Up/Down".
    const row = draft.rows.find((r) => r.role === 'out').row
    return [railSlot(row, 'out', 'Down', ctx)]
  }
  // A trade's pulled 'clear' row (see step 2) renders identically to a real
  // traded-away player in the rail — the distinction only matters to the
  // cutline, which reads draft.rows directly.
  const slots = draft.rows.map(({ row, role }) =>
    railSlot(row, role === 'clear' ? 'out' : role, bannerFor(draft.storyType, role, row), ctx),
  )
  const railOrder = { in: 0, out: 1 }
  return slots.sort((a, b) => (railOrder[a.role] ?? 0) - (railOrder[b.role] ?? 0))
}

// ---------------------------------------------------------------------------
// buildCutline — the segment-array prose for one story draft (also exported
// standalone so the cutline logic unit-tests without re-deriving a whole
// day's grouping).
// ---------------------------------------------------------------------------

// {pos, name, playerId} for each row, joined into one clause ("RHP X, LHP Y
// and OF Z") — a trade can involve more than one player per side, unlike
// every other story type's single-player clauses.
function playersClause(players, emphasis) {
  const segs = []
  players.forEach(({ pos, name, playerId }, i) => {
    if (i > 0) segs.push({ text: i === players.length - 1 ? ' and ' : ', ' })
    segs.push({ text: posPrefix(pos) })
    segs.push({ text: name, emphasis, playerId })
  })
  return segs
}
// A trade's own "for {return}" tail (cash, a PTBNL, …) — only when it's NOT
// simply restating one of the very players this clause already names. A
// multi-player trade's raw description is written from the OTHER team's
// perspective ("… to Milwaukee Brewers for OF Jadyn Fielder"), so Fielder's
// own outgoing row would otherwise self-reference: "Traded OF Jadyn Fielder
// … for OF Jadyn Fielder."
function returnDetailFor(row, ownNames) {
  const detail = (row.description || '').match(/\bfor\s+(.+?)\.?$/i)?.[1]
  if (!detail) return null
  if (ownNames.some((n) => detail.includes(n))) return null
  return stripPeriod(detail)
}

// A trade story: every TR row sharing the same day + club pair (§3 step 2),
// however many players are on either side — a real 2-for-1 reads as one
// story, not three. `role: 'clear'` (the pulled 40-man-clearing move, if
// any) is a separate trailing clause, never folded into the "for" list.
function cutlineTrade(story, ctx) {
  const inPlayers = story.rows
    .filter((r) => r.role === 'in')
    .map((r) => ({ pos: resolvePosition(r.row, ctx), name: nameFor(r.row), playerId: r.row.person?.id, row: r.row }))
  const outPlayers = story.rows
    .filter((r) => r.role === 'out')
    .map((r) => ({ pos: resolvePosition(r.row, ctx), name: nameFor(r.row), playerId: r.row.person?.id, row: r.row }))
  const clearRow = story.rows.find((r) => r.role === 'clear')?.row

  const segs = []
  if (inPlayers.length) {
    const otherTeam = inPlayers[0].row.fromTeam?.name || ''
    segs.push({ text: 'Acquired ' })
    segs.push(...playersClause(inPlayers, 'primary'))
    segs.push({ text: ` from the ${otherTeam}` })
    if (outPlayers.length) {
      segs.push({ text: ' for ' })
      segs.push(...playersClause(outPlayers, 'secondary'))
    } else {
      const detail = returnDetailFor(inPlayers[0].row, inPlayers.map((p) => p.name))
      if (detail) segs.push({ text: ` for ${detail}` })
    }
  } else {
    const otherTeam = outPlayers[0].row.toTeam?.name || ''
    segs.push({ text: 'Traded ' })
    segs.push(...playersClause(outPlayers, 'primary'))
    segs.push({ text: ` to the ${otherTeam}` })
    const detail = returnDetailFor(outPlayers[0].row, outPlayers.map((p) => p.name))
    if (detail) segs.push({ text: ` for ${detail}` })
  }
  if (clearRow) {
    const cName = nameFor(clearRow)
    const cClause = stripPeriod(lowerFirst(
      stripLeadingClub(clearRow.description, [clearRow.fromTeam?.name, clearRow.toTeam?.name]),
    ))
    segs.push({ text: '; ' })
    segs.push(...emphasizeClause(cClause, cName, 'secondary', clearRow.person?.id))
  }
  segs.push({ text: '.' })
  return segs
}

function cutlineInjuredList(story, ctx) {
  const placed = story.rows.find((r) => r.role === 'out')
  const replacement = story.rows.find((r) => r.role === 'in')
  const row = placed.row
  const name = nameFor(row)
  const pos = resolvePosition(row, ctx)
  const days = (row.description || '').match(/(\d+)-day injured list/i)?.[1]
  const reason = ilReason(row.description)
  const segs = [
    { text: 'Placed ' + posPrefix(pos) },
    ...emphasizeLabel(name, 'primary', row.person?.id),
    { text: days ? ` on the ${days}-day injured list` : ' on the injured list' },
  ]
  if (reason) segs.push({ text: ` (${lowerFirst(stripPeriod(reason))})` })
  if (replacement) {
    const rName = nameFor(replacement.row)
    const rClause = stripPeriod(lowerFirst(
      stripLeadingClub(replacement.row.description, [replacement.row.fromTeam?.name, replacement.row.toTeam?.name]),
    ))
    segs.push({ text: '; ' })
    segs.push(...emphasizeClause(rClause, rName, 'secondary', replacement.row.person?.id))
  }
  segs.push({ text: '.' })
  return segs
}

// Same-player double-move (the Crow case): the IL activation is purely
// transactional bookkeeping to clear the way for the option that follows it
// the same day — the option is the real news (see bannerFor's role: 'out'
// treatment below). Leads with the option, names the player ONCE, and folds
// the activation in as a trailing parenthetical rather than repeating his
// name in a second clause.
function cutlineDouble(story) {
  const inRow = story.rows.find((r) => r.role === 'in').row
  const outRow = story.rows.find((r) => r.role === 'out').row
  const name = nameFor(outRow)
  const outClause = stripPeriod(soloText(outRow))
  const fromFragment = (inRow.description || '').match(/\bfrom the .*?injured list\b/i)?.[0]
  const segs = [...emphasizeClause(outClause, name, 'primary', outRow.person?.id)]
  if (fromFragment) segs.push({ text: ` (activated ${fromFragment} first)` })
  segs.push({ text: '.' })
  return segs
}

function cutlineShuffle(story) {
  const ordered = [
    ...story.rows.filter((r) => r.role === 'in'),
    ...story.rows.filter((r) => r.role === 'out'),
  ]
  const segs = []
  ordered.forEach((r, i) => {
    if (i > 0) segs.push({ text: '; ' })
    const name = nameFor(r.row)
    const raw = stripLeadingClub(r.row.description, [r.row.fromTeam?.name, r.row.toTeam?.name])
    const clause = stripPeriod(i === 0 ? upperFirst(raw) : lowerFirst(raw))
    segs.push(...emphasizeClause(clause, name, r.role === 'in' ? 'primary' : 'secondary', r.row.person?.id))
  })
  segs.push({ text: '.' })
  return segs
}

function cutlineSingle(story, ctx, emphasis) {
  const { row } = story.rows[0]
  const name = nameFor(row)
  return emphasizeClause(soloText(row), name, emphasis, row.person?.id)
}

// Every distinct club named on any row in the story (a trade partner, an
// affiliate a player was optioned to/recalled from, …), longest name first
// so a shorter name that happens to be another's substring never wins the
// match first (no real case today, just a defensive ordering).
function teamCandidatesFor(story) {
  const seen = new Map()
  for (const r of story.rows) {
    for (const t of [r.row.fromTeam, r.row.toTeam]) {
      if (t?.id != null && t?.name && !seen.has(t.id)) seen.set(t.id, t)
    }
  }
  return [...seen.values()].sort((a, b) => b.name.length - a.name.length)
}

// Wraps any occurrence of a candidate team's name in plain (not-yet-linked)
// segments with a teamId — a single post-processing pass over the whole
// cutline rather than threading team-link logic through every clause
// builder above, since a club name can turn up in custom-built leads
// ("from the {team}") just as easily as inside a raw feed clause ("...to
// Nashville Sounds."). Segments already carrying a playerId are left alone.
function linkifyTeamsInSegments(segments, teams) {
  let result = segments
  for (const team of teams) {
    const next = []
    for (const seg of result) {
      if (seg.playerId || seg.teamId) {
        next.push(seg)
        continue
      }
      const idx = seg.text.indexOf(team.name)
      if (idx === -1) {
        next.push(seg)
        continue
      }
      if (idx > 0) next.push({ text: seg.text.slice(0, idx) })
      next.push({ text: team.name, teamId: team.id })
      const rest = seg.text.slice(idx + team.name.length)
      if (rest) next.push({ text: rest })
    }
    result = next
  }
  return result
}

// One story draft -> its cutline segment array. Exported standalone (per the
// data-layer scope's reader shape) so cutline prose unit-tests independently
// of the day-grouping walk above.
export function buildCutline(story, ctx = {}) {
  let segs
  switch (story.storyType) {
    case 'trade':
      segs = cutlineTrade(story, ctx)
      break
    case 'injured-list':
      segs = cutlineInjuredList(story, ctx)
      break
    case 'shuffle':
      segs = cutlineShuffle(story)
      break
    case 'roster-move':
      segs = story.subtype === 'double'
        ? cutlineDouble(story)
        : cutlineSingle(story, ctx, story.rows[0].role === 'in' ? 'primary' : undefined)
      break
    case 'signing':
    case 'suspension':
      segs = cutlineSingle(story, ctx, 'primary')
      break
    default:
      segs = []
  }
  return linkifyTeamsInSegments(segs, teamCandidatesFor(story))
}

function shapeStory(draft, ctx) {
  const date = txnDate(draft.rows[0].row)
  const anchor = draft.rows.reduce(
    (min, r) => (r.row.id != null && (min == null || r.row.id < min) ? r.row.id : min),
    null,
  )
  return {
    id: `${ctx.orgId}-${date}-${draft.storyType}-${anchor ?? 'x'}`,
    type: draft.storyType,
    typeLabel: TYPE_LABELS[draft.storyType],
    rail: buildRail(draft, ctx),
    cutline: buildCutline(draft, ctx),
  }
}

// One org's already-bucketed, deduped, filtered rows -> [{ date, stories }],
// newest day first. `ctx.positions` is the generator's batched /people
// fallback; `ctx.orgId` is required (drives trade in/out + headshot tint).
export function groupIntoStories(rows, ctx = {}) {
  const byDate = new Map()
  for (const t of rows ?? []) {
    const date = txnDate(t)
    if (!date) continue
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(t)
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  return dates.map((date) => ({ date, stories: buildDayStories(byDate.get(date), ctx) }))
}

// ---------------------------------------------------------------------------
// §5 Reader — static, season-chunked files; lazy 45-day pagination
// ---------------------------------------------------------------------------

const PAGE_DAYS = 45
const seasonCache = new Map()

// Fetches one season's file, session-caching successful reads and confirmed
// 404s for completed seasons. Current-season 404s, server failures, malformed
// JSON, and network errors are evicted and rethrown so the caller can keep a
// retry affordance visible. A confirmed historical 404 alone resolves null.
async function loadSeasonFile(season) {
  if (seasonCache.has(season)) return seasonCache.get(season)
  const promise = Promise.resolve()
    .then(async () => {
      const res = await fetch(`/data/team-transactions/${season}.json`)
      if (!res.ok) {
        if (res.status === 404 && season < currentYear()) return null
        throw new Error(`team transactions ${res.status}`)
      }
      return await res.json()
    })
    .catch((error) => {
      // Only evict if this is still the active request for the season; a
      // future retry may already have installed its own promise.
      if (seasonCache.get(season) === promise) seasonCache.delete(season)
      throw error
    })
  seasonCache.set(season, promise)
  return promise
}

function currentYear() {
  return new Date().getUTCFullYear()
}

// Stateful pager: first call (cursor null) returns the most recent PAGE_DAYS
// of a team's days from the CURRENT season's file only; each subsequent call
// pages further back, crossing into the prior season's file only once the
// newer one is exhausted. `cutoff` trims to the Team Page's `asOf` (temporal
// hygiene, not spoiler defense — see the scope doc). Returns
// { days, cursor, hasMore } — hasMore is false only once a season file
// genuinely 404s (no earlier history for this team).
export async function loadMoreTeamTransactions(teamId, cursor, cutoff) {
  let season = cursor?.season ?? currentYear()
  let index = cursor?.index ?? 0
  const collected = []

  while (collected.length < PAGE_DAYS) {
    const file = await loadSeasonFile(season)
    if (!file) return { days: collected, cursor: { season, index }, hasMore: false }
    const allDays = (file.byTeamId?.[teamId]?.days ?? []).filter((d) => !cutoff || d.date <= cutoff)
    if (index >= allDays.length) {
      season -= 1
      index = 0
      continue
    }
    const take = Math.min(PAGE_DAYS - collected.length, allDays.length - index)
    collected.push(...allDays.slice(index, index + take))
    index += take
  }
  return { days: collected, cursor: { season, index }, hasMore: true }
}
