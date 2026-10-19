// The copy registry — the single source of truth for every piece of
// admin-editable UI text in the app. It is a plain, side-effect-free module —
// every import is a leaf table it reads to build a field's id or its default
// (MLB's hand-authored ballpark measurements, MiLB's generated venue list, the
// landing-page slots, and the shipped award weight order) — so three very
// different consumers can share ONE
// definition of what a copy key is, what it defaults to, and what a valid value
// looks like:
//
//   - the runtime (src/copy/CopyProvider.jsx + copyContext.js) reads DEFAULTS
//     for instant, offline rendering — the app works identically with no copy
//     store configured;
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

import { landingFields } from './landing/fields.js'
import { awardFields } from './awardFields.js'
import { offseasonFields } from './offseasonFields.js'
import { BALLPARKS } from '../lib/ballpark/ballparkData.js'
import { parkKey } from '../lib/ballpark/parkKeys.js'
import MILB_BALLPARKS from '../lib/data/milb-ballparks.json' with { type: 'json' }

// Groups order the admin panel and let it render section headers. Keep ids
// stable — they are the Redis field names and the localStorage cache keys.
//
// `preview: 'consentModal'` marks a group whose fields together compose one
// ConsentModal, so the panel can offer the live rehearsal of it. A group without
// the flag renders as plain fields — the ballpark notes are 30 unrelated
// paragraphs with no shared modal to stage.
export const GROUPS = [
  { id: 'stampIn', label: 'Stamp In (a club’s played season)', preview: 'consentModal' },
  { id: 'ballparks', label: 'Ballparks (team hub → Overview)' },
  { id: 'ballparksMilb', label: 'Ballparks — Minor League (team hub → Overview)' },
  { id: 'learn', label: 'Guides (/learn — the server-rendered landing pages)' },
  { id: 'awards', label: 'Award weight (player page → Awards)', editor: 'awardOrder' },
  { id: 'offseason', label: 'Offseason home (the winter slate)' },
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
//   {time}   — a concrete local clock time (e.g. "8:00 AM").
//   {inning} — the half-inning label of the half ALREADY ON SCREEN (e.g.
//              "Top 7th").
//
// No shipped field uses either token since the Scores Unlocked group was
// removed (ADR-0116); the set stays closed and stays here, so a future field
// that needs one inherits the guard below rather than inventing a path around
// it.
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
// half the user is looking at — a position in the game, never a run. A run/score/result
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
// THE KEY IS PINNED, NOT RE-DERIVED. parkKey() answers the key the venue was
// first filed under (lib/data/park-keys.json, pinned to its Stats API
// venue id), so if BALLPARKS ever takes a park's new sponsor name, these ids
// stay where the saved copy is. test/park-keys.test.js holds the line.
//
// Every default is EMPTY on purpose. The card renders no paragraph at all until
// the owner writes one, so nothing ships in a voice they did not choose — and
// `sanitizeOverrides` already treats '' as "no override", so clearing a box in
// the panel is the same operation as never having filled it.
//
// SIX fields per park, not one — the note, the two that override how the park
// is NAMED, and the three that replace its art, all without a deploy.
// `subgroup` keeps a park's six boxes together under one heading in the panel
// instead of scattering 180 inputs.
//
// The suffixed ids (`…Name`, `…Wordmark`, `…Photo`, `…Credit`, `…Focus`) cannot
// collide with a bare park id, and that is structural rather than lucky:
// venueKey() emits [a-z0-9] only, so no park's key can ever contain the capital
// letter that starts every suffix. A park called "Fenway Park Name" would key
// as `fenwayparkname`, which is not `fenwayparkName`. Keep suffixes capitalised
// and this stays true by construction.
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
      const key = parkKey(name)
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
          id: `ballpark.${key}Name`,
          label: `${name} — name shown`,
          help: `Replaces "${name}" as the name printed on the card. For a park whose sponsor name has changed, or a name the feed spells differently from how anyone says it. Leave empty to use the name from the schedule feed.`,
          maxLength: 60,
          multiline: false,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Wordmark`,
          label: `${name} — name as an image`,
          help: 'A full https:// link to a PNG of the park\'s name, shown INSTEAD of the typeset name. Leave empty to print the name as text. A park wordmark is usually a sponsor\'s registered trademark — using one is your call and your licence to hold.',
          maxLength: 500,
          multiline: false,
          pattern: PHOTO_URL,
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

// The MiLB counterpart to parkFields() above — a photo/name/logo editor for
// every current minor-league park, minus the note and minus the measurements.
//
// NO NOTE, NO DIAGRAM. A MiLB park carries no BALLPARKS record (ballparkData.js
// covers the 30 MLB parks only — nobody has hand-verified a MiLB outfield or
// digitized its wall polygon), so BallparkCard renders no diagram/dimensions
// section for one at all; a note field with nothing beside it would be a
// paragraph floating under a bare stadium name. FIVE fields per park, not six.
//
// SAME KEY SCHEME AS parkFields(): the venue's PINNED key, which is venueKey()
// of the first name the venue was seen under and never moves after (a rename
// keeps the key; the heading below shows the current name). Not a team id. That is what
// lets a MiLB park's fields "just work" everywhere a key is already derived
// from the live venue name with no BALLPARKS hit — parkBackdrop.js's MiLB
// fallback (see its header) starts rendering a slate-card backdrop for a park
// the moment this makes it a known registry field, with no code change there.
//
// Source list is GENERATED (scripts/gen-milb-ballparks.mjs → milb-ballparks
// .json), not hand-listed like BALLPARKS — a MiLB park's identity is just its
// name off the schedule feed, nothing here needs verifying by eye the way a
// wall height does. One venue can host two clubs (Roger Dean Chevrolet
// Stadium, Jupiter/Palm Beach), already deduped by the generator; `teams`
// joins every hosted club into the admin panel's subgroup heading.
//
// ONE MORE DEDUPE, AGAINST THE OTHER TABLE: Sutter Health Park is both the
// Athletics' temporary MLB home (BALLPARKS, estimated dimensions) and the
// Sacramento River Cats' Triple-A park, so it comes back from statsapi under
// sportId 11 too. A key BALLPARKS already claims skips here — one set of six
// fields for it, the MLB one with its diagram, not a colliding second set of
// five with no diagram.
const MLB_PARK_KEYS = new Set([
  ...Object.keys(BALLPARKS),
  ...Object.values(BALLPARKS).map((park) => parkKey(park.name)),
])

function milbParkFields() {
  return Object.entries(MILB_BALLPARKS)
    .filter(([key]) => !MLB_PARK_KEYS.has(key))
    .sort(([, a], [, b]) => a.venue.localeCompare(b.venue))
    .flatMap(([key, { venue, teams }]) => {
      const base = { group: 'ballparksMilb', subgroup: `${venue} — ${teams.join(' / ')}` }
      return [
        {
          ...base,
          id: `ballpark.${key}Name`,
          label: `${venue} — name shown`,
          help: `Replaces "${venue}" as the name printed on the card. Leave empty to use the name from the schedule feed.`,
          maxLength: 60,
          multiline: false,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Wordmark`,
          label: `${venue} — name as an image`,
          help: 'A full https:// link to a PNG of the park\'s name, shown INSTEAD of the typeset name. Leave empty to print the name as text. A park wordmark is usually a sponsor\'s registered trademark — using one is your call and your licence to hold.',
          maxLength: 500,
          multiline: false,
          pattern: PHOTO_URL,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Photo`,
          label: `${venue} — photo URL`,
          help: 'This park ships with no bundled photo. Must be a full https:// link to an image file. You are responsible for having the right to use whatever you point at here.',
          maxLength: 500,
          multiline: false,
          pattern: PHOTO_URL,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Credit`,
          label: `${venue} — photo credit`,
          help: 'Only used with a photo URL above. Names the photographer and licence. Leave empty for a photo that needs no credit.',
          maxLength: 160,
          multiline: false,
          default: '',
        },
        {
          ...base,
          id: `ballpark.${key}Focus`,
          label: `${venue} — focal point`,
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
  // ---- Stamp In: the club's played season, every result showing, one stamp
  // per game you watched (ADR-0042). A consented departure from the spoiler
  // rule, and the one group here that composes a ConsentModal. It is scoped to
  // one address rather than to a day, so it names no {time} and carries no
  // reset.
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
  ...offseasonFields(),
  ...awardFields(),
  ...parkFields(),
  ...milbParkFields(),
  ...landingFields(),
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

// Layer `patch` over `current` — the partial-save merge, shared by the client
// that composes a patch and the server that applies one.
//
// A patch value of '' means CLEAR THIS FIELD, so it is dropped rather than
// stored, matching sanitizeOverrides, which already treats an empty string as
// "no override, use the default". A key absent from the patch is left exactly
// as it was; that is the whole point of a patch.
//
// IT LIVES HERE, beside sanitizeOverrides, because BOTH ends of the write need
// the identical function and there must not be two of them. api/copy.js applies
// a patch against the authoritative Redis map; the client composes one. A
// second implementation that drifted would decide, silently, that a save means
// two different things depending on which end ran it.
export function mergeOverrides(current, patch) {
  const merged = { ...sanitizeOverrides(current) }
  for (const [id, value] of Object.entries(patch || {})) {
    if (typeof value === 'string' && value.trim()) merged[id] = value.trim()
    else delete merged[id]
  }
  return sanitizeOverrides(merged)
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
// like "Back at {time}" reads "Back at", not "Back at " (or "… at  today" for a
// mid-sentence token). The tidy pass runs only
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
