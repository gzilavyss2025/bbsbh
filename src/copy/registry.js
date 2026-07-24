// The copy registry — the single source of truth for every piece of
// admin-editable UI text in the app. It is a plain, dependency-free module so
// three very different consumers can share ONE definition of what a copy key
// is, what it defaults to, and what a valid value looks like:
//
//   - the runtime (src/hooks/useCopy.js) reads DEFAULTS for instant, offline,
//     backend-free rendering — the app works identically with no copy store;
//   - the admin panel (src/screens/AdminCopy.jsx) renders one labelled field
//     per FIELD, with its help text, group, and length budget;
//   - the write endpoint (api/copy.js) validates an incoming override map
//     against these same ids and length caps, so a hand-crafted POST can only
//     ever set a KNOWN key to a bounded string — never inject a new key.
//
// Why a registry and not scattered string literals: the whole point of the
// admin panel (see the ADR) is that the site owner can tune the wording — and
// especially the humor — of the spoiler-consent moments as the site matures,
// without a code change, a deploy, or an AI agent. That is only safe if the set
// of editable strings is closed and every value is bounded; this file is that
// closed set.
//
// Voice: the app is a paper scorebook. Copy is plain-spoken, a little dry, a
// little fond of the bit. Keep score-consent copy HONEST above all — it is the
// one place a user trades away the spoiler protection the whole app exists to
// provide, so the trade must be stated plainly even while having fun with it.

// Groups order the admin panel and let it render section headers. Keep ids
// stable — they are the Redis field names and the localStorage cache keys.
export const GROUPS = [
  { id: 'scoresUnlocked', label: 'Scores Unlocked (home toggle)' },
  { id: 'followLive', label: 'Follow Live (in-game toggle)' },
]

// Each field: a dotted id (`group.slot`), the group it renders under, a short
// human label + help string for the admin form, the max length the value may
// be (enforced client- AND server-side), whether it is multiline (a textarea
// vs. a single-line input in the panel), and the shipped default text.
//
// `{time}` is the ONLY interpolation token the runtime substitutes — it becomes
// the concrete local reset time (e.g. "8:00 AM"). It is optional in any value;
// the admin can move it, keep it, or drop it. No other tokens are honored, so
// editable copy can never smuggle in markup or arbitrary substitution.
export const FIELDS = [
  // ---- Scores Unlocked: the home-screen "just show me the scores" pass ----
  {
    id: 'scoresUnlocked.toggleLabel',
    group: 'scoresUnlocked',
    label: 'Home toggle label',
    help: 'The label next to the physical toggle on the home slate.',
    maxLength: 40,
    multiline: false,
    default: 'Live scores',
  },
  {
    id: 'scoresUnlocked.title',
    group: 'scoresUnlocked',
    label: 'Confirm — title',
    help: 'Heading of the pop-up that appears when you flip the home toggle on.',
    maxLength: 80,
    multiline: false,
    default: 'Sure you want the scores?',
  },
  {
    id: 'scoresUnlocked.body',
    group: 'scoresUnlocked',
    label: 'Confirm — explanation',
    help: 'The main paragraph. Explain that the app hides scores until you reveal them, and that this flips that off for the day.',
    maxLength: 500,
    multiline: true,
    default:
      'This whole app is built so nothing gets spoiled — every score stays sealed until you decide you are ready for it. But if you are not scoring along right now, and you just want to glance at how the games are going, you can override that. Flip this on and every score shows plainly: no seals, no tapping.',
  },
  {
    id: 'scoresUnlocked.humorLine',
    group: 'scoresUnlocked',
    label: 'Confirm — the bit',
    help: 'A lighter line to give the moment some personality. Keep it optional-feeling; the honest part is the explanation above.',
    maxLength: 200,
    multiline: true,
    default: 'No judgment. Some days you just want the number. We get it.',
  },
  {
    id: 'scoresUnlocked.resetNote',
    group: 'scoresUnlocked',
    label: 'Confirm — the 8am promise',
    help: 'Must clearly state that this turns itself back off. Use {time} for the reset time.',
    maxLength: 240,
    multiline: true,
    default:
      'This only lasts today. At {time} the app goes right back to assuming you would rather not have anything spoiled — you will have to turn it on again if you still want it.',
  },
  {
    id: 'scoresUnlocked.confirm',
    group: 'scoresUnlocked',
    label: 'Confirm — accept button',
    help: 'The button that turns scores on. Use {time} to name the reset time if you like.',
    maxLength: 48,
    multiline: false,
    default: 'Show scores until {time}',
  },
  {
    id: 'scoresUnlocked.dismiss',
    group: 'scoresUnlocked',
    label: 'Confirm — decline button',
    help: 'The safe, default-focused button that keeps things sealed.',
    maxLength: 48,
    multiline: false,
    default: 'Keep them sealed',
  },
  {
    id: 'scoresUnlocked.banner',
    group: 'scoresUnlocked',
    label: 'Active banner',
    help: 'The strip shown while scores are unlocked. Use {time} for the reset time. The strip is also the off switch.',
    maxLength: 80,
    multiline: false,
    default: 'Scores unlocked until {time}',
  },

  // ---- Follow Live: the in-game "advance with the game" mode ----
  {
    id: 'followLive.toggleLabel',
    group: 'followLive',
    label: 'In-game toggle label',
    help: 'The label next to the Follow Live toggle inside a game.',
    maxLength: 40,
    multiline: false,
    default: 'Follow live',
  },
  {
    id: 'followLive.title',
    group: 'followLive',
    label: 'Confirm — title',
    help: 'Heading of the pop-up shown when you turn on Follow Live inside a game.',
    maxLength: 80,
    multiline: false,
    default: 'Follow this game live?',
  },
  {
    id: 'followLive.body',
    group: 'followLive',
    label: 'Confirm — explanation',
    help: 'Explain that the app normally waits for you to reveal each half, and that this instead keeps jumping to the newest play as it happens.',
    maxLength: 500,
    multiline: true,
    default:
      'Normally you move through a game at your own pace — each half stays sealed until you reveal it, so a glance never gives away what is coming. Follow live flips that around: the app keeps up with the game for you, revealing each half as it is played and sliding you to the newest pitch. Great for leaving on in the background and checking in.',
  },
  {
    id: 'followLive.humorLine',
    group: 'followLive',
    label: 'Confirm — the bit',
    help: 'A lighter line. Optional in feel; do not let it bury the honest warning below.',
    maxLength: 200,
    multiline: true,
    default: 'Think of it as handing the pencil to someone who refuses to look away.',
  },
  {
    id: 'followLive.changesNote',
    group: 'followLive',
    label: 'Confirm — what changes',
    help: 'Spell out the concrete change: scores appear, extra innings show, and once revealed it cannot be re-sealed.',
    maxLength: 300,
    multiline: true,
    default:
      'That means the score is right there, extra innings included — and once a half is revealed this way, there is no re-sealing it. Following live is the same as saying spoilers are fine for this game.',
  },
  {
    id: 'followLive.resetNote',
    group: 'followLive',
    label: 'Confirm — the 8am promise',
    help: 'State that following stops on its own and the app returns to sealed by default. Use {time} for the reset time.',
    maxLength: 240,
    multiline: true,
    default:
      'And no matter what, by {time} the app is back to assuming you would rather be surprised — nothing stays unsealed into tomorrow on its own.',
  },
  {
    id: 'followLive.confirm',
    group: 'followLive',
    label: 'Confirm — accept button',
    help: 'The button that starts following. Make the spoiler trade unmistakable.',
    maxLength: 48,
    multiline: false,
    default: 'Follow live — spoilers OK',
  },
  {
    id: 'followLive.dismiss',
    group: 'followLive',
    label: 'Confirm — decline button',
    help: 'The safe, default-focused button that keeps you scoring by hand.',
    maxLength: 48,
    multiline: false,
    default: 'Keep scoring by hand',
  },
  {
    id: 'followLive.banner',
    group: 'followLive',
    label: 'Active banner',
    help: 'The strip shown while following a game live. The strip is also the off switch.',
    maxLength: 80,
    multiline: false,
    default: 'Following live — spoilers on',
  },
]

