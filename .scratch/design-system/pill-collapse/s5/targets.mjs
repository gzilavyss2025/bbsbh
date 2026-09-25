// Slice 5 targets (#1131): the two band controls, and where each one renders.
// capture.mjs reads these as TARGETS_5. Each `sel` lists the OLD selector
// first and the new one second: the first that resolves wins, and the sheet
// records which. (Both rows kept their hook, so one selector serves both.)
//
//   .psodds-pill     Postseason Odds (the Standings card, overview) and Stamp
//                    In (the Schedule card, games tab). A themed hub paints the
//                    card head in the club's bar colour; a hub with no curated
//                    colours (ACL Brewers, 406) keeps the plain head.
//   .trrank__jump a  the navy category rail on the bare /situational-records.
const ACT = ['rest', 'hover', 'focus', 'pressed']

export const TARGETS = [
  // A navy club: the case where a navy ink pill would vanish.
  { name: 'psodds-navy', url: '/team/158', states: ACT, sel: ['.psodds-pill'] },
  // A light club (the Orioles' orange bar, dark text).
  { name: 'psodds-light', url: '/team/110', states: ACT, sel: ['.psodds-pill'] },
  // A red club.
  { name: 'psodds-red', url: '/team/138', states: ['rest'], sel: ['.psodds-pill'] },
  // Stamp In on a themed hub's Schedule card.
  { name: 'stampin-navy', url: '/team/158/games', states: ['rest'], sel: ['.psodds-pill'] },
  // The plain hub: no club colours, so the pill keeps its ink fill.
  { name: 'stampin-plain', url: '/team/406/games', states: ACT, sel: ['.psodds-pill'] },
  // The records rail on its navy band.
  { name: 'trrank-jump', url: '/situational-records', states: ACT, nth: 1, sel: ['.trrank__jump a'] },
  { name: 'trrank-jump-first', url: '/situational-records', states: ['rest', 'focus'], sel: ['.trrank__jump a'] },
]
