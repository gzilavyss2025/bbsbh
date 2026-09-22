// THE REAL CONTENT OF THE PHASE 2 CARDS, scraped off the running dev server on
// 2026-09-21 with ../scrape-phase2.mjs, and the measured height of every card
// on all three pages with ../page-shape.mjs on the same run.
//
// The heights are the contract. A full-page artboard is only worth drawing if
// it is at true proportion, so every card on those boards is pinned to the
// height the live page gives it, and the page totals below are the sum.

// 556 Nashville is not in data.mjs's CLUBS, which only needed the three clubs
// Phase 1 drew. Read with ../computed.mjs on the same run: crimson under navy.
export const CLUB_556 = { name: 'Nashville Sounds', bar: '#C8102E', accent: '#071D49', onBar: '#F8F8F5', themed: true }

/* ---------------------------------------------------------- RANKS · 249 + 556
   The leaders ledger is NOT a .thub-card. It is a page-level group label
   (h3.section__title) with two doors, over two sub-cards whose head bars are
   --accent-primary — the APP's navy, not the club's. Checked in
   src/styles/23-box-score-detail.css:367 and src/tokens/colors.css:110. */
export const LEDGER_249 = {
  title: 'Team leaders',
  doors: ['See all ›', 'Org leaders ›'],
  batting: [
    ['AVG', 'Brailyn Antunez', 'CF', '.339'],
    ['OPS', 'Brailyn Antunez', 'CF', '1.022'],
    ['HR', 'José Anderson', 'CF', '23'],
    ['RBI', 'Handelfry Encarnacion', 'RF', '71'],
    ['H', 'Handelfry Encarnacion', 'RF', '108'],
    ['SB', 'Brady Ebel', 'SS', '39'],
  ],
  pitching: [
    ['ERA', 'Jose Meneses', 'LHP', '1.88'],
    ['WHIP', 'Garrett Hodges', 'RHP', '0.89'],
    ['SO', 'Jarrette Bonet', 'RHP', '100'],
    ['W', 'Jarrette Bonet', 'RHP', '8'],
    ['SV', 'Jose Meneses', 'LHP', '6'],
    ['IP', 'Jarrette Bonet', 'RHP', '109.1'],
  ],
}

// Nashville's and Los Mochis' own leaders, scraped on the same run. A board
// that printed Wilson's players under another club's head would be the one kind
// of error this canvas cannot afford, because its whole claim is that the
// figures are real.
export const LEDGER_556 = {
  title: 'Team leaders', doors: ['See all ›', 'Org leaders ›'],
  batting: [['AVG', 'Luis Lara', 'CF', '.321'], ['OPS', 'Darrien Miller', 'C', '.943'],
    ['HR', 'Brock Wilken', '1B', '17'], ['RBI', 'Brock Wilken', '1B', '80'],
    ['H', 'Jeferson Quero', 'DH', '107'], ['SB', 'Luis Lara', 'CF', '24']],
  pitching: [['ERA', 'Cameron Wagoner', 'RHP', '0.56'], ['WHIP', 'Craig Yoho', 'RHP', '0.65'],
    ['SO', 'Coleman Crow', 'RHP', '102'], ['W', 'Coleman Crow', 'RHP', '9'],
    ['SV', 'Blake Holub', 'RHP', '5'], ['IP', 'Coleman Crow', 'RHP', '105.1']],
}
// One door, not two: a winter club has no parent org, so there are no org
// leaders to send anyone to.
export const LEDGER_675 = {
  title: 'Team leaders', doors: ['See all ›'],
  batting: [['AVG', 'Eric Filia', 'LF', '.363'], ['OPS', 'Eric Filia', 'LF', '.917'],
    ['HR', 'Leonys Martin', 'CF', '11'], ['RBI', 'Eric Filia', 'LF', '33'],
    ['H', 'Eric Filia', 'LF', '81'], ['SB', 'Isaac Rodriguez', '2B', '14']],
  pitching: [['ERA', 'Daniel Duarte', 'RHP', '0.00'], ['WHIP', 'Daniel Duarte', 'RHP', '0.58'],
    ['SO', 'Darel Torres', 'RHP', '62'], ['W', 'Darel Torres', 'RHP', '6'],
    ['SV', 'Danis Correa', 'RHP', '9'], ['IP', 'Darel Torres', 'RHP', '63.1']],
}

