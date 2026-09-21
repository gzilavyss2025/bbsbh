// THE REAL CONTENT OF THE STANDING BAND, scraped off the running dev server on
// 2026-09-21 with ../scrape-standing.mjs. The canvas draws these values, not
// placeholders: placeholder rows hide the crowding that is the whole problem in
// this band, and Records has to be drawn at its true 3,238px.
//
// Records holds THREE different row shapes and that matters to the drawing:
//   - 61 W-L split rows, every one a door to /situational-records  (the "61 rows")
//   - one 10x2 by-inning table, which is not a row list at all
//   - 18 plain season counts, a number and a label, no W-L — but they ARE doors:
//     SeasonCounts renders each as a <button> to situationalRecordsPath
//     (RecordsCard.jsx:75). An earlier note here said otherwise and was wrong.

export const TOKENS = {
  paper0: '#F6EFDC', paper2: '#FBF6E9', paper3: '#FFFDF6',
  ink0: '#0F1822', ink1: '#1B2A3A', ink2: '#3C4A5A',
  graphite: '#6B6558', graphiteSoft: '#938C7C',
  rule: '#CBC1A7', ruleSoft: '#DED6C0', ruleGrid: '#EDE6D1',
  field: '#2F6E4F', fieldSoft: '#E3EDE2',
  clay: '#B4453A', claySoft: '#F3E0DB',
  navy: '#1B2A3A', seal: '#B5824A', marker: '#E9C33F',
  shadowCard: '0 1px 2px rgba(22,34,47,.08), 0 4px 12px rgba(22,34,47,.06)',
}

// Computed off the live page with ../computed.mjs. 675 is UNTHEMED — headerThemeFor
// returns null for it, so its card head is graphite on transparent with a hairline.
export const CLUBS = {
  158: { name: 'Milwaukee Brewers', bar: '#12284B', accent: '#A6801F', onBar: '#F8F8F5', themed: true },
  249: { name: 'Wilson Warbirds', bar: '#00274d', accent: '#98002e', onBar: '#FFFFFF', themed: true },
  675: { name: 'Caneros de los Mochis', bar: null, accent: null, onBar: null, themed: false },
}

export const STANDINGS_158 = {
  head: 'National League Central', pill: 'Postseason Odds',
  cols: ['Team', 'W', 'L', 'GB', 'Streak', 'L10'],
  rows: [
    ['Brewers', '98', '58', '-', 'W3', '8-2', true],
    ['Cubs', '87', '69', '11.0', 'W2', '6-4', false],
    ['Pirates', '79', '77', '19.0', 'W4', '6-4', false],
    ['Cardinals', '76', '80', '22.0', 'W1', '4-6', false],
    ['Reds', '72', '84', '26.0', 'L2', '3-7', false],
  ],
}

export const STANDINGS_249 = {
  head: 'Carolina League North', pill: null,
  cols: ['Team', 'W', 'L', 'GB', 'Streak', 'L10'],
  rows: [
    ['Nationals', '80', '51', '-', 'W7', '8-2', false],
    ['Woodpeckers', '71', '58', '8.0', 'L5', '5-5', false],
    ['Warbirds', '64', '66', '15.5', 'L12', '0-10', true],
    ['Ridgeyaks', '56', '75', '24.0', 'L1', '4-6', false],
    ['Howlers', '56', '75', '24.0', 'W1', '5-5', false],
    ['Shorebirds', '45', '87', '35.5', 'L1', '3-7', false],
  ],
}

export const TEAM_SCORE = {
  head: 'Season report', note: 'How this is calculated',
  rows: [
    { label: 'Season Grade', caption: 'The class of the league', rank: '1 of 30', score: '9.4', of: '/10', filled: 30 },
    { label: 'Last 10', caption: 'On one of those runs', rank: '3 of 30', score: '8.5', of: '/10', filled: 28 },
  ],
}

// Every W-L split row, in document order, exactly as the card renders them.
export const RECORDS_TABS = ['Full season', 'Pre-All-Star', 'Post-All-Star']

