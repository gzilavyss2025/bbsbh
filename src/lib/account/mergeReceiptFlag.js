// The one-shot flag behind the post-sign-in merge receipt (PRD §5.3), shared
// by the full card on /profile (components/profile/MergeReceipt.jsx) and the
// slate's one-line pointer (components/account/MergeReceiptStrip.jsx). Both
// render from the SAME flag on purpose — they are two renderings of one fact,
// not two prompts, so dismissing either one dismisses both.
//
// Extracted out of MergeReceipt.jsx (which held these as private functions
// until MergeReceiptStrip needed the identical key). Not unit-tested: like
// useScoresUnlocked.js/useStamps.js, this touches `window.localStorage`
// directly rather than taking a storage argument, so it is verified in the
// browser (e2e) rather than under node:test, which has no `window` at all.

const KEY_PREFIX = 'bbsbh:mergeReceipt:'

// No identity, nothing to show — the safe default while Clerk is still
// resolving, or for a signed-out visitor.
export function hasSeenMergeReceipt(userId) {
  if (!userId) return true
  try {
    return Boolean(window.localStorage.getItem(KEY_PREFIX + userId))
  } catch {
    // Storage unreadable — show it, at worst once per visit. The failure a
    // one-shot flag protects against is nagging, not a spoiler.
    return false
  }
}

export function markMergeReceiptSeen(userId) {
  if (!userId) return
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, String(Date.now()))
  } catch {
    // Private mode. The caller's own in-session state still keeps the
    // dismissal from reversing itself for the rest of this visit.
  }
}
