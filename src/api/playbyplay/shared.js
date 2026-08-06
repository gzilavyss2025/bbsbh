// Small private helpers shared across the playbyplay/ modules — name
// resolution/linkification and the base-name lookup table used by both
// computeHalfInningFeed (halfInningFeed.js) and the "first X in game" finders
// (firsts.js). See ../playbyplay.js's header for the module's overall
// spoiler footing. Split (ADR-0038, check-file-size.mjs) out of
// src/api/playbyplay.js — see that barrel file for the full picture.

import { personNameParts, startingPositionAbbr } from '../select.js'

const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3, '4B': 4, score: 4 }

// `positionEntering`: his fielding position as of entering the half this card
// belongs to (see computeHalfInningFeed's own defenseEntering call), when
// known. Falls back to his own boxscore starting position (startingPositionAbbr)
// for a player defenseEntering has no fielding assignment for yet — a fresh
// pinch-hitter's own at-bat card, before he's ever taken the field, or a
// pitcher (defenseEntering excludes 'P', which has its own table). Using
// `positionEntering` rather than a flat game-wide constant matters both ways:
// it must not show a not-yet-revealed FUTURE switch (confirmed against gamePk
// 823035's José Fermín, LF->3B->2B — his early cards must read LF, not his
// eventual 2B), and it must not get STUCK on his original entry role once a
// switch HAS already been revealed elsewhere on the same page (confirmed
// against gamePk 823035's Jackson Chourio, a pinch-hitter who becomes the
// left fielder — his cards from the half after that switch is revealed must
// read LF, not his one-time-only 'PH' entry role, which a flat
// startingPositionAbbr(box) read would otherwise show forever).
function resolveBatter(feed, side, id, positionEntering) {
  const person = feed?.gameData?.players?.[`ID${id}`] ?? {}
  const box = feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`] ?? {}
  return {
    id,
    fullName: (person.fullName ?? '').trim(),
    ...personNameParts(person),
    pos: positionEntering ?? startingPositionAbbr(box),
  }
}

// Strips the batter's own name off the front of an MLB description sentence
// (they're already named on the card) — descriptions are templated and
// consistently lead with the exact full name, except for a replay-challenge
// prefix ("Rockies challenged (play at 1st), call on the field was upheld:
// Tyler Soderstrom singles...", verified against gamePk 778442), where the
// name sits after a "...: " clause instead of at the very start. Handle that
// case too — the challenge language stays visible, only the duplicated name
// is removed — and fall back to the untrimmed sentence rather than mangling
// it if neither pattern matches.
function trimLeadingName(description, fullName) {
  if (!description) return ''
  if (!fullName) return description
  if (description.startsWith(fullName)) {
    const rest = description.slice(fullName.length).trim()
    if (rest) return rest.charAt(0).toUpperCase() + rest.slice(1)
  }
  const marker = `: ${fullName}`
  const at = description.indexOf(marker)
  if (at !== -1) {
    const before = description.slice(0, at + 1)
    const after = description.slice(at + marker.length).trim()
    if (after) return `${before} ${after}`
  }
  return description
}

// Every player in the game, name → id, longest name first so a longer name
// wins over a shorter one it contains. Used to find player references inside
// the templated prose descriptions / substitution notes.
function buildNameIndex(feed) {
  return Object.values(feed?.gameData?.players ?? {})
    .map((p) => ({ name: (p.fullName ?? '').trim(), id: p.id }))
    .filter((p) => p.name && p.id)
    .sort((a, b) => b.name.length - a.name.length)
}

// Split a prose string into segments, tagging the spans that are player names
// with their id: [{ text }, { text, id }, …]. Non-overlapping, earliest match
// wins. Lets the card render those spans as uppercase / a deep link while the
// surrounding words stay plain.
function linkifyNames(text, index) {
  if (!text) return [{ text: '' }]
  const hits = []
  for (const { name, id } of index) {
    let from = 0
    let at
    while ((at = text.indexOf(name, from)) !== -1) {
      hits.push({ start: at, end: at + name.length, id })
      from = at + name.length
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end)
  const segments = []
  let pos = 0
  for (const h of hits) {
    if (h.start < pos) continue // overlaps an already-taken span
    if (h.start > pos) segments.push({ text: text.slice(pos, h.start) })
    segments.push({ text: text.slice(h.start, h.end), id: h.id })
    pos = h.end
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) })
  return segments
}

export { BASE_NUM, resolveBatter, trimLeadingName, buildNameIndex, linkifyNames }