// 556 Nashville. The ABS card is the one place in the app that says this club
// argues with the plate umpire more than its league does.
export const ABS_556 = {
  title: 'Who challenges', note: 'against what they see',
  rate: '6.44', unit: 'Per 1,000 pitches seen', rank: '14th of 30 clubs', league: 'League 6.39',
  views: ['At the plate', 'Behind it'],
  mark: 'Luke Adams · 17',
  axis: ['1k', '2k'],
  axisNote: 'Pitches seen across, reviews called up',
  boardNote: '13 of 33 with 200+ plate appearances',
  cols: ['Player', 'Pitches', 'Called', 'Rate'],
  rows: [
    ['Brock Wilken', '2,260', '17', '7.52'],
    ['Tyler Black', '1,819', '17', '9.35'],
    ['Jeferson Quero', '1,739', '8', '4.60'],
    ['Ethan Murray', '1,515', '7', '4.62'],
    ['Jett Williams', '1,406', '14', '9.96'],
    ['Luis Lara', '1,337', '10', '7.48'],
    ['Luke Adams', '1,121', '17', '15.17'],
    ['Eddys Leonard', '1,053', '2', '1.90'],
    ['Akil Baddoo', '1,017', '5', '4.92'],
    ['Luis Matos', '1,007', '5', '4.97'],
    ['Cooper Pratt', '969', '12', '12.38'],
    ['Eduardo Garcia', '892', '0', '0.00'],
    ['Ramón Rodríguez', '790', '4', '5.06'],
  ],
  foot: '7 of 13 ask less often than the league rate predicts from the pitches they see, and Luke Adams called for 17 in 1,121 pitches seen — 15.17 against the league’s 6.39. A man traded in July is counted for the club he saw those pitches with, not the one holding him now.',
  door: 'League challenge board ›',
}

/* ------------------------------------------------------------------- ABOUT
   Four unlike modules. Two are .thub-cards; two are page-level group labels
   with no card of their own, which is the harmonization problem this band
   states more clearly than any other. */
export const BALLPARK = {
  158: {
    px: 1014, name: 'American Family Field',
    of: [['lf', '344′'], ['lc', '371′'], ['cf', '400′'], ['rc', '374′'], ['rf', '345′']],
    ofNote: '3rd deepest',
    walls: [['lf', '8′'], ['cf', '8′'], ['rf', '8′']],
    facts: [
      [['Opened', '2001'], ['Roof', 'Retractable'], ['Capacity', '41,700']],
      [['Avg attendance', '34,099', '11th of 30'], ['Season high', '43,001'], ['Season low', '2,432']],
      [['Sellouts', '22 of 77', '95%+ full'], ['Total rank', '10th of 30', '2,659,685'], ['Fill rank', '10th of 30', '82.8% full']],
    ],
  },
  // 93px and 91px: a head and ONE line of text. No diagram, no dimensions, no
  // photo, and no "not posted yet" either — not a designed state, which is what
  // design.md §3 records as the page's one undrawn empty.
  249: { px: 93, name: 'Wilson Ballpark' },
  675: { px: 91, name: 'Estadio Emilio Ibarra Almada' },
}

export const JERSEYS = {
  158: {
    px: 260, note: 'record by jersey',
    cards: [['Home Creams', '29–14'], ['Home Alternate Pinstripes', '15–6'],
      ['Away Alternate Navy Blues', '24–13'], ['Away Powder Blues', '22–19'], ['City Connect "Wisco"', '8–6']],
  },
  249: { px: 260, note: 'home and away', cards: [['Home', '38–26'], ['Away', '26–40']] },
  675: { px: 258, note: 'home and away', cards: [['Home', '20–14'], ['Away', '18–16']] },
}

export const AFFIL_HISTORY_249 = {
  px: 98, title: 'Affiliation history',
  stops: ['2005–08', '2009–11', '2012–14', '2015–16', '2017–26'],
}

