// The PROSE half of the Team Transactions pipeline: a story draft in,
// the cutline's segment array out — plus the label and clause helpers the
// rail half needs too. Split out of teamTransactions.js (ADR-0038) once that
// file passed its size budget a second time.
//
// The seam is the same kind the vocabulary split used. Everything here turns
// rows into words. Nothing here decides which rows belong in a story — that
// stays in teamTransactions.js, which imports this. So a change to what the
// card SAYS lands in one file, and a change to what it GROUPS lands in
// another.
//
// A segment is `{ text, emphasis?, playerId?, teamId? }`. The component
// renders an emphasized segment as an all-caps, bold, linked player name and
// a teamId segment as a club link; everything else is plain prose.
//
// Spoiler note: roster moves and their dates carry no score, so nothing here
// is reveal-only — as spoiler-free as its parent module.

import {
  OUTSIDE_ARRIVAL_CODES,
  isIlEndingTxn,
  isNonIlListEnding,
} from './vocabulary.js'

// ---------------------------------------------------------------------------
// Labels: position, name, and the small string tools the clauses share
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
export function resolvePosition(row, ctx) {
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
export function surnameOf(fullName) {
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
// Same as lowerFirst, but leaves a leading position abbreviation intact — a
// clause whose club name couldn't be stripped (no leading club at all, e.g.
// a DFA/suspension row: "RHP Albert Suárez elected free agency.") starts
// with the position token, not an ordinary word, so blindly lowering the
// first character would mangle "RHP" into "rHP".
function lowerFirstClause(s) {
  return /^[A-Z0-9]{1,3}(?:\/[A-Z0-9]{1,3})?\s/.test(s || '') ? s : lowerFirst(s)
}
function stripPeriod(s) {
  return s.trim().replace(/\.$/, '')
}

// Removes a player's own "{POS} {Name}" label from a clause, wherever it
// sits — what turns "designated RHP Lance McCullers Jr. for assignment" into
// "designated for assignment" so a story that already named him can trail
// this clause after a semicolon without saying his name twice.
//
// Falls back to the untouched text when the name isn't found, which is a real
// case rather than a defensive one: a row's own `person.fullName` and the name
// embedded in ITS description sometimes disagree on accents (verified live —
// "José Azócar" against a description reading "Azocar"). The caller runs
// lowerFirstClause afterwards, which leaves the surviving position token
// alone.
function stripPlayerLabel(text, fullName) {
  const idx = fullName ? text.indexOf(fullName) : -1
  if (idx === -1) return text
  const before = text.slice(0, idx).replace(/[A-Z0-9]{1,3}(?:\/[A-Z0-9]{1,3})?\s$/, '')
  return `${before}${text.slice(idx + fullName.length)}`
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .trim()
}

// The row's OWN club names — the only ones already implied by the page/story
// context and therefore safe to elide from the front of its raw sentence.
// Before the MiLB-level wire (#847) `ctx.orgId` always equalled whichever
// club led these two-sided descriptions, because a call-up/option/selection
// row is always authored from the ACTIVE-roster (MLB) side
// (docs/transactions-wire.md) and a story could only be owned by that same
// MLB club. A MiLB-level story can now be owned by the AFFILIATE side of that
// same row instead — the wire's sentence still opens with the MLB parent, who
// isn't a member of that level's own thirty clubs — so eliding "whichever
// name leads" started eliding the one club actually doing something, leaving
// a sentence like "Recalled LHP X from Salt Lake Bees." with no subject and
// only the LOSING club named. Eliding only the owner's own name leaves the
// other club's name in the sentence whenever it isn't otherwise implied.
function ownClubNames(row, ctx) {
  const names = []
  if (row.fromTeam?.id === ctx.orgId && row.fromTeam?.name) names.push(row.fromTeam.name)
  if (row.toTeam?.id === ctx.orgId && row.toTeam?.name) names.push(row.toTeam.name)
  return names
}
// Whether `stripLeadingClub` would actually elide one of `names` off this
// row's description — the same startsWith check it runs internally, computed
// separately because the caller needs to know BEFORE deciding whether the
// remainder should be re-cased with lowerFirstClause. An unelided clause
// still opens with its own capitalized subject (a club name, never a common
// word), so lowering its first letter would turn "Los Angeles Angels…" into
// "los Angeles Angels…".
function leadsWithOwnClub(row, ctx) {
  const desc = row.description || ''
  return ownClubNames(row, ctx).some((name) => desc.startsWith(`${name} `))
}

// One row's clause, acting club stripped, lower-case lead — for the caller to
// capitalize or trail after a semicolon. A waiver claim is the one description
// no stripping fixes for both sides: it is written from the CLAIMING club's
// ("Athletics claimed LHP Drew Rom off waivers from Milwaukee Brewers"), so
// stripping "Athletics " on the Brewers' card leaves it saying the Brewers
// claimed him. The losing side gets a rebuilt lead, as cutlineTrade does.
//
// The league-wide feed never reaches that branch: it hands every claim to the
// club that made it (transactions/league.js), which is the side the wire's
// own sentence is already written from.
function rowClause(row, ctx = {}) {
  if (row.typeCode === 'CLW' && ctx.orgId != null && row.fromTeam?.id === ctx.orgId) {
    const player = `${posPrefix(resolvePosition(row, ctx))}${nameFor(row)}`
    const claimant = row.toTeam?.name ? ` to the ${row.toTeam.name}` : ''
    return `lost ${player}${claimant} on a waiver claim.`
  }
  const clause = stripLeadingClub(row.description, ownClubNames(row, ctx))
  // `OBT` is the one code the wire writes in the PRESENT tense — "St. Louis
  // Cardinals obtain RHP Durbin Feltman from Kansas City Monarchs" — against
  // the past tense every other row and every clause here uses. Both OBT rows
  // in a 60-day live window read "obtain", so this is the wording, not a
  // one-off typo. Repaired here rather than in the vocabulary module: it is a
  // prose fix, and nothing about the row's MEANING changes.
  return row.typeCode === 'OBT' ? clause.replace(/^obtain\b/i, 'obtained') : clause
}

// The same clause capitalized for sentence-initial use (trailing period kept).
function soloText(row, ctx) {
  return upperFirst(rowClause(row, ctx))
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
//
// Splits on the FIRST SENTENCE'S OWN END ("injured list.") rather than on
// every ". " in the description — a naive split breaks on any abbreviation
// period in the leading club's own name ("St. Louis Cardinals", "St. Paul
// Saints", "St. Lucie Mets" — three affiliates spread across three levels),
// which reads "St." as sentence one and turns the club's own remaining name
// into a fabricated "reason": "(louis Cardinals placed RHP Some Guy on the
// 15-day injured list)" instead of the real injury note, or nothing at all.
function ilReason(description) {
  const reason = (description || '').match(/injured list\.\s*(.+)/i)?.[1]?.trim()
  return reason || null
}

// ---------------------------------------------------------------------------
// The cutline builders, one per story type
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

// A trade story: every TR row sharing the same day + club pair (§3 step 3),
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
    const cRaw = stripLeadingClub(clearRow.description, ownClubNames(clearRow, ctx))
    const cClause = stripPeriod(leadsWithOwnClub(clearRow, ctx) ? lowerFirstClause(cRaw) : cRaw)
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
    const rRaw = stripLeadingClub(replacement.row.description, ownClubNames(replacement.row, ctx))
    const rClause = stripPeriod(leadsWithOwnClub(replacement.row, ctx) ? lowerFirstClause(rRaw) : rRaw)
    segs.push({ text: '; ' })
    segs.push(...emphasizeClause(rClause, rName, 'secondary', replacement.row.person?.id))
  }
  segs.push({ text: '.' })
  return segs
}

// An activation's own "from the {list}" fragment, or null when this row is not
// an activation at all. An activation that shares a day with a real move is
// nearly always the bookkeeping that made the move possible — the club had to
// take him off the injured list before it could option him — so it folds into
// a parenthetical rather than taking a clause of its own. The test is the
// vocabulary's own, not a bare regex, so a paternity or bereavement return
// reads the same way an injured-list return does.
function activationFragment(row) {
  if (!isIlEndingTxn(row) && !isNonIlListEnding(row)) return null
  return (row.description || '').match(/\bfrom the .*? list\b/i)?.[0] ?? null
}

// One player, one day, more than one row — the shape behind three subtypes:
//
//   'double'     an arrival and a departure (claimed, then optioned)
//   'departure'  two departures (designated, then released)
//   'arrival'    two arrivals (acquired, then signed)
//
// All three read the same way and for the same reason: the story leads with
// the row that changed the most, and every other row trails as a clause with
// this player's own label stripped out of it, so his name appears once. The
// grouper has already sorted `rows` lead-first (see its NEWS_RANK).
//
// Two rows can carry the same words — the wire filed Lou Trivino III's free
// agency election twice on 2026-08-05, under two ids and two different clubs,
// which no de-duplication rule can see. An identical clause is written once.
function cutlineSamePlayer(story, ctx) {
  const [lead, ...rest] = story.rows
  const leadClause = stripPeriod(soloText(lead.row, ctx))
  const segs = [...emphasizeClause(leadClause, nameFor(lead.row), 'primary', lead.row.person?.id)]
  const written = new Set([leadClause])
  for (const { row } of rest) {
    const fragment = activationFragment(row)
    const stripped = stripLeadingClub(row.description, ownClubNames(row, ctx))
    const labeled = stripPlayerLabel(stripped, nameFor(row))
    const clause = fragment
      ? `(activated ${fragment} first)`
      : stripPeriod(leadsWithOwnClub(row, ctx) ? lowerFirstClause(labeled) : labeled)
    if (!clause || written.has(clause)) continue
    written.add(clause)
    segs.push({ text: fragment ? ` ${clause}` : `; ${clause}` })
  }
  segs.push({ text: '.' })
  return segs
}

function cutlineShuffle(story, ctx) {
  const ordered = [
    ...story.rows.filter((r) => r.role === 'in'),
    ...story.rows.filter((r) => r.role === 'out'),
  ]
  const segs = []
  ordered.forEach((r, i) => {
    if (i > 0) segs.push({ text: '; ' })
    const name = nameFor(r.row)
    const raw = rowClause(r.row, ctx)
    // A club-elided clause opens with a lower-case verb and needs re-casing
    // for its position (sentence-initial vs. trailing a semicolon); one that
    // kept its own subject (leadsWithOwnClub false) is already a complete,
    // correctly-capitalized clause either way.
    const clause = stripPeriod(
      !leadsWithOwnClub(r.row, ctx) ? raw : i === 0 ? upperFirst(raw) : lowerFirstClause(raw),
    )
    segs.push(...emphasizeClause(clause, name, r.role === 'in' ? 'primary' : 'secondary', r.row.person?.id))
  })
  segs.push({ text: '.' })
  return segs
}

function cutlineSingle(story, ctx, emphasis) {
  const { row } = story.rows[0]
  const name = nameFor(row)
  return emphasizeClause(soloText(row, ctx), name, emphasis, row.person?.id)
}

// Every distinct club named on any row in the story (a trade partner, an
// affiliate a player was optioned to/recalled from, …), longest name first
// so a shorter name that happens to be another's substring never wins the
// match first (no real case today, just a defensive ordering).
//
// An ACQ-family row's `fromTeam` is the one club here that is NOT in
// affiliated ball — the Southern Maryland Blue Crabs, the Kansas City
// Monarchs. It carries a real statsapi id and a real name, so it would
// linkify exactly like a trade partner and lead to a team page this app
// cannot build. The typeCode is what says so: these codes MEAN "from outside
// affiliated ball," so the exclusion needs no roster of independent leagues.
function teamCandidatesFor(story) {
  const seen = new Map()
  for (const r of story.rows) {
    const outsideArrival = OUTSIDE_ARRIVAL_CODES.has(r.row.typeCode)
    for (const t of [outsideArrival ? null : r.row.fromTeam, r.row.toTeam]) {
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
// of the day-grouping walk in teamTransactions.js.
export function buildCutline(story, ctx = {}) {
  const samePlayer = story.subtype === 'double'
    || story.subtype === 'departure'
    || story.subtype === 'arrival'
  let segs
  switch (story.storyType) {
    case 'trade':
      segs = cutlineTrade(story, ctx)
      break
    case 'injured-list':
      segs = cutlineInjuredList(story, ctx)
      break
    case 'shuffle':
      segs = cutlineShuffle(story, ctx)
      break
    case 'roster-move':
      segs = samePlayer
        ? cutlineSamePlayer(story, ctx)
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
