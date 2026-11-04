// The one-shot flag behind the post-sign-in merge receipt (PRD §5.3), shared
// by the full card on /profile (components/profile/MergeReceipt.jsx) and the
// slate's one-line pointer (components/account/MergeReceiptStrip.jsx). Both
// render from the SAME flag on purpose — they are two renderings of one fact,
// not two prompts, so dismissing either one dismisses both.
//
// Extracted out of MergeReceipt.jsx (which held these as private functions
// until MergeReceiptStrip needed the identical key). Not unit-tested: like
// useStamps.js, this touches `window.localStorage`
// directly rather than taking a storage argument, so it is verified in the
// browser (e2e) rather than under node:test, which has no `window` at all.

import { localStore } from './localStore.js'

// Storage unreadable reads as "not seen" — show it, at worst once per visit. The
// failure a one-shot flag protects against is nagging, not a spoiler. A failed
// write is dropped; the caller's own in-session state keeps the dismissal.
const flag = (userId) =>
  localStore(`bbsbh:mergeReceipt:${userId}`, Boolean, () => String(Date.now()))

// No identity, nothing to show — the safe default while Clerk is still
// resolving, or for a signed-out visitor.
export function hasSeenMergeReceipt(userId) {
  return !userId || flag(userId).read()
}

export function markMergeReceiptSeen(userId) {
  if (userId) flag(userId).write(true)
}

// The card's lines, as a pure rule — the other half of the receipt both
// renderings share, and the half that is easy to get wrong.
//
// PRD §5.3: "If a channel is `unavailable`, its line is omitted rather than
// shown as zero. A zero is a claim; an omission is not." That has a sharper
// consequence than it looks. Every count here is read from LOCAL storage, so a
// line drawn without checking its channel is not merely imprecise — it asserts
// that a merge happened on a deployment where nothing was ever uploaded.
//
// Phase 5 found exactly that: the `games` line was ungated, so a signed-in user
// on a store-less deploy (the supported 501 degrade, PRD §1.3) got the headline
// "Your book is on this account now." while the scope badge two blocks above
// correctly said sync was unavailable — and dismissing it burned the one-shot
// flag, so the REAL receipt could never appear once the store came up.
//
// So: every line is gated on its own channel having actually reached `synced`.
// `status` must be the NORMALIZED store (see normalizeSilentChannels).
export function mergeReceiptLines({ status, counts, clubName }) {
  const lines = []
  const reached = (channel) => status?.[channel]?.phase === 'synced'
  const n = (count, one, many) => `${count} ${count === 1 ? one : many}`

  if (reached('stamps') && counts?.stamps > 0) {
    lines.push({ id: 'stamps', text: n(counts.stamps, 'stamp', 'stamps') })
  }
  if (reached('reveal') && counts?.games > 0) {
    lines.push({ id: 'games', text: `${n(counts.games, 'game', 'games')} in progress` })
  }
  if (reached('prefs') && clubName) lines.push({ id: 'club', text: clubName })
  return lines
}
