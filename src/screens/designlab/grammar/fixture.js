// Invented data for the shared-grammar directions. A made-up pitcher and a
// made-up club: no real player, no score, no API call. Every direction draws
// these same rows, so the eye can compare grammar and nothing else.

// Season tiles. `rank` is "n of N", never an ordinal or a hash (design.md §14.B).
export const TILES = [
  { label: 'ERA', value: '3.12', rank: [14, 89], pct: 84 },
  { label: 'WHIP', value: '1.08', rank: [11, 89], pct: 88 },
  { label: 'K/9', value: '10.4', rank: [9, 89], pct: 90 },
  { label: 'IP', value: '154.1', rank: [31, 89], pct: 66 },
]

// Statcast percentile rows: the bar is the percentile, the figure is the stat.
export const PCT_ROWS = [
  { label: 'Fastball velo', value: '97.4', pct: 91 },
  { label: 'Whiff rate', value: '29.8%', pct: 78 },
  { label: 'Chase rate', value: '31.2%', pct: 64 },
  { label: 'Barrel rate against', value: '8.9%', pct: 23 },
  { label: 'xERA', value: '3.41', pct: 70 },
]

// Pitch mix. Shares sum to 100.
export const MIX = [
  { label: 'FF', name: 'Four-seam', share: 44 },
  { label: 'SL', name: 'Slider', share: 26 },
  { label: 'CH', name: 'Change', share: 18 },
  { label: 'CU', name: 'Curve', share: 12 },
]

export const REGISTER = [
  { yr: '2026', tm: 'SMP', ip: '154.1', era: '3.12', k: 178, bb: 41 },
  { yr: '2025', tm: 'SMP', ip: '171.0', era: '3.48', k: 169, bb: 52 },
  { yr: '2024', tm: 'SMP', ip: '98.2', era: '4.02', k: 101, bb: 39 },
  { yr: 'Career', tm: '', ip: '423.4', era: '3.54', k: 448, bb: 132 },
]

// Team rank tiles.
export const TEAM_TILES = [
  { label: 'Runs/G', value: '4.9', rank: [6, 30], pct: 83 },
  { label: 'RA/G', value: '4.1', rank: [9, 30], pct: 73 },
  { label: 'Win %', value: '.563', rank: [7, 30], pct: 80 },
  { label: 'Run diff', value: '+64', rank: [8, 30], pct: 77 },
]

// Last ten, oldest first. true = win.
export const FORM = [true, true, false, true, false, false, true, true, false, true]

export const STANDINGS = [
  { club: 'Harbor', w: 84, l: 55, pct: '.604', gb: '—' },
  { club: 'Sample Club', w: 78, l: 61, pct: '.561', gb: '6.0', own: true },
  { club: 'Lakeside', w: 74, l: 65, pct: '.532', gb: '10.0' },
  { club: 'Prairie', w: 69, l: 70, pct: '.496', gb: '15.0' },
  { club: 'Summit', w: 61, l: 78, pct: '.439', gb: '23.0' },
]

// Share of run value by source, this club against the league. Shares sum to 100.
export const SPLIT = [
  { label: 'Hitting', share: 46, lg: 41 },
  { label: 'Pitching', share: 33, lg: 36 },
  { label: 'Defence', share: 12, lg: 14 },
  { label: 'Running', share: 9, lg: 9 },
]

