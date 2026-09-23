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

export const FILLS = ['outline', 'paper', 'ink', 'seal']
export const ROLES = ['tag', 'control']

export function pillClassName({ fill = 'outline', role = 'tag', className = '' } = {}) {
  if (!FILLS.includes(fill)) throw new Error(`Pill: unknown fill "${fill}" (${FILLS.join(', ')})`)
  if (!ROLES.includes(role)) throw new Error(`Pill: unknown role "${role}" (${ROLES.join(', ')})`)
  const parts = ['pill']
  if (role !== 'tag') parts.push(`pill--${role}`)
  if (fill !== 'outline') parts.push(`pill--${fill}`)
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
  if (fill === 'ink' || fill === 'seal') {
    throw new Error(`Pill: fill="${fill}" carries its own ink; ink is for outline and paper`)
  }
  return { '--pill-ink': `var(${ink})` }
}