export const RECORDS = {
  head: 'Records', note: '156 games · win pct',
  tabs: RECORDS_TABS,
  months: ['All', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  groups: [
    { name: 'Scoring', rows: [
      ['Scoring first', '64-23', '.736'], ['Opponent scores first', '34-35', '.493'],
      ['Scoring 4+ runs', '82-14', '.854'], ['Scoring 3 or fewer', '16-44', '.267'],
    ] },
    { name: 'Scoring by inning', sub: 'W-L, win pct, and the last time it happened.', innings: [
      ['1st', '11-4', '.733', 'Sep 5 L', '24-8', '.750', 'Sep 12 W'],
      ['2nd', '21-6', '.778', 'Sep 20 W', '17-6', '.739', 'Sep 13 L'],
      ['3rd', '13-8', '.619', 'Sep 5 L', '12-3', '.800', 'Sep 12 W'],
      ['4th', '14-8', '.636', 'Sep 20 W', '21-5', '.808', 'Sep 12 W'],
      ['5th', '15-8', '.652', 'Sep 16 W', '14-8', '.636', 'Sep 12 W'],
      ['6th', '12-5', '.706', 'Sep 17 L', '21-6', '.778', 'Sep 9 W'],
      ['7th', '18-8', '.692', 'Sep 20 W', '18-6', '.750', 'Sep 13 L'],
      ['8th', '14-6', '.700', 'Sep 17 L', '21-4', '.840', 'Sep 11 W'],
      ['9th', '12-8', '.600', 'Sep 18 W', '3-3', '.500', 'Sep 8 W'],
      ['Extras', '11-3', '.786', 'Sep 18 W', '', '', ''],
    ] },
    { name: 'Hits and homers', rows: [
      ['Out-hitting opponent', '70-15', '.824'], ['Out-hit by opponent', '15-38', '.283'],
      ['Hit totals even', '13-5', '.722'], ['10 or more hits', '53-11', '.828'],
      ['Hitting a home run', '64-29', '.688'], ['Not hitting a home run', '34-29', '.540'],
      ['Hitting 2+ homers', '30-10', '.750'], ['Opponent homers', '51-46', '.526'],
      ['Opponent held homerless', '47-12', '.797'], ['Opponent hits 2+ homers', '15-27', '.357'],
    ] },
    { name: 'Defense', rows: [
      ['Committing an error', '31-26', '.544'], ['Committing no errors', '67-32', '.677'],
    ] },
    { name: 'Leading and trailing', rows: [
      ['Leading after 6 innings', '69-11', '.863'], ['Trailing after 6 innings', '13-45', '.224'],
      ['Tied after 6 innings', '16-2', '.889'], ['Leading after 7 innings', '75-5', '.938'],
      ['Trailing after 7 innings', '11-47', '.190'], ['Tied after 7 innings', '12-6', '.667'],
      ['Leading after 8 innings', '84-3', '.966'], ['Trailing after 8 innings', '4-49', '.075'],
      ['Tied after 8 innings', '10-6', '.625'],
    ] },
    { name: 'Close games', rows: [
      ['One-run games', '26-20', '.565'], ['Two-run games', '16-12', '.571'],
      ['Extra innings', '11-5', '.688'], ['Decided in last at-bat', '14-10', '.583'],
      ['Walk-off games', '6-4', '.600'],
    ] },
    { name: 'Starting pitching', rows: [
      ['Quality start', '38-14', '.731'], ['Starter goes 6+ innings', '38-15', '.717'],
      ['Starter goes under 6', '60-43', '.583'], ['Opposing starter 6+', '23-23', '.500'],
      ['Opposing starter under 6', '75-35', '.682'], ['Faced an opener', '4-0', '1.000'],
      ['Starter exits before 2 innings', '2-1', '.667'], ['Opposing starter exits before 2', '1-0', '1.000'],
      ['Vs. right-handed starter', '63-44', '.589'], ['Vs. left-handed starter', '35-14', '.714'],
    ] },
    { name: 'Schedule', rows: [
      ['Day games', '34-24', '.586'], ['Night games', '64-34', '.653'],
      ['Doubleheaders', '3-3', '.500'], ['Series opener', '36-15', '.706'],
      ['Series finale', '29-22', '.569'], ['Getaway day', '20-19', '.513'],
    ] },
    { name: 'By month', rows: [
      ['March', '4-1', '.800'], ['April', '12-13', '.480'], ['May', '19-7', '.731'],
      ['June', '17-10', '.630'], ['July', '16-10', '.615'], ['August', '17-12', '.586'],
      ['September', '13-5', '.722'],
    ] },
    { name: 'By division', rows: [
      ['Vs. American League Central', '12-6', '.667'], ['Vs. American League East', '11-4', '.733'],
      ['Vs. American League West', '9-6', '.600'], ['Vs. National League Central', '32-17', '.653'],
      ['Vs. National League East', '16-11', '.593'], ['Vs. National League West', '18-14', '.563'],
    ] },
    { name: 'By league', rows: [
      ['Vs. American League', '32-16', '.667'], ['Vs. National League', '66-42', '.611'],
    ] },
    { name: 'Season counts', counts: [
      ['41', 'Wins after trailing'], ['28', 'Losses after leading'], ['12', 'Shutouts thrown'],
      ['6', 'Times shut out'], ['6', 'Walk-off wins'], ['4', 'Walk-off losses'],
      ['16', 'Times batted around'], ['10', 'Series sweeps'], ['3', 'Series swept'],
      ['35', 'Series wins'], ['12', 'Series losses'], ['5', 'Longest win streak'],
      ['6', 'Longest losing streak'], ['135', 'Days in 1st place'], ['9', 'Days in 2nd place'],
      ['8', 'Days in 3rd place'], ['13', 'Days in 4th place'], ['7', 'Days in 5th place'],
    ] },
  ],
}

// Wilson's own Records card, scraped the same way. Kept separate rather than
// reusing Milwaukee's because the reduced-band artboard would otherwise print a
// 98-58 club's splits on a 64-66 club — and because the MiLB card is not just
// smaller, it is a different SHAPE in three ways the drawing has to hold:
//   - a record can carry a TIE and become three parts: 49-56-1, not 64-23. The
//     mono figure column has to be sized for it. MLB rows never are.
//   - "By league" does not exist, and "By division" is two rows, not six
//   - "Started a game with an opener" is a row MLB does not have
export const RECORDS_249 = {
  head: 'Records', note: '132 games · win pct',
  tabs: RECORDS_TABS, months: ['All', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  groups: [
    { name: 'Scoring', rows: [
      ['Scoring first', '31-22', '.585'], ['Opponent scores first', '33-44', '.429'],
      ['Scoring 4+ runs', '58-25', '.699'], ['Scoring 3 or fewer', '6-41-2', '.128'],
    ] },
    { name: 'Scoring by inning', sub: 'W-L, win pct, and the last time it happened.', innings: [
      ['1st', '6-8', '.429', 'Sep 3 L', '17-6', '.739', 'Aug 16 W'],
      ['2nd', '7-9', '.438', 'Sep 4 L', '9-7', '.563', 'Aug 29 L'],
      ['3rd', '14-8', '.636', 'Sep 2 L', '15-6', '.714', 'Aug 29 L'],
      ['4th', '9-12', '.429', 'Sep 1 L', '19-10', '.655', 'Aug 29 L'],
      ['5th', '12-8', '.600', 'Aug 22 L', '14-7', '.667', 'Aug 28 L'],
      ['6th', '9-7', '.563', 'Sep 5 L', '13-7', '.650', 'Aug 29 L'],
      ['7th', '13-6', '.684', 'Aug 20 W', '17-10', '.630', 'Aug 30 L'],
      ['8th', '9-10', '.474', 'Sep 2 L', '18-4', '.818', 'Aug 30 L'],
      ['9th', '10-13', '.435', 'Sep 6 L', '5-5', '.500', 'Aug 29 L'],
      ['Extras', '8-0', '1.000', 'Aug 14 W', '', '', ''],
    ] },
    { name: 'Hits and homers', rows: [
      ['Out-hitting opponent', '38-8', '.826'], ['Out-hit by opponent', '20-55', '.267'],
      ['Hit totals even', '6-3-2', '.667'], ['10 or more hits', '19-8', '.704'],
      ['Hitting a home run', '49-28', '.636'], ['Not hitting a home run', '15-38-2', '.283'],
      ['Hitting 2+ homers', '20-6', '.769'], ['Opponent homers', '37-44', '.457'],
      ['Opponent held homerless', '27-22-2', '.551'], ['Opponent hits 2+ homers', '9-17', '.346'],
    ] },
    { name: 'Defense', rows: [
      ['Committing an error', '36-45', '.444'], ['Committing no errors', '28-21-2', '.571'],
    ] },
    { name: 'Leading and trailing', rows: [
      ['Leading after 6 innings', '45-4', '.918'], ['Trailing after 6 innings', '9-53', '.145'],
      ['Tied after 6 innings', '10-9', '.526'], ['Leading after 7 innings', '50-2', '.962'],
      ['Trailing after 7 innings', '3-57', '.050'], ['Tied after 7 innings', '11-7', '.611'],
      ['Leading after 8 innings', '52-1', '.981'], ['Trailing after 8 innings', '0-58', '.000'],
      ['Tied after 8 innings', '11-1', '.917'],
    ] },
    { name: 'Close games', rows: [
      ['One-run games', '18-14', '.563'], ['Two-run games', '10-10', '.500'],
      ['Extra innings', '8-2', '.800'], ['Decided in last at-bat', '14-7', '.667'],
      ['Walk-off games', '13-3', '.813'],
    ] },
    { name: 'Starting pitching', rows: [
      ['Quality start', '6-2', '.750'], ['Starter goes 6+ innings', '6-3', '.667'],
      ['Starter goes under 6', '58-63', '.479'], ['Opposing starter 6+', '3-11', '.214'],
      ['Opposing starter under 6', '61-55', '.526'], ['Started a game with an opener', '4-0', '1.000'],
      ['Faced an opener', '2-1', '.667'], ['Starter exits before 2 innings', '1-5', '.167'],
      ['Opposing starter exits before 2', '7-2', '.778'], ['Vs. right-handed starter', '54-49', '.524'],
      ['Vs. left-handed starter', '10-17', '.370'],
    ] },
    { name: 'Schedule', rows: [
      ['Day games', '15-10-1', '.600'], ['Night games', '49-56-1', '.467'],
      ['Doubleheaders', '1-4-1', '.200'], ['Series opener', '14-10', '.583'],
      ['Series finale', '14-9-1', '.609'], ['Getaway day', '13-8-1', '.619'],
    ] },
    { name: 'By month', rows: [
      ['April', '9-15', '.375'], ['May', '17-10', '.630'], ['June', '15-10', '.600'],
      ['July', '11-12-1', '.478'], ['August', '12-13', '.480'], ['September', '0-6-1', '.000'],
    ] },
    { name: 'By division', rows: [
      ['Vs. Carolina League North', '47-44-2', '.516'], ['Vs. Carolina League South', '17-22', '.436'],
    ] },
    { name: 'Season counts', counts: [
      ['39', 'Wins after trailing'], ['28', 'Losses after leading'], ['5', 'Shutouts thrown'],
      ['8', 'Times shut out'], ['13', 'Walk-off wins'], ['3', 'Walk-off losses'],
      ['17', 'Times batted around'], ['0', 'Series sweeps'], ['2', 'Series swept'],
      ['8', 'Series wins'], ['6', 'Series losses'], ['5', 'Longest win streak'],
      ['12', 'Longest losing streak'], ['1', 'Days in 1st place'], ['76', 'Days in 2nd place'],
      ['29', 'Days in 3rd place'], ['20', 'Days in 4th place'], ['5', 'Days in 5th place'],
    ] },
  ],
}

export const DOW_249 = {
  head: 'Record by day of week', note: 'win pct',
  rows: [['Sun', '9-10', '.474'], ['Mon', '2-3', '.400'], ['Tue', '11-11', '.500'],
    ['Wed', '10-12', '.455'], ['Thu', '9-10-1', '.474'], ['Fri', '12-10', '.545'],
    ['Sat', '11-10-1', '.524']],
}

export const DOW = {
  head: 'Record by day of week', note: 'win pct',
  rows: [['Sun', '14-12', '.538'], ['Mon', '10-6', '.625'], ['Tue', '18-6', '.750'],
    ['Wed', '14-10', '.583'], ['Thu', '9-6', '.600'], ['Fri', '17-6', '.739'], ['Sat', '16-12', '.571']],
}

export const COMEBACKS = {
  head: 'Comeback wins', note: 'all 30 teams',
  blurb: 'How often they rallied to win after their chance of winning the game sank this low. Each rail plots all 30 clubs from 0% to the MLB leader; the ring is this club, and the tick is the MLB average.',
  rails: [
    { label: 'Down to ≤10%', pct: '9%', rank: '6 of 64', avg: 'MLB avg 6%', lo: '0%', hi: '13%', at: 69, avgAt: 46 },
    { label: 'Down to ≤20%', pct: '18%', rank: '13 of 71', avg: 'MLB avg 14%', lo: '0%', hi: '22%', at: 82, avgAt: 64 },
    { label: 'Down to ≤30%', pct: '34%', rank: '30 of 88', avg: 'MLB avg 22%', lo: '0%', hi: '34%', at: 100, avgAt: 65 },
  ],
}

// The number of W-L door rows, counted off the groups above. The brief's "61
// rows" is exactly the door rows: the inning table and the season counts are
// different shapes and are not doors.
export const DOOR_ROWS = RECORDS.groups
  .filter((g) => g.rows)
  .reduce((n, g) => n + g.rows.length, 0)
