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

// `ctx.orgId`, when given, gates the IL branch to placements/activations/
// transfers happening AT the MLB club directly (`toTeam.id === orgId`) —
// otherwise a MiLB affiliate's OWN internal IL move (e.g. "Nashville Sounds
// placed SS X on the 7-day injured list", `toTeam` the affiliate, never the
// MLB club) rides in on bucketToOrg's affiliate mapping and reads as this
// org's news, even though the player's never touched the MLB roster. Every
// other whitelisted code (CU/OPT/SE/TR/…) is inherently anchored to the MLB
// club by its own definition, so this gate is scoped to the SC/IL branch only.
export function filterStoryworthy(rows, ctx = {}) {
  return (rows ?? []).filter((t) => {
    if (t.typeCode === 'SC') {
      if (ctx.orgId != null && t.toTeam?.id !== ctx.orgId) return false
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
// "Houston Astros" -> "Astros" — last word of the full team name.
function teamNickname(name) {
  const n = (name || '').trim()
  return n ? n.split(/\s+/).slice(-1)[0] : ''
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

  // Step 2: trades — each TR seeds a story; a net add pulls ONE clearing move.
  const trades = remaining().filter((c) => c.row.typeCode === 'TR')
  for (const tr of trades) {
    const storyRows = [{ row: tr.row, role: tr.dir === 'out' ? 'out' : 'in' }]
    remove([tr.row])
    if (tr.dir === 'in') {
      const pick = pickPreferred(remaining().filter((c) => c.dir === 'out'), ['DES', 'OUT', 'REL'])
      if (pick) {
        storyRows.push({ row: pick.row, role: 'out' })
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
  // an add and a subtract; otherwise each leftover is its own solo roster-move.
  // Signings never participate here (see step 5): a free-agent signing has no
  // 40-man-clearing corollary in the way a recall/option pair does, so it
  // always resolves as its own "signing" story regardless of same-day churn.
  const churn = remaining().filter(
    (c) => (c.dir === 'in' || c.dir === 'out') && !SIGNING_CODES.has(c.row.typeCode),
  )
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
      drafts.push({ storyType: 'roster-move', subtype: 'solo', rows: [{ row: c.row, role: c.dir }] })
      remove([c.row])
    }
  }

  // Step 5: signings with no corollary.
  const signings = remaining().filter((c) => SIGNING_CODES.has(c.row.typeCode))
  for (const s of signings) {
    drafts.push({ storyType: 'signing', rows: [{ row: s.row, role: 'in' }] })
    remove([s.row])
  }

  // Step 6: leftover transfers — their own rail-less story, never folded in.
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

function ilBanner(row) {
  const days = (row.description || '').match(/(\d+)-day injured list/i)?.[1]
  return days ? `IL-${days}` : 'IL'
}
function bannerFor(storyType, role, row) {
  if (storyType === 'trade') return role === 'in' ? 'In' : 'Out'
  if (storyType === 'signing') return 'In'
  if (storyType === 'suspension') return 'Out'
  if (storyType === 'injured-list') return role === 'out' ? ilBanner(row) : 'Up'
  return role === 'in' ? 'Up' : 'Down'
}

function buildRail(draft, ctx) {
  if (draft.storyType === 'roster-move' && draft.subtype === 'transfer') return []
  if (draft.storyType === 'roster-move' && draft.subtype === 'double') {
    const row = draft.rows[0].row
    return [{
      role: 'move',
      banner: 'Up/Down',
      playerId: row.person?.id ?? null,
      name: row.person?.fullName ?? '',
      surname: surnameOf(row.person?.fullName ?? ''),
      pos: resolvePosition(row, ctx),
      tintTeamId: ctx.orgId,
    }]
  }
  const slots = draft.rows.map(({ row, role }) => ({
    role,
    banner: bannerFor(draft.storyType, role, row),
    playerId: row.person?.id ?? null,
    name: row.person?.fullName ?? '',
    surname: surnameOf(row.person?.fullName ?? ''),
    pos: resolvePosition(row, ctx),
    tintTeamId: ctx.orgId,
  }))
  const railOrder = { in: 0, out: 1 }
  return slots.sort((a, b) => (railOrder[a.role] ?? 0) - (railOrder[b.role] ?? 0))
}

// ---------------------------------------------------------------------------
// buildCutline — the segment-array prose for one story draft (also exported
// standalone so the cutline logic unit-tests without re-deriving a whole
// day's grouping).
// ---------------------------------------------------------------------------

function cutlineTrade(story, ctx) {
  const primary = story.rows[0]
  const secondary = story.rows[1]
  const row = primary.row
  const name = nameFor(row)
  const pos = resolvePosition(row, ctx)
  const otherTeam = primary.role === 'in' ? row.fromTeam : row.toTeam
  const nick = teamNickname(otherTeam?.name || '')
  const returnDetail = (row.description || '').match(/\bfor\s+(.+?)\.?$/i)?.[1]
  const lead = (primary.role === 'in' ? 'Acquired ' : 'Traded ') + posPrefix(pos)
  const mid = primary.role === 'in' ? ` from the ${nick}` : ` to the ${nick}`
  const segs = [{ text: lead }, ...emphasizeLabel(name, 'primary', row.person?.id), { text: mid }]
  if (returnDetail) segs.push({ text: ` for ${stripPeriod(returnDetail)}` })
  if (secondary) {
    const sName = nameFor(secondary.row)
    const sClause = stripPeriod(lowerFirst(
      stripLeadingClub(secondary.row.description, [secondary.row.fromTeam?.name, secondary.row.toTeam?.name]),
    ))
    segs.push({ text: '; ' })
    segs.push(...emphasizeClause(sClause, sName, 'secondary', secondary.row.person?.id))
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

function cutlineDouble(story) {
  const inRow = story.rows.find((r) => r.role === 'in').row
  const outRow = story.rows.find((r) => r.role === 'out').row
  const name = nameFor(inRow)
  const inClause = stripPeriod(soloText(inRow))
  const outClause = stripPeriod(lowerFirst(
    stripLeadingClub(outRow.description, [outRow.fromTeam?.name, outRow.toTeam?.name]),
  ))
  return [
    ...emphasizeClause(inClause, name, 'primary', inRow.person?.id),
    { text: '; ' },
    ...emphasizeClause(outClause, name, 'secondary', outRow.person?.id),
    { text: '.' },
  ]
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

// One story draft -> its cutline segment array. Exported standalone (per the
// data-layer scope's reader shape) so cutline prose unit-tests independently
// of the day-grouping walk above.
export function buildCutline(story, ctx = {}) {
  switch (story.storyType) {
    case 'trade':
      return cutlineTrade(story, ctx)
    case 'injured-list':
      return cutlineInjuredList(story, ctx)
    case 'shuffle':
      return cutlineShuffle(story, ctx)
    case 'roster-move':
      if (story.subtype === 'double') return cutlineDouble(story, ctx)
      return cutlineSingle(story, ctx, story.rows[0].role === 'in' ? 'primary' : undefined)
    case 'signing':
    case 'suspension':
      return cutlineSingle(story, ctx, 'primary')
    default:
      return []
  }
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

// Fetches one season's file, session-cached (success AND a 404/error both
// cache — a season that doesn't exist for this team never changes that
// answer, same lifecycle as rehab.js). Degrades to null rather than throwing.
async function loadSeasonFile(season) {
  if (seasonCache.has(season)) return seasonCache.get(season)
  const promise = (async () => {
    try {
      const res = await fetch(`/data/team-transactions/${season}.json`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  })()
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
