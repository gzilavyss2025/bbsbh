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
    jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
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

// Who a plate appearance is CHARGED to, which is not always who finished it.
// `matchup.batter` names the man in the box when the play ended, but a batter
// replaced mid-count can still own the result: a substitute who completes a
// strikeout the original batter already had two strikes on is scored against
// the ORIGINAL batter (Rule 9.15(b); every other ending is charged to the
// substitute). MLB reports that split by leaving `matchup.batter` on the
// substitute while `result.description` and the boxscore line both name the
// man who left.
//
// So when this play announces a pinch-hitter and its own description leads
// with the man he replaced, the description is the feed saying whose plate
// appearance it is. Verified against gamePk 816170's top 1 (Jett Williams
// takes an injury delay at 2-2, Eduardo Garcia finishes the at-bat, and both
// "Jett Williams strikes out on a foul tip." and Williams' own boxscore line,
// 0-1 | K, charge it to Williams), plus gamePk 816859's top 5 and gamePk
// 816035's bottom 3 — the only three of eleven mid-at-bat batter substitutions
// in an 854-game sweep whose description named the replaced man, and all three
// strikeouts, exactly as the rule predicts. The other eight ended some other
// way, are charged to the substitute, and are unaffected: this returns
// `fallbackId` (the caller's `matchup.batter` id) unless it finds the shape
// above, so an ordinary plate appearance never takes this path.
//
// The card is what moves; the bookkeeping does not. `runners[]` on such a play
// still keys on the man who FINISHED it, so callers keep looking his leg up by
// `matchup.batter` — safe because the rule fires on strikeouts only, where the
// batter is out and has no trip to track.
function creditedBatterId(feed, play, fallbackId) {
  const desc = play?.result?.description ?? ''
  if (!desc) return fallbackId
  for (const e of play?.playEvents ?? []) {
    if (e?.details?.eventType !== 'offensive_substitution') continue
    // A pinch RUNNER replaces a man already aboard, never the man at the
    // plate, so he can never be the one this plate appearance is charged to.
    if (e?.position?.abbreviation === 'PR') continue
    const replacedId = e?.replacedPlayer?.id
    if (replacedId == null || replacedId === fallbackId) continue
    const name = (feed?.gameData?.players?.[`ID${replacedId}`]?.fullName ?? '').trim()
    if (name && desc.startsWith(name)) return replacedId
  }
  return fallbackId
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

export { BASE_NUM, resolveBatter, creditedBatterId, trimLeadingName, buildNameIndex, linkifyNames }
