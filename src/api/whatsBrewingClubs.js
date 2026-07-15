// The calibrated-club gate for What's Brewing, split out of whatsBrewing.js so
// TeamInfo.jsx's `hasWhatsBrewing`/`whatsBrewingTitle` checks (needed at render
// time for every game, to decide modal-vs-plain-link) don't force a static
// import of the heavy PDF-parsing module — that defeated the dynamic import in
// WhatsBrewingModal.jsx, since Rollup can't chunk-split a module that's also
// imported statically elsewhere (it stays in the main bundle instead of its own
// lazy chunk). Titles here must stay in sync with whatsBrewing.js's per-club
// CONFIG.

export const BREWERS_ID = 158
export const PIRATES_ID = 134

const TITLES = {
  [BREWERS_ID]: "What's Brewing?",
  [PIRATES_ID]: 'Pirates Game Notes',
  111: 'Red Sox Game Notes',
  121: 'Mets Game Notes',
  146: 'Marlins Game Notes',
  143: 'Phillies Game Notes',
  119: 'Dodgers Game Notes',
  133: 'Athletics Game Notes',
  117: 'Astros Game Notes',
  118: 'Royals Game Notes',
  108: 'Angels Game Notes',
  136: 'Mariners Game Notes',
  142: 'Twins Game Notes',
  147: 'Yankees Game Notes',
  109: 'D-backs Game Notes',
  144: 'Braves Game Notes',
  116: 'Tigers Game Notes',
  114: 'Guardians Game Notes',
  145: 'White Sox Game Notes',
  110: 'Orioles Game Notes',
  137: 'Giants Game Notes',
  115: 'Rockies Game Notes',
  135: 'Padres Game Notes',
  112: 'Cubs Game Notes',
}

// True when this club's Game Notes template is calibrated — the caller opens the
// What's Brewing modal; otherwise it keeps the plain full-PDF link-out.
export function hasWhatsBrewing(teamId) {
  return teamId in TITLES
}

// The modal heading for a calibrated club (the club's own name for its notes).
export function whatsBrewingTitle(teamId) {
  return TITLES[teamId] || 'Game Notes'
}
