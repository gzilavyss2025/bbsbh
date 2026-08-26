// Diary entry — checking the star-diversity finding a second way, through
// All-Star and award recognition instead of WAR. Full method:
// docs/team-success-star-diversity-awards.md.
export const starDiversityAwardsEntry = {
  id: 'star-diversity-awards-v1',
  date: '2026-08-26',
  source: 'Spike #9, follow-up to #3',
  doc: 'docs/team-success-star-diversity-awards.md',
  title: 'A second way to check the star-diversity finding, and why it mostly does not hold up',
  verdict: 'no-ship',
  question:
    'The earlier finding said a team that spreads its production across the roster, instead of leaning on one or two standout players, tends to go further in October. That was measured with Wins Above Replacement, a stat most fans never look at. Does the same pattern show up if you measure "star" the way a fan would instead — All-Star selections and postseason awards?',
  headline:
    'At first glance, yes. Teams that spread their All-Star nods and trophies around, instead of piling them on one or two players, did tend to finish higher on the ladder, on both the hitting side and the pitching side. But that first glance does not survive a closer look. It turns out a team with more All-Stars and award winners overall also just has more players getting some kind of notice, period, and THAT plain fact is most of what was driving the result. Once you account for how many players got any recognition at all, the pattern does not just get weaker. It flips the other way. The original, WAR-based finding does not have this problem when the same test is run on it. So this was worth trying, but it does not stand as a second piece of proof for the first finding.',
  sections: [
    {
      id: 'the-story',
      heading: 'A team full of All-Stars looks different up close',
      prose: [
        'Picture two pennant winners. One has a superstar and a supporting cast. The other has a lineup where six or seven different players got a look at some point in the season. Maybe an All-Star trip, maybe a Gold Glove, maybe a spot on an MVP ballot. On the surface, the second kind of team did tend to finish higher. That matched the shape of the original finding, and for a while it looked like real confirmation from a completely different angle.',
        'The catch is that a team loaded with talent almost always racks up MORE total recognition, not just recognition spread differently. A club with eight players who got some kind of notice is not really "less concentrated" than a club with three. It is just a deeper, better team. Once that plain fact is set aside and only the LEFTOVER pattern is looked at, the story does not hold. It reverses.',
      ],
    },
    {
      id: 'the-comparison',
      heading: 'The original finding does not have this problem',
      prose: [
        'The same exact test was run on the original, WAR-based version of this idea, using the same seasons. There, the pattern survives. It gets a little smaller, but it does not flip.',
        'So the two ways of measuring "is this team\'s value spread out or stacked up" are not really measuring the same thing underneath, even though they pointed the same direction at first. Lining them up against each other, on the very same teams, they barely agree with one another at all. That should have been the first hint that this was not the clean second witness it looked like.',
      ],
    },
    {
      id: 'what-survived',
      heading: 'What this attempt still got right',
      prose: [
        'Not everything about this attempt fell apart. One piece of the original finding said age and star spread stop mattering once a team already has a postseason ticket punched. A division winner and a wild-card team look about the same either way. That exact null shows up again here, on the awards-and-All-Star measure, matching the original almost number for number. And nobody had tried building a genuine "how spread out is the credit" measure from awards before. Counting All-Stars alone turns out to be a different, much simpler thing hiding under a fancier name.',
      ],
    },
  ],
  caveats: [
    'The main headline of this attempt does not survive its own closer look, and this entry should not be read as a second confirmation of the earlier star-diversity finding.',
    'The awards data this measure needed only goes back to the 2022 season, so the whole test ran on just four years of baseball, a small window compared to the earlier finding\'s much bigger one.',
    'A postseason award is voted on at the end of the year, by people who already know how the team\'s season went. That makes it an even easier stat to get backwards-cause-and-effect confused with than an All-Star nod, which the original finding already flagged as a risk.',
    'Every kind of honor here, from making the All-Star team to winning the Most Valuable Player award, was counted as worth exactly the same one point. A more careful weighting was not tried and might behave differently.',
    'There is still no way to account for team payroll anywhere in this research program, the same gap every earlier entry has flagged.',
  ],
  open: [
    'Build a properly weighted version of the honors measure (an MVP worth more than an All-Star nod) and run the same closer look on it.',
    'Fold the "how many players got any recognition at all" check directly into the script that produces this measure, so the next spike that tries something like this catches the same trap earlier.',
    'Wait for the awards data to cover more seasons before trying this measure again at a size worth trusting.',
  ],
  technical: [
    'Primary sample: n=103 team-seasons (hitting), n=93 (pitching), 2022-2025 (the full span of public/data/awards-history.json). 17/27 team-seasons excluded for zero recognized players on that side of the ball.',
    'Raw correlations vs. the 0-5 ladder (Spearman, within-season permutation p, 5,000 draws): hitting top1Share rho=-0.3911 (p=0.0002), top2Share rho=-0.4397 (p<0.0001), hhi rho=-0.4858 (p<0.0001); pitching top1Share rho=-0.3242 (p=0.0016), top2Share rho=-0.3006 (p=0.0032), hhi rho=-0.3486 (p=0.0004). Same sign in 4/4 leave-one-season-out and 30/30 (hitting) / 29/29 (pitching) leave-one-club-out refits.',
    'Division-winner vs. wild-card null replicates the original spike: hitting n=23 each side, all three measures p=0.78-0.90; pitching n=21 each side, p=0.16-0.17.',
    'Cross-check against the original WAR-based top1Share on the identical team-seasons: rho=0.1885 (hitting, n=103), rho=-0.0211 (pitching, n=93) — a weak-to-nonexistent relationship between the two concentration measures.',
    'CONFOUND CHECK (independent verification pass, not in the delivered build script): rho(honors top1Share, count of recognized players) = -0.9201 (hitting), -0.9645 (pitching) — the concentration measure is nearly a mechanical restatement of recognition breadth. Partial Spearman rho(top1Share, ladder | recognized-player count) REVERSES sign: +0.3083 (hitting), +0.2009 (pitching), versus the raw -0.3911/-0.3242. Same reversal on top2Share (+0.14 hitting, -0.05 pitching) and hhi (+0.26 hitting, +0.18 pitching).',
    'Control re-run of the identical confound check on the ORIGINAL WAR-based spike\'s own data: rho(WAR top1Share, count of positive-WAR players) = -0.2470 (hitting) / -0.3449 (pitching); partial rho after conditioning on that count SURVIVES: -0.1325 (hitting), -0.0349 (pitching). The original finding is not undermined by this check.',
    'All-Star-count-alone sanity check (full 2000-2025 ladder window, mechanical identity top1Share=1/count verified exactly): hitting n=604, count rho=0.4235 vs. ladder; pitching n=507, count rho=0.2607. The original spike\'s own stretch-section number on its narrower 2010-2025 window was rho=0.5568.',
    'Band comparisons and pitching-significant-at-the-made-postseason-cut result (p=0.0004-0.0032 pitching, versus the original WAR-based spike\'s null of p=0.19-0.39 at the same cut) are reported in the doc but inherit the unresolved breadth confound above and should not be read as evidence of a genuine concentration effect.',
    'No payroll control, consistent with every other entry in this program.',
  ],
}
