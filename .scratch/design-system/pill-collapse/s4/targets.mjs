// Slice 4 targets (#1131): the 16 controls this slice moves, and where each one
// renders. capture.mjs reads these as TARGETS_4; probe.mjs reads them too.
// Each `sel` lists the OLD selector first and the new one second: the first
// that resolves wins, and the sheet records which.
//
// A control target lists `states` (capture-states.mjs). The seeds put a page
// into the state that shows the control: a spoiled day for the slate's filter
// chips, a revealed half for the trail strip, and two made-up stamps for the
// Game Log pages (the anchor game 823035 and 777747; a stamp is a date and a
// time, never a score).
const ALL = ['rest', 'hover', 'focus', 'pressed', 'selected']
const ACT = ['rest', 'hover', 'focus', 'pressed']
const STAMPS = {
  'bbsbh:stamps': JSON.stringify({
    823035: { state: 'on', stampedAt: 1783468800000, date: '2026-07-07' },
    777747: { state: 'on', stampedAt: 1748390400000, date: '2025-05-27' },
  }),
}
const SPOILED = { 'bbsbh:spoiledDays': '["2026-09-22"]' }
const MOUNT = '/.scratch/design-system/pill-collapse/s4-mount.html'
const AFTER = process.env.MOUNT_AFTER ? '?after' : ''

export const TARGETS = [
  // ---- Pill role="control" (a filter, or a scope toggle over a list) ----
  { name: 'mastheadpill', url: '/07072026/milstl-2/lineup1', states: ALL, sel: ['.mastheadpill'] },
  // The same toggle on the Brewers' navy bar: the case where the Pill's navy
  // selected state meets a navy ground.
  { name: 'mastheadpill-navybar', url: '/07072026/milstl-2/lineup2', states: ['rest', 'selected'], sel: ['.mastheadpill'] },
  { name: 'slate-chip', url: '/09222026', seed: SPOILED, states: ALL, sel: ['.slate-filterbar__chip'] },
  { name: 'cmdmap-chip', url: '/player/jacob-misiorowski-694819/analytics', states: ALL, nth: 1, sel: ['.cmdmap__chip'] },
  { name: 'cmdmap-chip-on', url: '/player/jacob-misiorowski-694819/analytics', states: ['rest'], sel: ['.cmdmap__chip--on', '.cmdmap__chip[aria-pressed="true"]'] },
  { name: 'cmdmap-chip-thin', url: '/player/jacob-misiorowski-694819/analytics', states: ['rest', 'hover'], sel: ['.cmdmap__chip--thin'] },
  { name: 'depthpos', url: '/team/158/minors', states: ALL, nth: 1, sel: ['.depthpos'] },
  { name: 'scorebook-filter', url: '/first-scorebook', states: ALL, nth: 1, sel: ['.scorebookstory__filters button'] },
  { name: 'logbook-level', url: '/logbook/stats', seed: STAMPS, states: ALL, nth: 1, sel: ['.logbookstats__levels button'] },
  { name: 'stampsheet-level', url: '/logbook', seed: STAMPS, states: ALL, nth: 1, sel: ['.stampsheet__levels button'] },
  { name: 'trrank-related', url: '/situational-records?metric=scored-first', states: ACT, nth: 1, sel: ['.trrank__related a:not([aria-current])'] },
  { name: 'trrank-related-current', url: '/situational-records?metric=scored-first', states: ['rest'], sel: ['.trrank__related a[aria-current="page"]'] },
  // ---- Button size="control" (any other action on the page) ----
  { name: 'animlab-play', url: '/animation-lab', states: ACT, sel: ['.animlab__play'] },
  { name: 'logbook-watch', url: '/logbook/stats', seed: STAMPS, clicks: ['.logbookstats__toggle'], states: ACT, sel: ['.logbookstats__watch'] },
  { name: 'coverpick-favorite', url: '/logbook/new', w: 1280, states: ALL, sel: ['.coverpick__favorite'] },
  { name: 'dlab-jumplink', url: '/design-lab', states: ACT, sel: ['.dlab__jumplink'] },
  { name: 'trail-summary', url: '/07072026/milstl-2/top7', clicks: ['.revealsplit__btn--quiet'], states: ACT, sel: ['.trailstrip__summarybtn'] },
  { name: 'trail-follow', url: '/07072026/milstl-2/top7', clicks: ['.revealsplit__btn--quiet', '.trailcell >> nth=0'], states: ACT, sel: ['.trailstrip__followbtn'] },
  { name: 'idadmin-cancel', url: MOUNT + AFTER, states: ACT, sel: ['[data-hero="navy"] .idadmin__btn:not(.idadmin__btn--save)'] },
  { name: 'idadmin-save', url: MOUNT + AFTER, states: ACT, sel: ['[data-hero="navy"] .idadmin__btn--save', '[data-hero="navy"] .idadmin__btn:nth-of-type(2)'] },
  { name: 'idadmin-save-gold', url: MOUNT + AFTER, states: ['rest'], sel: ['[data-hero="gold"] .idadmin__btn--save', '[data-hero="gold"] .idadmin__btn:nth-of-type(2)'] },
  { name: 'iddrawer-btn', url: MOUNT + AFTER, states: ACT, sel: ['.iddrawer__btn'] },
  { name: 'lookupdeck-usebtn', url: MOUNT + AFTER, type: ['input[placeholder="Current or retired player"]', 'Yelich'], states: ACT, sel: ['.lookupdeck__usebtn'] },
]
