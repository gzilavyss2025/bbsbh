import { SectionHead } from './frame/SectionHead.jsx'

// The navy/gold section masthead for the pre-game cards (Bullpen Health, the
// batting order, opposing defense and opposing starter), the box score's
// cards, and the standings leagues. It is the SectionHead band now (#1113):
// this wrapper keeps the sixteen call sites' old props while they wait for
// their own slices.
//
//   title     the title
//   children  the right-hand slot (an InfoPopover, the season series lead):
//             SectionHead's `action`
//   logo      the club's mono mark at the far right: SectionHead's `mark`
//   as        the title element. The interpretive cards leave it a plain
//             span; a standalone page section passes 'h3' so the document
//             keeps a real heading for screen-reader navigation.
export function SectionMasthead({ title, logo, children, as = 'span' }) {
  return (
    <SectionHead look="band" as={as} action={children} mark={logo}>
      {title}
    </SectionHead>
  )
}