export const ALUMNI_249 = {
  px: 906, title: 'Made The Show', note: '20+ games here',
  rows: [
    ['Francisco Lindor', '12·SS', 'New York Mets', '83 G·2013'],
    ['Dansby Swanson', '7·SS', 'Chicago Cubs', '21 G·2016'],
    ['Yandy Díaz', '2·DH', 'Tampa Bay Rays', '76 G·2014'],
    ['Miguel Rojas', '72·2B', 'Los Angeles Dodgers', '75 G·2010–2011'],
    ['Trent Grisham', '12·CF', 'New York Yankees', '133 G·2017'],
    ['Brice Turang', '2·2B', 'Milwaukee Brewers', '47 G·2019'],
  ],
}

/* ---------------------------------------------------- the standings tables
   The live table has NINE columns, not the six the Phase 1 boards draw. Those
   boards were the comparison that chose the band furniture and the column count
   never bore on it; a full-page board is a measurement, so it draws all nine. */
export const STANDINGS = {
  158: {
    head: 'National League Central', pill: 'Postseason Odds', px: 272,
    cols: ['Team', 'W', 'L', 'GB', 'Streak', 'L10', 'Home', 'Away', 'RD'],
    rows: [
      ['Brewers', '98', '58', '-', 'W3', '8-2', '52-26', '46-32', '+202', true],
      ['Cubs', '87', '69', '11.0', 'W2', '6-4', '45-33', '42-36', '+152'],
      ['Pirates', '79', '77', '19.0', 'W4', '6-4', '42-36', '37-41', '+29'],
      ['Cardinals', '76', '80', '22.0', 'W1', '4-6', '38-43', '38-37', '-23'],
      ['Reds', '72', '84', '26.0', 'L2', '3-7', '38-43', '34-41', '-163'],
    ],
  },
  249: {
    head: 'Carolina League North', pill: null, px: 298,
    cols: ['Team', 'W', 'L', 'GB', 'Streak', 'L10', 'Home', 'Away', 'RD'],
    rows: [
      ['Nationals', '80', '51', '-', 'W7', '8-2', '44-22', '36-29', '+158'],
      ['Woodpeckers', '71', '58', '8.0', 'L5', '5-5', '40-27', '31-31', '+36'],
      ['Warbirds', '64', '66', '15.5', 'L12', '0-10', '38-26', '26-40', '-56', true],
      ['RidgeYaks', '56', '75', '24.0', 'L1', '4-6', '34-30', '22-45', '-23'],
      ['Howlers', '56', '75', '24.0', 'W1', '5-5', '31-35', '25-40', '-142'],
      ['Shorebirds', '45', '87', '35.5', 'L1', '3-7', '23-43', '22-44', '-245'],
    ],
  },
  // Ten clubs, one record group, `division` null on both sides — which
  // divisionRecordFor already normalises, so the table matches and renders.
  675: {
    head: 'Standings', note: 'entering Thu, Jan 15', pill: null, px: 428,
    cols: ['Team', 'W', 'L', 'GB', 'Streak', 'L10', 'Home', 'Away', 'RD'],
    rows: [
      ['Nayarit', '40', '28', '-', 'L2', '6-4', '20-14', '20-14', '+71'],
      ['Culiacan', '40', '28', '-', 'W2', '7-3', '24-10', '16-18', '+69'],
      ['Hermosillo', '40', '28', '-', 'L2', '5-5', '20-14', '20-14', '+34'],
      ['Obregon', '40', '28', '-', 'W2', '7-3', '22-12', '18-16', '+42'],
      ['Jalisco', '38', '30', '-', 'L1', '4-6', '24-10', '14-20', '+8'],
      ['Mochis', '38', '30', '-', 'W1', '5-5', '20-14', '18-16', '+11', true],
      ['Mexicali', '33', '35', '5.0', 'W1', '4-6', '15-19', '18-16', '+32'],
      ['Guasave', '26', '42', '12.0', 'L1', '5-5', '11-23', '15-19', '-79'],
      ['Tucson', '23', '45', '15.0', 'W1', '4-6', '11-23', '12-22', '-73'],
      ['Mazatlan', '22', '46', '16.0', 'L1', '3-7', '10-24', '12-22', '-115'],
    ],
  },
}

