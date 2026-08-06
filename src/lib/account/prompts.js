// The one-shot store behind My Tally's contextual prompts (PRD §6.2): a small,
// bounded map of prompt id -> the timestamp it was dismissed. Every contextual
// prompt in this app is one-shot and dismissible, never re-shown once its id
// appears here — this module is the single place that rule lives, so a banner
// component never has to reimplement "have I already said this."
//
// Deliberately NOT the same shape as bbsbh:prefs or bbsbh:stamps: there is no
// merge rule and this never syncs. A dismissal is a fact about this BROWSER,
// not the account — the same device-scoped posture as bbsbh:scoresUnlocked,
// and for a related reason: two devices should each get to see a prompt once,
// not have the first device's dismissal silently hide it on the second.
//
// Pure on purpose (parse/serialize/mark, no storage I/O) — the same split
// preferences.js keeps from preferencesStorage.js, so the RULES are the part
// pinned by the unit suite (test/prompts.test.js). The storage side lives in
// the hook (src/hooks/preferences/usePromptDismiss.js), verified in the
// browser rather than here, matching useScoresUnlocked.js/useStamps.js.

export const PROMPTS_KEY = 'bbsbh:prompts'
export const MAX_PROMPTS = 32

// The closed set of one-shot contextual-prompt ids this module recognizes.
// `intro-account` (step 2 of the welcome modal) and `settings-pitch` (the
// always-on /profile panel) are deliberately absent — PRD §6.1/§6.2: the intro
// is governed by its own bbsbh:intro flag, and settings-pitch is the one panel
// allowed to persist. Listing either here would let it be dismissed by
// mistake through this generic path.
export const PROMPT_IDS = Object.freeze(['first-stamp', 'third-game', 'scores-unlocked-local'])

export function isPromptId(id) {
  return typeof id === 'string' && PROMPT_IDS.includes(id)
}

function scrub(map) {
  const source = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  const out = {}
  for (const [id, at] of Object.entries(source)) {
    if (isPromptId(id) && Number.isInteger(at) && at >= 0) out[id] = at
  }
  return out
}

// Parse the raw localStorage value. Never throws — malformed input collapses
// to {} ("nothing dismissed yet"), the fail-OPEN direction for a feature whose
// only job is to stop nagging: showing a prompt again is a minor annoyance,
// never a spoiler, so there is no reason to fail closed here.
export function parsePrompts(raw) {
  if (raw == null) return {}
  try {
    return scrub(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function serializePrompts(map) {
  return JSON.stringify(scrub(map))
}

export function hasSeenPrompt(map, id) {
  return Boolean(map && typeof map === 'object' && Number.isInteger(map[id]))
}

// Mark a prompt dismissed. Returns the SAME reference when it was already
// dismissed — matching the preferences/stamps convention that a no-op
// transform must not trigger a write or a re-render (so `map` itself, not a
// merely-equal scrubbed copy, is what a caller gets back). Otherwise a new
// map, pruned to MAX_PROMPTS by dropping the OLDEST entry, so a hypothetical
// future registry growth can never make this key unbounded.
export function markPromptSeen(map, id, now = Date.now()) {
  if (!isPromptId(id) || hasSeenPrompt(map, id)) return map && typeof map === 'object' ? map : {}
  const next = { ...scrub(map), [id]: Number.isInteger(now) && now >= 0 ? now : 0 }
  const ids = Object.keys(next)
  if (ids.length > MAX_PROMPTS) {
    const oldest = ids.reduce((a, b) => (next[a] <= next[b] ? a : b))
    delete next[oldest]
  }
  return next
}
