import { sectionHeadClassName, sectionHeadTitleTag } from '../../../lib/design/sectionHeadClass.js'

// THE SECTION HEAD — the one head a section or a card wears (#1113). Drawn
// once, in styles/system/section-head.css. It is the head, never the card: the
// card under it, and the space above and below it, belong to the parent.
//
//   look    'band' — the club band: --bar-fill ground, a 3px --bar-accent
//           underline, --bar-text ink, all three read from the NEAREST
//           ancestor that sets them (lib/headerTheme.js). With no club, the
//           house navy with a kraft line. SectionHead takes no theme prop: a
//           club may colour a head that names the club, and the theme stays on
//           the card or page root, where it is now (ADR-0030).
//           'label' and 'rule' come in slice H2 (lib/design/sectionHeadClass.js).
//   club    band only: a plain label until a club colour arrives (the team
//           hub's card heads, the player page's section bars).
//   bleed   band only: runs to the page edge, square corners, one size up.
//   as      the title element: 'h3' (the default), 'h2', 'h4', or 'span' inside
//           a card that already has a heading.
//   titleId an id on the title, for a section's aria-labelledby.
//   note    the right-hand second line ("rank of 30", "org rank"). ADR-0084
//           clause 3 names it __note: not a kicker, an eyebrow or a sub.
//   action  ONE control on the right: a Door, a Pill role="control", an
//           InfoPopover.
//   mark    the club's mono mark (a TeamLogo), at the far right, last. It is a
//           direct child so the band can stretch it edge to edge.
//   children  the title.
//
// The title owns the leftover space, so the note, the action and the mark
// pack to the right whatever mix of them a head carries. A head that
// computes or fetches nothing may render anywhere — inside a SealBox reveal
// too — so this file imports no api/ module and no stamp module, ever.
export function SectionHead({
  look,
  club = false,
  bleed = false,
  as: Title = 'h3',
  titleId,
  note,
  action,
  mark,
  className = '',
  children,
}) {
  sectionHeadTitleTag(Title)
  return (
    <div className={sectionHeadClassName({ look, club, bleed, className })}>
      <Title className="sectionhead__title" id={titleId}>
        {children}
      </Title>
      {present(note) && <em className="sectionhead__note">{note}</em>}
      {present(action) && <span className="sectionhead__action">{action}</span>}
      {mark}
    </div>
  )
}

const present = (slot) => slot != null && slot !== false && slot !== ''