/* ------------------------------------------------- every band, every card
   [title, note, measured px, shape] — the shape names a renderer in
   build-phase2.mjs. The px is what the live page gives the card at iPhone 13
   width on 2026-09-21; the page totals are the sum and nothing is rounded.

   Records is the one exception: 826 at 158 and 781 at 249 is the REORGANISED
   card (design.md §6), which is drawn for real from records/build-records.mjs
   rather than as a shape. */
export const PAGE = {
  158: {
    Standing: {
      first: [['@standings', null, 272], ['Season report', 'how this is calculated', 421, 'teamscore']],
      sub: 'Record, split every way',
      second: [['@records', null, 826], ['Record by day of week', null, 173, 'dow'],
        ['Comeback wins', 'and the games they gave back', 407, 'comebacks']],
    },
    Ranks: [['Team batting', 'rank out of 30', 204, 'ranktiles'], ['Team pitching', 'rank out of 30', 266, 'ranktiles'],
      ['Run value', 'runs above average', 515, 'runvalue'], ['Who challenges', 'against what they see', 1014, 'abs'],
      ['@ledger', null, 534]],
    Games: [['Schedule', 'Stamp In', 819, 'schedule'], ['@grid', null, 1302],
      ['Highlights', null, 263, 'rail'], ['Photos', 'Full season ›', 238, 'rail']],
    Roster: [['Roster', 'preferred lineup', 1245, 'projection'], ['Bullpen health', null, 467, 'bullpen'],
      ['Current Roster', null, 1282, 'roster40'], ['Injured List', null, 317, 'illist'],
      ['Transactions', 'All transactions ›', 206, 'txdeck']],
    Farm: [['Affiliates', null, 549, 'affiliates'], ['On the horizon', null, 1051, 'horizon'],
      ['Prospects', 'org rank', 1197, 'prospects'], ['Depth chart', 'scouting vs. performance', 388, 'depth']],
    Money: [['2026 payroll', null, 2364, 'payroll']],
    About: [['@ballpark', null, 1014], ['@jerseys', null, 260]],
  },
  249: {
    Standing: {
      first: [['@standings', null, 298]],
      sub: 'Record, split every way',
      second: [['@records', null, 781], ['Record by day of week', null, 173, 'dow']],
    },
    Ranks: [['@ledger', null, 534]],
    Games: [['Schedule', 'Stamp In', 660, 'schedule'], ['@grid', null, 1350]],
    Roster: [['Roster', 'preferred lineup', 1379, 'projection'], ['Current Roster', null, 1401, 'roster40'],
      ['Injured List', null, 194, 'illist']],
    Farm: [['Affiliates', null, 569, 'affiliates'], ['On the horizon', null, 1051, 'horizon'],
      ['Prospects', 'org rank', 1197, 'prospects'], ['Depth chart', 'scouting vs. performance', 388, 'depth']],
    About: [['@ballpark', null, 93], ['@jerseys', null, 260], ['@affilhistory', null, 98], ['@alumni', null, 906]],
  },
  675: {
    // No sub-head. Standing at the floor is two cards and answers its question
    // in one screen, so the band has no second section to divide off.
    Standing: { first: [['@standings', null, 428], ['Record by day of week', null, 171, 'dow']], sub: null, second: [] },
    Ranks: [['@ledger', null, 534]],
    Games: [['Schedule', 'Stamp In', 393, 'schedule'], ['@grid', null, 1318]],
    Roster: [['Roster', 'preferred lineup', 1530, 'projection'], ['Current Roster', null, 2387, 'roster40']],
    About: [['@ballpark', null, 91], ['@jerseys', null, 258]],
  },
}

/* The winter club's own roster, off /team/675?d=2026-01-15 — real names, so the
   floor page is drawn with the floor's own content and not Milwaukee's. */
export const WINTER_LINEUP = [
  ['Filia', '7'], ['Martin', '8'], ['Williams', '9'], ['Lugo', '6'],
  ['Rodriguez', '4'], ['Amador', '5'], ['Tomás', '3'], ['Soto', '2'], ['Rehwaldt', 'DH'],
]
export const WINTER_ARMS = [
  ['28', 'Omar Araujo', 'SP'], ['15', 'Darel Torres', 'SP'], ['25', 'Yoanner Negrin', 'SP'],
  ['45', 'Luis Miranda', 'SP'], ['60', 'Manuel Urias', 'SP'], ['41', 'Danis Correa', 'CL'],
]
