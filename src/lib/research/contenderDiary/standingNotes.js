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
    id: 'traded-player-collapses-to-last-team',
    title: 'The team-season stats endpoint, called without a team filter, lies about traded players',
    body: 'Ask statsapi for a whole season\'s hitting or pitching stats with no team filter, and a player traded mid-season shows up ONCE, credited entirely to his LAST team, with his combined season total — Lucas Giolito\'s 2023 (White Sox to Angels to Guardians) reads as a Guardian with his full 184⅓ innings. Filtering the identical call by `teamId` fixes it: the same query scoped to Chicago returns his actual White Sox stint, 121 innings. Any factor spike that sweeps a team\'s roster for a season needs the teamId-filtered call, never the league-wide one, or it will silently hand a player\'s whole year to whichever club happened to employ him last.',
  },
  {
    id: 'postseason-share-needs-a-volume-control',
    title: 'A "share of postseason activity" is secretly a measure of how far a team went',
    body: 'How many games a team played in October correlates with the outcome ladder at rho=0.91 — of course it does, winning more rounds IS playing more games. So anything expressed as a SHARE of a team\'s postseason playing time carries that same relationship built in before it measures anything else, and a raw correlation against the ladder will pick that up. One draft finding here looked like "leaning on surprise contributors costs you games" (rho=−0.43) and, once corrected for how many innings a team actually played, turned out to run the OTHER way (partial rho=+0.22). Any future measure built on postseason shares needs the same control, or it will report the mechanical version of itself.',
  },
  {
    id: 'no-historical-payroll',
    title: 'There is no historical payroll anywhere in this repo',
    body: 'The salary and contract files here are a current-season snapshot, not a time series — the prospect-research diary hit the identical wall. The most obvious alternative explanation for almost any team-success finding — that it is really about money — cannot be tested with what is on hand until a historical payroll source is found. Say so rather than substituting today’s payroll for a team from 2007.',
  },
  {
    id: 'reused-panels-have-their-own-season-window',
    title: 'A dataset built for a different research program may not cover this program’s full window',
    body: 'The homegrown-dependence classifier (docs/homegrown-dependence.md) was built for the prospect-development diary, on its own season floor and ceiling — 2004-2023, not this program’s 2000-2025. Joining a reused panel like that against the outcome ladder silently drops whatever seasons sit outside its window; the join does not error, it just produces a smaller n than the ladder’s own 780 team-seasons. Any future spike that reuses a dataset built for a different program needs to check that dataset’s own season range before trusting the joined sample size, and say the smaller n out loud rather than let a reader assume full coverage.',
  },
  {
    id: 'traded-player-war-has-no-team-split',
    title: 'A player traded mid-season has ONE combined-season WAR number, not two team-specific ones',
    body: 'public/data/war-history (src/api/war.js) carries no team attribution at all — a player traded mid-season gets a single WAR figure for his WHOLE season, wherever he ended up. The roster cache built for the age spike (roster-age-cache.json) correctly splits a traded player\'s playing time between his two teams (verified against Troy Tulowitzki\'s 2015 Rockies-to-Blue-Jays trade: 351 plate appearances at Colorado, 183 at Toronto, matching his real stint split). Join those two datasets naively — crediting his full combined-season WAR to BOTH teams — and a traded star\'s value gets double-counted, inflating both rosters\' apparent star power. The fix used in docs/team-success-star-diversity.md: prorate his season WAR by playing-time share at each team (his weight there ÷ his total weight across every team that season), so the pieces sum back to his real total. Any future spike joining war-history against a team-level roster needs the same proration, or a traded player will silently count twice.',
  },
]