// Fast id -> field lookup, and the set of valid ids the API validates against.
const FIELD_BY_ID = new Map(FIELDS.map((f) => [f.id, f]))
export const FIELD_IDS = FIELDS.map((f) => f.id)

export function getField(id) {
  return FIELD_BY_ID.get(id) || null
}

// The shipped defaults as a flat { id: text } map — what the app renders with
// no copy store at all.
export function defaultCopy() {
  const out = {}
  for (const f of FIELDS) out[f.id] = f.default
  return out
}

// Validate + normalize an override map coming from ANY untrusted source (the
// admin POST body, or a cached blob from localStorage). Returns a NEW object
// containing only known ids whose value is a string within the field's length
// budget; everything else is silently dropped. This is the choke point that
// lets us treat stored copy as safe: an unknown key can't appear, and no value
// can exceed its cap. Never throws — bad input degrades to "fewer overrides",
// which the runtime fills back in from defaults.
export function sanitizeOverrides(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, value] of Object.entries(raw)) {
    const field = FIELD_BY_ID.get(id)
    if (!field) continue
    if (typeof value !== 'string') continue
    const trimmed = value.replace(/\s+$/g, '')
    if (trimmed.length === 0) continue // empty = "use the default", not stored
    if (trimmed.length > field.maxLength) continue
    out[id] = trimmed
  }
  return out
}

// The runtime copy map: defaults with any valid overrides layered on top.
// `overrides` is sanitized here too, so callers can pass a raw cached blob.
export function resolveCopy(overrides) {
  return { ...defaultCopy(), ...sanitizeOverrides(overrides) }
}

// Substitute the one honored token, {time}, into a resolved string. Missing or
// non-string input yields ''. A value with no token is returned unchanged.
export function fillTokens(text, { time } = {}) {
  if (typeof text !== 'string') return ''
  if (typeof time !== 'string' || !time) return text.replace(/\{time\}/g, '')
  return text.replace(/\{time\}/g, time)
}
