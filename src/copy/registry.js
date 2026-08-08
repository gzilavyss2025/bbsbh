// The copy registry — the single source of truth for every piece of
// admin-editable UI text in the app. It is a plain, side-effect-free module —
// its one import is the static ballpark table, which it reads to derive one
// note field per park — so three very different consumers can share ONE
// definition of what a copy key is, what it defaults to, and what a valid value
// looks like:
//
//   - the runtime (src/copy/CopyProvider.jsx + copyContext.js) reads DEFAULTS
//     for instant, offline, backend-free rendering — the app works identically
//     with no copy store;
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

import { BALLPARKS } from '../lib/ballpark/ballparkData.js'
import { venueKey } from '../lib/ballpark/ballparkArt.js'

// Groups order the admin panel and let it render section headers. Keep ids
// stable — they are the Redis field names and the localStorage cache keys.
//
// `preview: 'consentModal'` marks a group whose fields together compose one
// ConsentModal, so the panel can offer the live rehearsal of it. A group without
// the flag renders as plain fields — the ballpark notes are 30 unrelated
// paragraphs with no shared modal to stage.
export const GROUPS = [
  { id: 'scoresUnlocked', label: 'Scores Unlocked (the spoilers-off switch)', preview: 'consentModal' },
  { id: 'stampIn', label: 'Stamp In (a club’s played season)', preview: 'consentModal' },
  { id: 'ballparks', label: 'Ballparks (team hub → Overview)' },
]

// Each field: a dotted id (`group.slot`), the group it renders under, a short
// human label + help string for the admin form, the max length the value may
// be (enforced client- AND server-side), whether it is multiline (a textarea
// vs. a single-line input in the panel), and the shipped default text.
//
// TOKENS is the CLOSED set of interpolation tokens the runtime substitutes (see
// fillTokens below). Each is optional in any value — the admin can move it, keep
// it, or drop it, and a token with nothing to fill is stripped along with the
// gap it leaves. Nothing outside this set is honored, so editable copy can never
// smuggle in markup or arbitrary substitution.
//
//   {time}   — the concrete local reset time (e.g. "8:00 AM").
//   {inning} — the half-inning label of the half ALREADY ON SCREEN (e.g.
//              "Top 7th"). Used only by `scoresUnlocked.liveEdgeLabel`.
//
// SPOILER GUARD (do not relax): no field here may be rendered inside a
// sealed/reveal-gated surface, and no field's VALUE may be derived from game
// data — an admin types every one of them by hand, about a subject that has no
// score. That covers the consent/chrome copy and, since ADR-0025's amendment,
// the per-park notes: a ballpark is a building, the team hub's Overview is one
// of the surfaces CLAUDE.md keeps deliberately outside the scoring flow, and a
// sentence about the Green Monster cannot leak tonight's result. A token may
// be added ONLY if its value is categorically incapable of carrying a score. The
// two above qualify: a clock time is not game data at all, and `{inning}` is the
// same structural half-inning label the innings chrome already prints for the
// half the user is looking at — a position in the game, never a run, and only
// ever filled while the user's spoilers-off consent is active. A run/score/result
// token must NEVER be added, and no field may be interpolated with any other
// game data. That is what keeps an admin-editable string incapable of leaking a
// score. If this panel ever grows to govern other app copy, keep score-bearing
// contexts out of the registry entirely — see ADR-0025.
export const TOKENS = Object.freeze(['time', 'inning'])

