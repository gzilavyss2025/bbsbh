// The page's standing front matter — true of every entry, so it lives here
// instead of being repeated in each one. Sibling of
// src/lib/research/diary/standingNotes.js; see that file's own header for
// why this stays a separate module rather than a shared one.
export const HOW_TO_READ = [
  'This is a working notebook, not a report. Entries are dated, newest first, and nothing gets rewritten. When a later pass overturns an earlier one, the old entry stays exactly as it was and the new one says plainly what it takes back.',
  'The question underneath every entry here is the same one: of everything a front office controls or influences, what actually separates the teams that go deep in October from the teams that don’t? Not whether a team wins games in the regular season — how far it gets once it is IN the tournament.',
  'Every entry ends with a list of what is missing from it. In most of them, the missing thing is the likeliest reason the finding is wrong — and for this program in particular, the top of October is a small sample no matter how the data is sliced.',
]

export const TRAPS = [
  {
    id: 'thin-top-rungs',
    title: 'There have been 26 World Series winners since 2000, total',
    body: 'One league of thirty teams sends one team home a champion every year. Any question that slices all the way down to "what did the champion look like" is working with n≈26 across a quarter century, and a single unusual team can move that average a long way. Compare bands — made the LCS or better (n=104) is the most powerful cut available — rather than staking a finding on the champions alone.',
  },
  {
    id: 'three-bracket-shapes',
    title: 'The bracket itself changed shape three times in this window',
    body: 'Straight to the Division Series with one wild card per league (2000-2011), a single win-or-go-home Wild Card game with two per league (2012-2019, 2021), and the current three-per-league Wild Card round (2022+). More playoff spots by itself makes rungs 1-2 easier to reach in the later years — any factor that happens to trend over time will look like it predicts success unless the era is held fixed in the model.',
  },
  {
    id: 'rung-2-empty-pre-2012',
    title: 'Rung 2 of the ladder is empty before 2012, and that is correct',
    body: 'Before 2012 there was no separate Wild Card round — winning your only round put you straight into the LCS. So "won a round but didn’t reach the LCS" could not happen yet. A count of zero there is the bracket format, not a bug in the ladder script.',
  },
  {
    id: 'covid-2020',
    title: '2020 was a 60-game season with double the usual bracket size',
    body: 'Eight teams per league made it instead of the usual five or six, off a season a third the normal length. It is flagged `shortSeason: true` in the ladder data rather than dropped, but any factor measured as a rate over a season, or any comparison that assumes a normal-size field, needs to either exclude it or treat it as its own era.',
  },
  {
    id: 'no-historical-payroll',
    title: 'There is no historical payroll anywhere in this repo',
    body: 'The salary and contract files here are a current-season snapshot, not a time series — the prospect-research diary hit the identical wall. The most obvious alternative explanation for almost any team-success finding — that it is really about money — cannot be tested with what is on hand until a historical payroll source is found. Say so rather than substituting today’s payroll for a team from 2007.',
  },
]
