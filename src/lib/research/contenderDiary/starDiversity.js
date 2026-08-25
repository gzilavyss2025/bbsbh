// Diary entry — the third factor spike, WAR concentration (star diversity)
// vs. the outcome ladder. Full method: docs/team-success-star-diversity.md.
export const starDiversityEntry = {
  id: 'star-diversity-v1',
  date: '2026-08-25',
  source: 'Spike #3',
  doc: 'docs/team-success-star-diversity.md',
  title: 'A spread-out lineup gets you into October — a spread-out rotation barely matters',
  verdict: 'holds',
  question:
    'Is a club\'s value piled onto one or two standout players, or shared out across the roster? Does that tell you how far the club goes in October, and does it tell apart the teams that win their division outright from the ones that sneak in on a wild card?',
  headline:
    'On the hitting side, yes, and it is one of the strongest things this program has turned up. The clubs that reached October leaned noticeably less on one or two bats than the clubs that stayed home, and the pattern holds every single time a season is dropped out and the whole thing is run again — 15 tries, 15 times. Do the same work on the pitching staff and it barely registers. Neither side tells a division winner from a wild card. Whatever a spread-out lineup buys you, it buys the ticket in, not the ride once you are there. One louder number, a club\'s count of All-Stars, points the same way, but it is close to circular and should not be leaned on.',
  sections: [
    {
      id: 'the-hitting-signal',
      heading: 'Hitting: a real, sizable effect — mostly about getting in',
      prose: [
        'Picture a club\'s season as a pie made of every bit of value its hitters produced. Some clubs cut that pie into one enormous slice and a lot of crumbs. Others cut fifteen roughly even pieces — and about fifteen hitters is what a typical club\'s value actually comes from. The three measures below all ask the same thing in different ways: how big was the biggest slice, how big were the top two together, and how even was the whole pie.',
      ],
      table: {
        caption: 'Share of hitting value from the top player or top two, by how far a team went',
        columns: ['Team went', 'Top hitter\'s share', 'Top 2 hitters\' share'],
        rows: [
          ['Missed the postseason (296 teams)', '24.8%', '42.2%'],
          ['Made the postseason (154 teams)', '21.6% (a real difference)', '37.6% (a real difference)'],
          ['Reached the League Championship Series or better (60 teams)', '22.3% (not reliably different)', '38.2% (a real, smaller difference)'],
          ['Won the World Series (15 teams)', '22.6% (too few champions to tell)', '38.4% (too few champions to tell)'],
        ],
      },
      proseAfter: [
        'The gap is widest at the line between making it and missing it, and it gets harder to see the deeper a club goes. By the World Series there are only 15 champions in the whole sample, and nothing there can be told apart from noise. That is this program\'s usual problem with the thin top rungs of the ladder. It is not a sign the effect fades away.',
      ],
    },
    {
      id: 'the-pitching-null',
      heading: 'Pitching: the same idea, a much weaker signal',
      prose: [
        'Now run the identical three measures on the pitching staff instead. The tilt against the ladder all but disappears — still leaning the same direction, but so faintly that plain chance could produce it. Only the evenness measure clears the bar for "made it or did not," and even that is a hair of a gap: 0.138 for the clubs that stayed home against 0.131 for the clubs that got in.',
        'Every spike in this program splits hitting from pitching. This one lands the OPPOSITE way from the roster-age spike, where the pitching staff carried the big effect and the lineup carried the small one.',
      ],
    },
    {
      id: 'division-winners',
      heading: 'Does not separate division winners from wild-card teams',
      prose: [
        'Keep only the 154 clubs that reached October. Division winners and wild-card clubs spread their value around to the same degree, near enough that nothing tells them apart, on both sides of the ball. Whatever a spread-out lineup buys, it buys on the way IN. That matches the roster-age spike, and it is the opposite of the homegrown spike, which found nothing about getting in but did separate division winners from wild cards.',
      ],
    },
    {
      id: 'all-star-stretch',
      heading: 'A louder number worth reading with suspicion',
      prose: [
        'One number in this spike shouts louder than anything above: how many All-Stars a club had. It lines up with the ladder far more tightly than any of the pie measures. But think about when All-Stars get picked. They are chosen in July, largely on how well the player and his club are doing that very season. A winning club piling up All-Star nods is close to baked in. So read it as a rough sanity check, not a second witness. Clubs with more All-Stars did spread their hitting value around very slightly more, the same direction as the main finding, but far too faintly to lean on.',
      ],
    },
  ],
  caveats: [
    'Nothing here says one thing caused the other. A spread-out lineup could mean a genuinely deep, well-built roster. Or it could just mean the club never had a true star at all, and its "diversity" is an absence rather than a strength. This spike cannot tell those two stories apart.',
    'The pitching result is a real nothing across the 450 club seasons we had, not proof of an exact zero. The pitching measures missed the usual bar closely enough that a bigger pile of teams could plausibly tip one of them across it.',
    'war-history only covers 2010-2025 — six years short of even the homegrown spike\'s 2004 floor, and sixteen short of the ladder\'s own 2000-2025 window. It is the narrowest sample of any spike in this program so far. Same kind of borrowed-dataset window gap the homegrown spike hit, written down once in standingNotes.js rather than re-explained every time.',
    'The World Series cut (15 champions, 2010-2025) is this program\'s thinnest slice yet — six fewer champions than the roster-age spike had, nine fewer than the homegrown spike. Nothing at that cut can be told apart from noise.',
    'A traded player\'s season value was split between his two clubs by how much he played for each, because war-history carries no team-by-team number at all. That is a reasonable estimate, not a measured fact, and it assumes he was the same player at both stops.',
    'There is no way to account for payroll anywhere in this program yet, the same gap every other spike has.',
  ],
  open: [
    'A postseason-actual reweighting — whether the men who actually took the field in October were a more or less top-heavy group than the full-season roster, the same follow-up the homegrown and roster-age spikes both ran.',
    'A joint look at roster age and homegrown share alongside this one. Three spikes in, all three found something on the hitting side and on the getting-in cut, and little on the pitching or division-winner cuts. Whether that is three separate signals or one underlying trait wearing three hats is still open.',
    'Extending war-history\'s own pull back before 2010, closing this spike\'s season-window gap with the rest of the program.',
  ],
  technical: [
    'top1Share/top2Share/hhi: computed over each team-season\'s players with POSITIVE credited WAR only, split hitting vs. pitching. hhi is a Herfindahl-style index (sum of each positive-WAR player\'s share of team positive WAR, squared). Credited WAR comes from public/data/war-history (season totals, personId-keyed — the FanGraphs-sourced shards this repo carried as its WAR source when the spike ran, replaced in the same deployment by the MLB stats=sabermetrics calculation; the two correlate at 0.998, so no finding here moves, but the figures will not reproduce exactly off the current file) joined against roster-age-cache.json (spike #1\'s teamId-filtered roster/playing-time cache); a player who split a season between two teams has his war-history WAR prorated by playing-time share at each stop, since war-history carries no team attribution at all (new trap, standingNotes.js: traded-player-war-has-no-team-split).',
    '450 team-seasons (2010-2025, 2020 excluded; 480 with 2020 included, no meaningful change). WAR coverage: 32,292/32,292 player-roster-slot references resolved (100%) — no team-season excluded for lacking a positive-WAR player.',
    'Spearman rho vs. the 0-5 ladder — hitting: top1Share -0.1907, top2Share -0.2260, hhi -0.2241 (all permutation p=0.0000, 5,000 within-season shuffles, same sign in 15/15 leave-one-season-out refits). Pitching: top1Share -0.0548 (p=0.2518), top2Share -0.0433 (p=0.3904), hhi -0.0680 (p=0.1888), same sign in 15/15 leave-one-season-out refits despite not clearing p<0.05.',
    'Band-difference permutation p-values (hitting): made postseason vs. not, p=0.0000 (all three measures); LCS+ vs. not, p=0.0870 (top1Share, not significant) / 0.0194 (top2Share) / 0.0208 (hhi); WS winner vs. not, p=0.54/0.30/0.39 (n=15, null). Pitching: made postseason vs. not, p=0.0746 (top1Share) / 0.1868 (top2Share) / 0.0260 (hhi); LCS+ and WS cuts all null.',
    'Division winner vs. wild card among the 154 postseason teams: all six comparisons (three measures x two sides of the ball) null, p=0.19-0.98.',
    'STRETCH — All-Star count (starters + bullpen + substitutes, both leagues, per team-season): Spearman rho=0.5568 vs. the ladder (permutation p=0.0000, same sign in 15/15 leave-one-season-out refits). wonDivision comparison null (3.98 vs. 3.70, p=0.3354). Reference check, hitting top1Share vs. All-Star count on the same team-seasons: rho=-0.0859 (not a hypothesis test).',
    'Including the pandemic-shortened, 16-team 2020 field (n=480) changes every figure above by well under a point, no sign flips; pitching hhi moves closest to significance (p=0.0612 vs. 0.1888 excluding 2020) but still does not clear the conventional bar.',
    'Prose-to-formal map for this entry: the pitching section\'s "all but disappears" is the pitching rho range of -0.04 to -0.07 (p=0.19 to 0.39); its "hair of a gap" is the pitching hhi band means, 0.138 (missed the postseason) vs. 0.131 (made it), the only pitching band comparison to clear 0.05 (p=0.0260). The All-Star section\'s "shouts louder" is rho=0.5568 against a best-in-spike hitting concentration rho of -0.2260, and its "very slightly more spread out" is the reference check at rho=-0.0859. The hitting section\'s "about fifteen hitters" is the typical count of positive-WAR hitters per team-season, the denominator all three concentration measures are computed over.',
    'Circularity of the All-Star stretch number, stated formally: All-Star selection occurs mid-season and is driven in part by team standing and by playing time already accumulated, so All-Star count is not independent of the outcome it is being compared against. It is reported as a face-validity check on the concentration measures, not as confirmatory evidence.',
  ],
}
