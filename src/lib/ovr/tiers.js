// The OVR tiers (docs/ovr-rating.md, "The card"). ONE constant, so Gary can retune the
// cut points after the real spread: hitters mean 58.0 / SD 9.9, pitchers 58.9 / 10.5.
// PLACEHOLDERS. The names are ours: the spec forbids The Show's tier names, so there is
// no Bronze, Silver, Gold or Diamond here. `lo` is the first rating in the tier, in order.
export const TIERS = [
  { key: 'bench', name: 'Bench', lo: 20 },
  { key: 'starter', name: 'Starter', lo: 45 },
  { key: 'regular', name: 'Regular', lo: 60 },
  { key: 'allstar', name: 'All-Star', lo: 70 },
  { key: 'mvp', name: 'MVP', lo: 80 },
  { key: 'legend', name: 'Legend', lo: 90 },
]

// The highest tier whose first rating is at or under `ovr`; a value off the band takes the nearest end.
export const tierFor = (ovr) => TIERS.findLast((t) => ovr >= t.lo) ?? TIERS[0]
