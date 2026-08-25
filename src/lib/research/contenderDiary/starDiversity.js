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
    'Is a team\'s on-field value concentrated in one or two standout players, or spread across the roster? Does that concentration predict how far a team goes in the postseason, and does it separate the teams that win their division outright from the ones that sneak in on a wild card?',
  headline:
    'On the hitting side, yes, and it is one of the strongest signals this program has found: teams that made the postseason had noticeably LESS of their hitting value riding on one or two players than teams that missed it, and the correlation against the full ladder holds up in every one of 15 leave-one-season-out refits. On the pitching side, the same measures barely move the needle. Neither side separates division winners from wild-card teams — the effect, where it exists, buys a team its ticket in, not how far it goes once it\'s there. A louder, shakier stretch number (All-Star count) points the same direction but is likely circular and shouldn\'t be leaned on.',
  sections: [
    {
      id: 'the-hitting-signal',
      heading: 'Hitting: a real, sizable effect — mostly about getting in',
      prose: [
        'Every measure below looks at how much of a team\'s POSITIVE hitting WAR came from its single best hitter, its top two, or a concentration index across everyone with positive value. A typical team gets its hitting value from about 15 players in a season; these measures ask how evenly that value was actually spread among them.',
      ],
      table: {
        caption: 'Share of hitting value from the top player or top two, by how far a team went',
        columns: ['Team went', 'Top hitter\'s share', 'Top 2 hitters\' share'],
        rows: [
          ['Missed the postseason (296 teams)', '24.8%', '42.2%'],
          ['Made the postseason (154 teams)', '21.6% (a real difference)', '37.6% (a real difference)'],
          ['Reached the LCS or better (60 teams)', '22.3% (not reliably different)', '38.2% (a real, smaller difference)'],
          ['Won the World Series (15 teams)', '22.6% (too few champions to tell)', '38.4% (too few champions to tell)'],
        ],
      },
      proseAfter: [
        'The gap is biggest at the "made it or didn\'t" line and gets harder to see the deeper a team goes — by the World Series, with only 15 champions in the sample, nothing can be told apart from noise. That is this program\'s usual thin-top-rungs problem, not a sign the effect fades away.',
      ],
    },
    {
      id: 'the-pitching-null',
      heading: 'Pitching: the same idea, a much weaker signal',
      prose: [
        'Run the identical three measures on pitching WAR instead of hitting WAR, and the correlation against the full ladder drops to rho=−0.04 to −0.07 — small, and not distinguishable from chance at conventional standards (permutation p=0.19 to 0.39). Only the concentration index clears the bar for "made the postseason at all," and even that is a small difference (0.138 vs. 0.131).',
        'This is the same hitting/pitching split every spike in this program has run — but it lands the OPPOSITE way from the roster-age spike, where pitching carried the bigger effect and hitting the smaller one.',
      ],
    },
    {
      id: 'division-winners',
      heading: 'Does not separate division winners from wild-card teams',
      prose: [
        'Restricted to the 154 clubs that already made the postseason, division winners and wild-card teams had statistically indistinguishable concentration on both sides of the ball. Whatever a spread-out lineup buys, it buys on the way IN — matching the roster-age spike\'s pattern, and the opposite of the homegrown spike, which found nothing about "made it" but did separate division winners from wild-card teams.',
      ],
    },
    {
      id: 'all-star-stretch',
      heading: 'A louder number worth reading with suspicion',
      prose: [
        'A team\'s count of All-Star selections correlates with the ladder far more strongly (rho=0.56) than any concentration measure above — but All-Star selection happens mid-season, driven heavily by how well a player and his team are doing that same year, so a winning team racking up All-Star nods is close to expected by construction, not independent evidence. It should be read as a rough sanity check, not a second confirmation: teams with more All-Stars did have very slightly less concentrated hitting value (rho=−0.09), the same direction as the main finding, but far too weak on its own to lean on.',
      ],
    },
  ],
  caveats: [
    'Nothing here is causal. A spread-out lineup could reflect a genuinely deep, well-built roster — or it could just mean the team never had a true star, and its "diversity" is the absence of a standout rather than a strength. This spike cannot tell those two stories apart.',
    'The pitching null is a real non-effect at this sample size (450 team-seasons), not proof of an exact zero — the p-values (0.19-0.39) are close enough to the usual bar that a larger sample could plausibly tip one across it.',
    'war-history only covers 2010-2025, six years short of even the homegrown spike\'s 2004 floor and sixteen short of the ladder\'s own 2000-2025 window — the narrowest sample of any spike in this program so far. Same kind of reused-dataset window gap as the homegrown spike hit, catalogued once in standingNotes.js rather than re-explained per spike.',
    'The World Series cut (15 champions, 2010-2025) is this program\'s thinnest slice yet — six fewer champions than the roster-age spike had, nine fewer than the homegrown spike. Nothing at that cut can be told apart from noise.',
    'A traded player\'s season WAR was split between his teams by playing-time share, since war-history carries no team-specific number at all — a reasonable estimate, not a measured fact, and it assumes he performed at roughly the same rate at both stops.',
    'No payroll control exists anywhere in this program yet, same gap as every other spike.',
  ],
  open: [
    'A postseason-actual reweighting — whether the players who actually took the field in October were a more or less concentrated group than the full-season roster, the same follow-up the homegrown and roster-age spikes both ran.',
    'A joint model with roster age and homegrown share — three spikes in, all three found something on the hitting/making-the-postseason cut and little on the pitching or division-winner cuts. Whether that is three separate signals or one underlying trait is still open.',
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
  ],
}
