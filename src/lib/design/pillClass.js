// THE PILL'S CLASS LIST AND INK (#1131) — the one place a fill, a role and an
// ink turn into class names and a custom property, shared by
// components/ui/control/Pill.jsx and its tests. Pure, so node --test can pin it.
//
// Two axes, and the defaults carry NO class, the way buttonClass.js does it.
// `outline` is the base .pill fill and `tag` is the base .pill role
// (styles/system/pill.css), so a class that restated either would be a second
// copy of the default. An unknown fill or role is a caller's typo, and it
// throws: a silent fallback would ship an outline tag where someone asked for
// a seal control.

import { TEXT, ratio } from './contrastPairings.js'

export const FILLS = ['outline', 'paper', 'ink', 'seal', 'solid']
export const ROLES = ['tag', 'control']

// `figure` is the mono figure face (#1186): a rank, a level, a count. It is not
// a third colour axis; it sets the face and centres it on its cap height, for
// a tag and a control alike (styles/system/pill.css, "THE FIGURE FACE"). A
// hand-written pill opts in with the same class, pill--figure.
export function pillClassName({ fill = 'outline', role = 'tag', figure = false, className = '' } = {}) {
  if (!FILLS.includes(fill)) throw new Error(`Pill: unknown fill "${fill}" (${FILLS.join(', ')})`)
  if (!ROLES.includes(role)) throw new Error(`Pill: unknown role "${role}" (${ROLES.join(', ')})`)
  const parts = ['pill']
  if (role !== 'tag') parts.push(`pill--${role}`)
  if (fill !== 'outline' && fill !== 'solid') parts.push(`pill--${fill}`)
  if (figure) parts.push('pill--figure')
  if (className) parts.push(className)
  return parts.join(' ')
}

// THE INK. There is no tone prop: a pill's meaning is its copy ("Rookie",
// "Top 100", "12 shy of 300 HR") plus one colour token the caller passes by
// NAME — `ink="--field"` — which becomes --pill-ink. On an outline pill the ink
// draws the edge and the text; on a paper pill it draws the text. Ink and seal
// are fills that already carry their own ink, so a passed one there is refused
// rather than painted over a navy or kraft ground it was never checked against.
//
// Three families of token are refused outright, each for a written reason:
//   --seal*    kraft means sealed (ADR-0083). The seal FILL is the only way a
//              pill wears it, and that fill is allowlisted in one selector.
//   --bar-*    a club's colour is identity, never a control or a label's
//              meaning (ADR-0030).
//   --marker   highlighter yellow is a fill, never an ink: 1.58:1 on paper.
// A raw colour ('#2F6E4F', 'green') is refused too: the ink is a token or
// nothing, so a pill cannot be the place a hex value comes back.
const TOKEN = /^--[a-z][a-z0-9-]*$/
const REFUSED = [
  [/^--seal/, 'kraft means sealed (ADR-0083) — use fill="seal", and only on a sealed thing'],
  [/^--bar-/, 'club colour is identity, never a pill (ADR-0030)'],
  [/^--marker/, '--marker is a fill, never an ink (ADR-0083)'],
]

export function pillInkStyle({ fill = 'outline', ink } = {}) {
  if (ink === undefined) return undefined
  if (!TOKEN.test(ink)) throw new Error(`Pill: ink must be a token name like "--field", not "${ink}"`)
  for (const [re, why] of REFUSED) if (re.test(ink)) throw new Error(`Pill: ink "${ink}" refused — ${why}`)
  if (fill === 'ink' || fill === 'seal' || fill === 'solid') {
    throw new Error(`Pill: fill="${fill}" carries its own ink; ink is for outline and paper`)
  }
  return { '--pill-ink': `var(${ink})` }
}

// THE SOLID GROUND (#1187). fill="solid" is a pill repainted in a ground the
// caller brings, with the text that sits on it, as ONE pair. It has no class:
// like outline, it is the base .pill reading --pill-fill, --pill-edge and
// --pill-text, and this sets the three. A club's colour reaches a pill only
// here or as a tint host (ADR-0030), and only on an identity label.
//
// The pair is checked. Two hex colours must clear `min` (WCAG AA text, 4.5, by
// default) or this throws. A `var(--token)` cannot be resolved at runtime, so
// a token pair passes through and scripts/check-contrast.mjs holds it through
// its PAIRINGS. `min` is for a pair the caller cannot retune: the club key
// colours (winprob/keyColors.js) pass the UI bar (3), because six real band
// colours sit between 3 and 4.5 with their best text.
const HEX = /^#[0-9a-f]{6}$/i

export function pillSolidStyle({ ground, text, min = TEXT }) {
  if (HEX.test(ground) && HEX.test(text)) {
    const r = ratio(text, ground)
    if (r < min) throw new Error(`Pill: solid ${text} on ${ground} is ${r.toFixed(2)}:1, under ${min}:1 contrast`)
  }
  return { '--pill-fill': ground, '--pill-edge': ground, '--pill-text': text }
}