// One block per direction. Same eleven fields each, so they read side by side.
export const DIRECTIONS = [
  {
    id: 'box',
    tableHead: 'Graphite capitals on a hairline, right-aligned except the first cell. Same as today’s standings.',
    name: 'Box Score',
    why: 'The quietest. A printed box score has no colour, so the figures do the talking and the bar is only a rule that has length.',
    track: '4px high, square ends, hairline track, fill from the left edge.',
    ramp: 'Navy only (--accent-primary). League average is a graphite tick. Good, bad and tier have no colour.',
    number: 'Right-aligned mono figure in a fixed column at the row end.',
    label: 'Condensed capitals, graphite, left, 12px.',
    ticks: 'One tick at the league median. No axis, no grid.',
    tile: 'No box. A hairline over the label, the figure under it, the rank under that.',
    head: 'Graphite capitals on a hairline (SectionHead look “label”). No fill.',
    rank: '“14 of 89” in 11px graphite mono under the figure. No chip.',
    charts: 'Keeps all five marks and shares the rules above. The stacked bar gets a legend with figures under it. The form rail is ten navy squares, filled for a win and hollow for a loss.',
  },
  {
    id: 'attr',
    tableHead: 'Ink fill row, paper capitals. The table reads as a stat sheet.',
    name: 'Attribute Screen',
    why: 'Taken from the OVR tile and a sports game’s attribute screen: a ten-notch gauge, a big number on an ink plate, and a tier colour you can read at a glance.',
    track: '12px high, square ends, ten notches on the track.',
    ramp: 'Fill by tier from the OVR tokens: bench, starter, regular, all-star, MVP. Navy for identity. Clay and green only on the form rail.',
    number: 'Display figure on a square ink plate at the row start, so every number lines up in one left column.',
    label: 'Condensed capitals, ink, above the gauge.',
    ticks: 'Notches every 10 points. League median is one heavy tick.',
    tile: 'A framed plate: 2px ink frame, big display figure, label, then the rank chip.',
    head: 'House band (SectionHead look “band”): ink fill, paper capitals.',
    rank: '“14 of 89” on a --marker chip. The chip is the only place --marker is a fill.',
    charts: 'Replaces every mark with the gauge: the dot rail, the stacked bar and the percentile row all become notched gauges. Form rail is ten plates, green for a win and clay for a loss.',
  },
  {
    id: 'rule',
    tableHead: 'Graphite capitals over a 2px ink rule (the scorebook’s heavy line). Row rules are dotted.',
    name: 'Pencil Rule',
    why: 'A scorebook is ruled paper with marks on it. The track is the rule, the value is a dot on the rule, and nothing is boxed.',
    track: '2px rule, no radius. The value is an 8px round dot on the rule (--radius-pill is the only round end).',
    ramp: 'Ink dot for this subject, graphite ring for the league. Navy for identity. No tier colour.',
    number: 'Mono figure hung right of the rule, in the margin.',
    label: 'Condensed capitals, graphite, left, with a dotted underline.',
    ticks: 'Quarter ticks (25, 50, 75) as 6px pencil marks. League median is the graphite ring.',
    tile: 'A ruled cell: heavy rule above, figure in display type, label beside it.',
    head: 'Label, then a pencil rule running to the note (SectionHead look “rule”).',
    rank: '“14 of 89” under the figure in graphite mono. No chip.',
    charts: 'Replaces the bars with the dot-on-a-rule. The stacked bar becomes a segmented rule with gaps. Form rail is ten dots on one rule: filled for a win, ringed for a loss.',
  },
  {
    id: 'vs',
    tableHead: 'Graphite capitals on a hairline. The own-club row carries a navy edge.',
    name: 'Versus League',
    why: 'Every bar starts at the league average and runs left (worse) or right (better). The reader sees “better or worse than the field” before reading a figure.',
    track: '8px high, 2px radius (--radius-xs on the outer ends), a heavy centre line at league average.',
    ramp: 'Right of centre is --accent-positive (green). Left of centre is --accent-negative (clay). Identity is navy. Neutral is hairline.',
    number: 'Signed figure right-aligned at the row end, with the raw stat in graphite beside it.',
    label: 'Condensed capitals, ink, left, 12px.',
    ticks: 'The centre line is the one tick. Ends are labelled “worse” and “better” once, at the head.',
    tile: 'Figure, then a signed delta against the league, then a mini diverging bar.',
    head: 'Graphite capitals on a hairline (SectionHead look “label”), with a “vs league” note.',
    rank: '“14 of 89” in 11px graphite mono beside the delta.',
    charts: 'Replaces the stacked bar with diverging rows (share minus league share). Keeps the percentile row, now diverging. Form rail is a win/loss sparkline: wins rise from the baseline, losses fall.',
  },
]
