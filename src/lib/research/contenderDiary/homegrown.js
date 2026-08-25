// Diary entry — the second factor spike, homegrown vs. acquired players vs.
// the outcome ladder. Reuses the homegrown-dependence classifier built for a
// separate, earlier research program (src/lib/research/diary — prospect
// development); this entry only reports the new join against THIS program's
// ladder. Full method: docs/team-success-homegrown.md.
export const homegrownEntry = {
  id: 'homegrown-v1',
  date: '2026-08-25',
  source: 'Spike #2',
  doc: 'docs/team-success-homegrown.md',
  title: 'A homegrown roster doesn’t win you more rounds — but it does look like a division winner, not a wild card',
  verdict: 'no-ship',
  question:
    'Compared to the rest of the league that same year, does a team built more on its own homegrown players — rather than players acquired from elsewhere — go further in the postseason? And does it separate the teams that win their division outright from the ones that sneak in on a wild card?',
  headline:
    'No, not on the main question — a homegrown roster does not clearly predict how far a postseason team goes, and the correlation is too weak and too inconsistent to call a real effect. But it does separate division winners from wild-card teams: among the 178 clubs that already made the postseason, division winners ran about 5 percentage points more homegrown than wild-card teams, on both the hitting and pitching side. That is the mirror image of the roster-age spike, which found the opposite split — age said something about making it in, nothing about which kind of postseason team you were; homegrown share says nothing about going deep, but something about how you got there.',
  sections: [
    {
      id: 'the-null',
      heading: 'Does it predict how far a team goes? Not clearly.',
      prose: [
        'Every number below compares a team’s homegrown share to the league that same season. None of the three correlations against the 0-5 outcome ladder clears the usual bar for "probably real" — though all three point the same direction in every leave-one-season-out refit, which is a weak signal, not a proven one.',
      ],
      table: {
        caption: 'Homegrown share, by how far a team went (percentage points above/below did-not-make-it teams)',
        columns: ['Team went', 'Hitters', 'Pitchers'],
        rows: [
          ['Made the postseason (178 teams) vs. did not (392)', '+2.1pp (not a reliable difference)', '+1.5pp (not a reliable difference)'],
          ['Reached the League Championship Series or better (76 teams)', '+1.0pp (not a reliable difference)', '+2.7pp (not a reliable difference)'],
          ['Won the World Series (19 teams)', '+1.2pp (not a reliable difference)', '−2.3pp (not a reliable difference — n too small to trust the flipped sign)'],
        ],
      },
      proseAfter: [
        'For comparison, the roster-age spike found a real, sizable effect on this exact same kind of table. This one does not — the differences above are all small enough, and inconsistent enough, that they read as noise rather than a lever a front office could pull.',
      ],
    },
    {
      id: 'the-real-finding',
      heading: 'The one number in this spike that does hold up',
      prose: [
        'Restricted to the 178 team-seasons that already made the postseason, division winners had a noticeably more homegrown roster than teams that got in on a wild card — on BOTH sides of the ball, at almost exactly the same size.',
      ],
      table: {
        caption: 'Among postseason teams only: division winners vs. wild-card teams',
        columns: ['', 'Division winners (114 teams)', 'Wild card (64 teams)', 'Difference'],
        rows: [
          ['Hitting share', '43.7%', '38.6%', '+5.1 points, a real difference'],
          ['Pitching share', '40.1%', '35.0%', '+5.2 points, a real difference'],
        ],
      },
      proseAfter: [
        'This is the opposite pattern from the roster-age spike, which found age told postseason teams apart from non-postseason teams but said nothing about division winner vs. wild card. Homegrown share does the reverse — it has nothing to say about how deep a team goes, but it separates the two ways of getting into October: winning your division outright looks like a more homegrown roster; sneaking in on a wild card looks more assembled.',
        'Checking who actually played in October, instead of who was on the roster all season, changes none of this — the typical team’s postseason lineup and pitching staff were within a point of its full-season homegrown share, and the correlation against the ladder stayed a null either way.',
      ],
    },
  ],
  caveats: [
    'The overall correlation against the ladder is weak, not tightly bounded at zero — unlike the earlier finding that homegrown dependence does not predict regular-season wins (a real, tight null), this one leaves real room for a small true effect this sample cannot resolve.',
    'The division-winner result is the standout among eight separate comparisons run in this spike. Both the hitting and pitching versions of that SAME cut clearing the bar together is reassuring, but a test run once on its own, rather than as the best of eight, would be stronger evidence than this spike alone provides.',
    'The homegrown-dependence panel this spike reuses only covers 2004-2023, six years short of this program’s full 2000-2025 window on each end — the usable sample here (570-600 team-seasons) is smaller than the roster-age spike’s 750.',
    'No payroll control exists anywhere in this program yet, same gap as every other spike.',
    'Nothing here is causal. A more homegrown division winner could mean a stable winning core stayed together long enough to not need outside help — or an unrelated trait (patient development, roster stability generally) could be driving both the homegrown share and the division title on its own.',
  ],
  open: [
    'A single, preregistered refit of the wonDivision result alone, rather than reading it as the best of eight comparisons.',
    'A joint model with roster age — whether homegrown share adds anything once age is already accounted for, or the reverse.',
    'Extending the underlying classifier’s pull to cover 2000-2003 and 2024-2025, closing the season-window gap with the ladder.',
  ],
  technical: [
    'homegrownShare/homegrownShareHit/homegrownSharePit: reused verbatim from docs/homegrown-dependence.md — the share of an org-season’s MLB playing time (PA for hitters, batters faced for pitchers) contributed by players whose first professional minor-league season was with that same org. Joined against outcome-ladder.json on {teamId, season}.',
    '570 team-seasons (2004-2023, 2020 excluded). Spearman rho vs. the 0-5 ladder: 0.0747 (pooled), 0.0633 (hitting), 0.0494 (pitching) — permutation p=0.0714/0.1332/0.2262 respectively (5,000 within-season shuffles), same sign in 19/19 leave-one-season-out refits despite not clearing p<0.05.',
    'Band-difference permutation p-values (within-season shuffle, 5,000 draws): made postseason vs. not, p=0.1506 (hit) / 0.2858 (pit); LCS+ vs. not, p=0.6098 / 0.1362; WS winner vs. not, p=0.7314 / 0.5020 (n=19 champions).',
    'Division winner vs. wild card among the 178 postseason teams: +5.1pp hitting (p=0.0416), +5.2pp pitching (p=0.0374) — both significant at the conventional threshold.',
    'Postseason-actual homegrown share (reweighting by real October PA/IP instead of full-season role, reusing postseason-usage.json and the classifier’s cached first-pro-org resolution — zero new statsapi calls): n=178, first-pro-org resolved for 1,850/1,867 distinct players referenced (99.1%), covering 4,455/4,486 PA/IP-weighted references (99.3%). RAW vs. ladder: hitting rho=-0.0068 (p=0.9264), pitching rho=0.0600 (p=0.3996), pooled rho=0.0362 (p=0.6264). CONTROLLED for total postseason PA/IP (the postseason-share-needs-a-volume-control trap from docs/team-success-postseason-usage.md): partial rho=-0.0944 (p=0.2102, hitting), +0.0398 (p=0.5802, pitching), -0.0332 (p=0.6460, pooled) — all null. Mean postseason-actual minus full-season share: hitting -0.19pp, pitching +0.81pp.',
    'Including the pandemic-shortened, 16-team 2020 field (n=600) changes every figure above by well under a point, no sign flips, and the wonDivision effect narrows slightly on the pitching side (+4.3pp, p=0.0808 — no longer under 0.05) — noted rather than hidden.',
  ],
}
