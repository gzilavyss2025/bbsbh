import { StampSheet } from '../../components/logbook/StampSheet.jsx'
import { SectionHead } from './statsShared.jsx'

// The Game Log retrospective's milestone shelf — completion sets over the
// user's own stamped games (docs/design-inspiration.md §8), drawn as panes of
// postage stamps on a dark album board.
//
// The art, the math and the level toggle all live in
// components/logbook/StampSheet.jsx, because the open book's page now draws
// the identical sheet (components/logbook/ClubsSeen.jsx). This file is what
// makes THIS one the retrospective's version: the section head above it, and
// `counts`.
//
// `counts` is the whole difference between the two surfaces, and it is a
// rule, not a style. This is deliberately the ONE place in the Game Log
// allowed to say "N of 30" and to mark something complete — NOT the passport
// book, where docs/game-log.md's "not a checklist" rule stays exactly as it
// was. Even here the WORDS stay flat: no "Nice!", no exclamation marks, no
// streak language, no praise. The one celebratory beat is physical, not
// verbal — a single one-time burst the moment a collection's last slot fills,
// felt once, said in no extra words, and tracked (useMilestoneCelebration) so
// it can never replay on a later visit.
export function LogbookMilestones({ stamps = [], factsByPk = {} }) {
  return (
    <section className="logbookstats__section">
      <SectionHead eyebrow="What your book has covered" title="Milestones" />
      <StampSheet stamps={stamps} factsByPk={factsByPk} counts />
    </section>
  )
}
