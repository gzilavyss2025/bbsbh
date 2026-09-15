// The offseason home page's editable wording — spread into registry.js's FIELDS
// the same way awardFields() and landingFields() are, and split out for the same
// reason: registry.js is the CONTRACT (what a copy key is, how it is validated,
// what the admin panel does with it), and a feature's own slots are a table that
// contract reads. Keeping them here means the winter calendar's format can be
// explained at the length it needs without pushing the contract past its cap.
//
// Wording ONLY. What the calendar SAYS is typed at /admin; what it is allowed to
// show is decided by the offseason window statsapi publishes, in
// src/lib/time/seasonPhase.js. Nothing here is derived from game data and
// nothing here renders inside a sealed surface — registry.js's spoiler guard
// applies to these fields exactly as it does to the ones beside them.
export function offseasonFields() {
  return [
    {
      id: 'offseason.leadNote',
      group: 'offseason',
      label: 'Roster wire — the line under the heading',
      help: 'Sits under “Transactions” when the wire leads the offseason page. It says what window the moves cover, so keep it true to the feed: the wire reads the last three days at MLB, not the whole winter.',
      maxLength: 60,
      multiline: false,
      default: 'The last three days',
    },
    {
      id: 'offseason.springLabel',
      group: 'offseason',
      label: 'Countdown — what is being counted to',
      help: 'The label over the days-to-spring number beside the wire. Spring training’s first game is the day it counts to, straight off the schedule.',
      maxLength: 40,
      multiline: false,
      default: 'First spring game',
    },
    {
      id: 'offseason.calendar',
      group: 'offseason',
      label: 'Winter calendar — the dated strip',
      help: 'One milestone per line, written “2026-12-10 | Rule 5 draft”. The winter’s own dates: GM meetings, the 40-man roster deadline, the Rule 5 draft, the arbitration filing deadline, the Hall of Fame vote, the day pitchers and catchers report. A line that is not written that way, or whose date falls outside the offseason now on screen, is not shown — so last winter’s dates left here print nothing rather than print wrong. Spring training and Opening Day are added for you off the schedule; do not type them.',
      maxLength: 900,
      multiline: true,
      // Ships EMPTY on purpose. Every date on that list moves from winter to
      // winter and none of them is in statsapi, so a shipped default would be
      // this file asserting a Rule 5 date it has no way to check. The two dates
      // the app CAN check are appended by the strip itself, so an unedited
      // calendar is short rather than wrong.
      default: '',
    },
  ]
}
