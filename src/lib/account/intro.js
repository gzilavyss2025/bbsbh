// The first-visit intro's own one-time flag (PRD §6.1).
//
// Its presence used to be borrowed from bbsbh:favoriteTeam — a visitor "having
// an opinion" on a club doubled as "has seen the welcome modal"
// (useFavoriteTeam.js's old `isFirstVisit: !has('club')`). That coupling broke
// the moment the intro grew a second step: dismissing step 1 by ANY route
// commits the currently-picked club (even the untouched pinned default), so
// every visitor who has ever closed the modal also "has an opinion" — the two
// questions collapsed into one, and a two-step flow needs to tell them apart
// on its own. This key is that decoupling, and nothing more.
//
// `step` records which step the visitor exited from — 1 (dismissed before or
// at the club choice) or 2 (reached the account panel, Clerk-configured
// deploys only). It gates NOTHING: every exit from the intro, at either step,
// ends it for good (PRD §6.1 — "closing by any route... skips step 2
// entirely" / "never shown again by the intro"). It is kept purely so the two
// outcomes are distinguishable later, the same spirit as `updatedAt: 0`
// telling `preferencesToPublish` a migrated field apart from an authored one.
//
// Pure on purpose — see prompts.js's header for why the storage I/O lives in
// the hook (useIntroFlag.js) instead of here.

export const INTRO_KEY = 'bbsbh:intro'

// One entry, or null. Malformed input (bad JSON, a non-object, `seen` not
// literally `true`) is "never seen" — the fail-open direction, since the cost
// of getting this wrong is showing the welcome modal an extra time, not a
// spoiler.
export function parseIntro(raw) {
  if (raw == null) return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.seen !== true) {
    return null
  }
  return {
    seen: true,
    step: parsed.step === 2 ? 2 : 1,
    at: Number.isInteger(parsed.at) && parsed.at >= 0 ? parsed.at : 0,
  }
}

export function serializeIntro(step, now = Date.now()) {
  return JSON.stringify({
    seen: true,
    step: step === 2 ? 2 : 1,
    at: Number.isInteger(now) && now >= 0 ? now : 0,
  })
}

export function hasSeenIntro(state) {
  return Boolean(state && state.seen === true)
}

// Write the flag against a storage object handed in, so a caller outside a hook
// can set it — and so it is testable, which `useIntroFlag`'s own window-bound
// writer is not (preferencesStorage.js's header argues the general case).
//
// The caller that needs this is the erase sheet: wiping every `bbsbh:` key
// takes this flag with it, and without re-seeding it the reload looks like a
// first visit, reopens the welcome modal, and — because any exit from that
// modal commits its pick — publishes the DEFAULT club over the user's real one
// on every device.
export function markIntroSeenIn(storage, step = 1, now = Date.now()) {
  // `storage?.setItem?.(…)` would optional-chain straight past a missing
  // storage and then report success, which is the one answer this must never
  // give: the caller uses it to decide whether the device still looks new.
  if (typeof storage?.setItem !== 'function') return false
  try {
    storage.setItem(INTRO_KEY, serializeIntro(step, now))
    return true
  } catch {
    return false
  }
}
