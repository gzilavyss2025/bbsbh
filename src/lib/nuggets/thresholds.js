// The named season lines a nugget records a player crossing (issue #2809). Data, not
// code: shared by scripts/gen-nuggets.mjs (which dates each crossing) and the app's
// note family (src/api/callout-notes/nugget.js, which words it). A label fix here needs
// no data rewrite, because the store holds only ids, players, dates and counts.
//
// v1: regular-season counting stats, one season (`span: 'season'`), MLB only. Every
// condition in `all` must hold; `stat` is a statsapi gameLog/season counting field of
// the threshold's `group`. A new line is a code review (Gary, 2026-11-03).
//
// `plainMax`: with no anchor, the plain note ("One of 11 pitchers with a shutout")
// still shows when the count is at or under this. Not yet approved by Gary (#2809
// triage); the values are the PR's [DECISION] lines. Starting point 15 (the issue's
// season inference); 10 for the three lines whose 2026 final count passed 15
// (hr20-sb20 17, sb30 16, cg1 21), where a count near 15 is an ordinary year.
export const THRESHOLDS = [
  { id: 'rbi100', group: 'hitting', label: '100 RBI', span: 'season', plainMax: 15, all: [{ stat: 'rbi', min: 100 }] },
  { id: 'rbi100-r100', group: 'hitting', label: '100 runs and 100 RBI', span: 'season', plainMax: 15, all: [{ stat: 'rbi', min: 100 }, { stat: 'runs', min: 100 }] },
  { id: 'hr20-sb20', group: 'hitting', label: '20 home runs and 20 steals', span: 'season', plainMax: 10, all: [{ stat: 'homeRuns', min: 20 }, { stat: 'stolenBases', min: 20 }] },
  { id: 'hr40', group: 'hitting', label: '40 home runs', span: 'season', plainMax: 15, all: [{ stat: 'homeRuns', min: 40 }] },
  { id: 'sb30', group: 'hitting', label: '30 steals', span: 'season', plainMax: 10, all: [{ stat: 'stolenBases', min: 30 }] },
  { id: 'bb90', group: 'hitting', label: '90 walks', span: 'season', plainMax: 15, all: [{ stat: 'baseOnBalls', min: 90 }] },
  { id: 'k200', group: 'pitching', label: '200 strikeouts', span: 'season', plainMax: 15, all: [{ stat: 'strikeOuts', min: 200 }] },
  { id: 'k250', group: 'pitching', label: '250 strikeouts', span: 'season', plainMax: 15, all: [{ stat: 'strikeOuts', min: 250 }] },
  { id: 'sv30', group: 'pitching', label: '30 saves', span: 'season', plainMax: 15, all: [{ stat: 'saves', min: 30 }] },
  { id: 'w15', group: 'pitching', label: '15 wins', span: 'season', plainMax: 15, all: [{ stat: 'wins', min: 15 }] },
  { id: 'sho1', group: 'pitching', label: 'a shutout', span: 'season', plainMax: 15, all: [{ stat: 'shutouts', min: 1 }] },
  { id: 'cg1', group: 'pitching', label: 'a complete game', span: 'season', plainMax: 10, all: [{ stat: 'completeGames', min: 1 }] },
]

// What the note calls the players a group counts.
export const GROUP_NOUN = {
  hitting: { one: 'hitter', many: 'hitters' },
  pitching: { one: 'pitcher', many: 'pitchers' },
}

export const thresholdById = (id) => THRESHOLDS.find((t) => t.id === id) ?? null

// Does a row of summed counting stats meet every condition?
export const meets = (t, sum) => t.all.every((c) => (Number(sum?.[c.stat]) || 0) >= c.min)
