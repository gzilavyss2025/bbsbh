// THE SECTION HEAD'S CLASS LIST (#1113) — the one place a look and its two
// band switches turn into class names, shared by
// components/ui/frame/SectionHead.jsx and its tests. Pure, so node --test can
// pin it, the way pillClass.js pins the pill.
//
// LOOKS. Slice H1a builds the band only. Slice H2 adds `label` (graphite caps
// on a hairline) and `rule` (the label, then a pencil rule to the right edge),
// and `label` becomes the look a head gets when it names none. Until H2 lands,
// asking for either is refused rather than drawn as a band: a silent fallback
// would paint the club's colour on a head that asked to be quiet.
//
// THE BAND'S TWO SWITCHES. Both are band-only, and both throw anywhere else.
//   club   a band that is a plain label until a club colour arrives: the team
//          hub's card heads and the player page's section bars. With no club
//          theme it draws the label face, never the navy one (#1113 Q2: keep
//          both unthemed faces as they are today).
//   bleed  the band runs to the page edge with square corners, one size up:
//          the player page's top-level sections, which head a page section
//          and not a card.
export const LOOKS = ['band']
export const LOOKS_LATER = ['label', 'rule']

export function sectionHeadClassName({ look = 'label', club = false, bleed = false, className = '' } = {}) {
  if (LOOKS_LATER.includes(look)) {
    throw new Error(`SectionHead: look="${look}" is not built yet (#1113 slice H2); pass look="band"`)
  }
  if (!LOOKS.includes(look)) throw new Error(`SectionHead: unknown look "${look}" (${LOOKS.join(', ')})`)
  if ((club || bleed) && look !== 'band') throw new Error('SectionHead: club and bleed are band switches')
  const parts = ['sectionhead', `sectionhead--${look}`]
  if (club) parts.push('sectionhead--club')
  if (bleed) parts.push('sectionhead--bleed')
  if (className) parts.push(className)
  return parts.join(' ')
}

// A heading element, or a span inside a card that already has a heading.
export const TITLE_TAGS = ['h2', 'h3', 'h4', 'span']

export function sectionHeadTitleTag(as = 'h3') {
  if (!TITLE_TAGS.includes(as)) throw new Error(`SectionHead: as="${as}" (${TITLE_TAGS.join(', ')})`)
  return as
}