// The ballpark notes: one free-text paragraph per park, shown on the team hub's
// Overview between the built/roof/capacity facts and the outfield dimensions.
//
// DERIVED, not hand-listed, and that is the point. BALLPARKS is the one place
// the set of parks is written down; a hand-kept second list here would drift the
// first time a park is renamed, and a drifted id is not a cosmetic bug — ids are
// Redis field names, so a park whose id moved would silently lose the paragraph
// somebody wrote for it. Deriving from `park.name` also means the three ALIAS
// keys (Minute Maid/Daikin, Guaranteed Rate/Rate, the Dodger Stadium pair)
// collapse to one field, which is what an editor expects: one park, one note.
//
// Every default is EMPTY on purpose. The card renders no paragraph at all until
// the owner writes one, so nothing ships in a voice they did not choose — and
// `sanitizeOverrides` already treats '' as "no override", so clearing a box in
// the panel is the same operation as never having filled it.
//
// FOUR fields per park, not one — the note plus the three that let the owner
// replace the art without a deploy. `subgroup` keeps a park's four boxes
// together under one heading in the panel instead of scattering 120 inputs.
//
// A pattern-validated field is a NEW kind here, and it matters: `photo` and
// `focus` are not prose, they are a URL that becomes an `<img src>` and a pair
// of numbers that become a CSS `object-position`. sanitizeOverrides enforces
// the pattern on BOTH sides (panel and api/copy.js), so a hand-crafted POST
// cannot put `javascript:` in an image source or arbitrary text in a style.
const PHOTO_URL = /^https:\/\/[^\s"'<>]+$/
// "x y", each 0–100, as percentages of the image. "50 50" is dead centre.
const FOCAL_POINT = /^(100|\d{1,2}) (100|\d{1,2})$/

function parkFields() {
  return [...new Set(Object.values(BALLPARKS))]
    .map((park) => park.name)
    .sort((a, b) => a.localeCompare(b))
    .flatMap((name) => {
      const key = venueKey(name)
      const base = { group: 'ballparks', subgroup: name }
      return [
        {
          ...base,
          id: `ballpark.${key}`,
          label: `${name} — note`,
          help: `A few sentences on ${name} — what the place is like, what makes it odd, what a visitor notices. Leave empty to show no note for this park.`,
          maxLength: 700,
          multiline: true,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Photo`,
          label: `${name} — photo URL`,
          help: 'Replaces the bundled photo. Must be a full https:// link to an image file. Leave empty to keep the shipped photo. You are responsible for having the right to use whatever you point at here.',
          maxLength: 500,
          multiline: false,
          pattern: PHOTO_URL,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Credit`,
          label: `${name} — photo credit`,
          help: 'Only used with a photo URL above. Names the photographer and licence for YOUR photo, since the bundled credit no longer applies. Leave empty for a photo that needs no credit.',
          maxLength: 160,
          multiline: false,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Focus`,
          label: `${name} — focal point`,
          help: 'Which part of the photo to keep when it is cropped to the widescreen box. Two numbers 0–100, across then down — "50 50" is centre, "50 20" favours the top, "50 80" the bottom. Leave empty for centre.',
          maxLength: 7,
          multiline: false,
          pattern: FOCAL_POINT,
          default: '',
        },
      ]
    })
}

export const FIELDS = [
  // ---- Scores Unlocked: the one "just show me the scores" switch. It covers
  // the whole slate, every game surface, and keeps up with a game in progress —
  // there is no second per-game mode, and no second consent. ----
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
    help: 'The main paragraph. Explain that the app hides scores until you reveal them, and that this flips that off for today.',
    maxLength: 500,
    multiline: true,
    default:
      'This whole app is built so nothing gets spoiled — every score stays sealed until you decide you are ready for it. But if you are not scoring along right now, and you just want to see how the games are going, you can override that. Flip this on and every score shows plainly: no seals, no tapping, on the slate and inside every game. A game still being played will keep up with itself while you watch.',
  },
  {
    id: 'scoresUnlocked.humorLine',
    group: 'scoresUnlocked',
    label: 'Confirm — the bit',
    help: 'A lighter line to give the moment some personality. Keep it optional-feeling; the honest part is the explanation above and the note about today staying unlocked.',
    maxLength: 200,
    multiline: true,
    default: 'No judgment. Some days you just want the number, not the whole ritual. Your paper scorecard will never know.',
  },
  {
    id: 'scoresUnlocked.resetNote',
    group: 'scoresUnlocked',
    label: 'Confirm — the 8am promise',
    help: 'Must clearly state that this switches itself off so TOMORROW starts sealed, and that today stays unlocked. Use {time} for the reset time.',
    maxLength: 240,
    multiline: true,
    default:
      'This is a one-day thing. At {time} it switches itself off, so tomorrow starts sealed again — you would turn it on if you wanted it. Today stays unlocked though. You already said you were fine seeing it.',
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
    help: 'The strip shown while scores are unlocked — it appears on the slate AND on every screen inside a game. Use {time} for the reset time. The strip is also the off switch.',
    maxLength: 80,
    multiline: false,
    default: 'Scores unlocked until {time}',
  },
  {
    id: 'scoresUnlocked.changesNote',
    group: 'scoresUnlocked',
    label: 'Confirm — what changes',
    help: 'Spell out the concrete trade: no seals anywhere today, extra innings included, and that your by-hand scoring is left alone.',
    maxLength: 300,
    multiline: true,
    default:
      'That means the score is right there wherever you look today, extra innings included. It leaves your by-hand scoring alone — nothing you have not tapped yourself gets marked as scored, on this phone or any other.',
  },
  {
    id: 'scoresUnlocked.liveEdgeLabel',
    group: 'scoresUnlocked',
    label: 'Caught-up-to-live status',
    help: 'Shown at the bottom of the innings view when a game you are watching is in progress and you are caught up to the newest half — there is no next half to move to yet. Use {inning} where the current half should appear (e.g. "Top 7th").',
    maxLength: 60,
    multiline: false,
    default: 'Live · {inning} in progress',
  },
  // ---- Stamp In: the club's played season, every result showing, one stamp
  // per game you watched (ADR-0042). The SECOND consented departure from the
  // spoiler rule, and the second group here to compose a ConsentModal. It is
  // scoped to one address rather than to a day, so it names no {time} and
  // carries no reset — the two slots Scores Unlocked leans on hardest.
  //
  // Voice: docs/game-log.md §3. Second person, physical verbs, warm and never
  // cute, and never a word about progress — this page is what you SAW, not a
  // checklist you are working through. ----
  {
    id: 'stampIn.title',
    group: 'stampIn',
    label: 'Confirm — title',
    help: 'Heading of the pop-up shown the first time this page is opened on a device.',
    maxLength: 80,
    multiline: false,
    default: 'This page shows every final score',
  },
  {
    id: 'stampIn.body',
    group: 'stampIn',
    label: 'Confirm — explanation',
    help: 'The main paragraph. Say plainly that the whole played season is laid out with its results showing, and why: so a stamp can be pressed for each game the reader watched.',
    maxLength: 500,
    multiline: true,
    default:
      'Everywhere else here, a score stays sealed until you lift it yourself. This page does not: it lays the club’s played season out in front of you, every result showing, so you can press a stamp on each game you sat with. Opening it is you choosing to see those scores.',
  },
  {
    id: 'stampIn.changesNote',
    group: 'stampIn',
    label: 'Confirm — what changes',
    help: 'Spell out the concrete limit: nothing else opens, and by-hand scoring is left alone. This must stay true — the page never advances your scoring on any device.',
    maxLength: 300,
    multiline: true,
    default:
      'Nothing else opens. Every other screen stays sealed, and your by-hand scoring is left exactly where it is — no game is marked as scored, on this phone or any other.',
  },
  {
    id: 'stampIn.resetNote',
    group: 'stampIn',
    label: 'Confirm — what is remembered',
    help: 'Says where the answer is kept. This device only, and it covers this page alone.',
    maxLength: 240,
    multiline: true,
    default:
      'This device remembers your answer, so the season is here waiting next time you come for it.',
  },
  {
    id: 'stampIn.confirm',
    group: 'stampIn',
    label: 'Confirm — accept button',
    help: 'The button that opens the season.',
    maxLength: 48,
    multiline: false,
    default: 'Show me the season',
  },
  {
    id: 'stampIn.dismiss',
    group: 'stampIn',
    label: 'Confirm — decline button',
    help: 'The safe, default-focused button. It leaves the page and goes back to the club’s schedule.',
    maxLength: 48,
    multiline: false,
    default: 'Back to the schedule',
  },
  ...parkFields(),
]

// Fast id -> field lookup, and the set of valid ids the API validates against.
const FIELD_BY_ID = new Map(FIELDS.map((f) => [f.id, f]))
export const FIELD_IDS = FIELDS.map((f) => f.id)

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
    const cleaned = stripControlChars(value, field.multiline).replace(/[ \t]+$/g, '')
    if (cleaned.length === 0) continue // empty = "use the default", not stored
    if (cleaned.length > field.maxLength) continue
    // A field that declares a `pattern` is not prose — its value ends up in an
    // `<img src>` or a CSS `object-position`, where "any bounded string" is no
    // longer a safe contract. Dropping a non-matching value here covers the
    // admin panel AND api/copy.js, so a hand-crafted POST cannot store a
    // `javascript:` URL or arbitrary text that would land in a style.
    if (field.pattern && !field.pattern.test(cleaned)) continue
    out[id] = cleaned
  }
  return out
}

// Remove control and bidirectional-override characters before a value is
// stored or rendered. This matters most in the consent modals, where the
// decline vs. accept buttons must be visually unmistakable: a stray or
// maliciously-pasted U+202E (right-to-left override) or similar could reorder
// or disguise button text. React already escapes markup, so this is purely
// about invisible/reordering characters, not XSS. Newlines are allowed only in
// multiline fields (single-line labels/buttons never legitimately contain one);
// tabs and every C0/C1 control and bidi-format char are always dropped.
function stripControlChars(value, allowNewlines) {
  // Bidi + invisible format chars: Arabic letter mark (U+061C), zero-width
  // space/joiners + LRM/RLM (U+200B–200F), the embedding/override set
  // (U+202A–202E), word joiner (U+2060), the isolate set (U+2066–2069), and the
  // BOM/zero-width no-break space (U+FEFF). C0 controls (optionally keeping
  // U+000A newline for multiline fields), DEL, and C1 controls.
  const bidi = '\\u061C\\u200B-\\u200F\\u202A-\\u202E\\u2060\\u2066-\\u2069\\uFEFF'
  const c0 = allowNewlines ? '\\u0000-\\u0009\\u000B-\\u001F' : '\\u0000-\\u001F'
  // Built via the RegExp constructor (the newline rule varies by field), so
  // no-control-regex — which only inspects regex *literals* — can't fire here
  // and needs no disable directive. Keep it a constructor call if you edit this.
  const controls = new RegExp(`[${c0}\\u007F-\\u009F${bidi}]`, 'g')
  return value.replace(controls, '')
}

// The runtime copy map: defaults with any valid overrides layered on top.
// `overrides` is sanitized here too, so callers can pass a raw cached blob.
export function resolveCopy(overrides) {
  return { ...defaultCopy(), ...sanitizeOverrides(overrides) }
}

// Substitute the honored TOKENS into a resolved string. Missing or non-string
// input yields ''. A value with no token is returned unchanged. A token the
// caller has no value for is DROPPED along with the gap it leaves, so a string
// like "Show scores until {time}" reads "Show scores until", not "Show scores
// until " (or "… at  today" for a mid-sentence token). The tidy pass runs only
// when something was actually stripped, so a fully-substituted string keeps the
// admin's exact spacing.
export function fillTokens(text, tokens = {}) {
  if (typeof text !== 'string') return ''
  let out = text
  let stripped = false
  for (const name of TOKENS) {
    if (!out.includes(`{${name}}`)) continue
    const pattern = new RegExp(`\\{${name}\\}`, 'g')
    const value = tokens?.[name]
    if (typeof value === 'string' && value) {
      // Function-form replacement so a value containing `$&`/`$'` (special
      // replacement patterns) can't expand — fillTokens is a generic exported util.
      out = out.replace(pattern, () => value)
    } else {
      out = out.replace(pattern, '')
      stripped = true
    }
  }
  if (!stripped) return out
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,!?;:])/g, '$1')
    .replace(/[ \t]+$/gm, '')
    .trim()
}
