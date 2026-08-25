// Diary entry — the second factor spike, homegrown vs. acquired players vs.
// the outcome ladder. Reuses the homegrown-dependence sorter built for a
// separate, earlier research program (src/lib/research/diary — prospect
// development); this entry only reports the new join against THIS program's
// ladder. Full method: docs/team-success-homegrown.md.
export const homegrownEntry = {
  id: 'homegrown-v1',
  date: '2026-08-25',
  source: 'Spike #2',
  doc: 'docs/team-success-homegrown.md',
  title: 'A homegrown roster doesn\'t win you more rounds — but it does look like a division winner, not a wild card',
  verdict: 'no-ship',
  question:
    'Set against the rest of the league that same year, does a club built more on players it raised itself — rather than players it went out and got — go further in October? And does it tell apart the teams that win their division outright from the ones that sneak in on a wild card?',
  headline:
    'On the main question, no. How much of a club is homegrown does not tell you how far it goes once it gets in, and what little tilt there is runs too small and too unsteady to call it real. But there is one thing it does tell you. Among the 178 clubs that reached October, the division winners were about 5 percentage points more homegrown than the wild-card clubs — the same gap on the hitting side and the pitching side. That is the exact mirror of the roster-age spike. Age said something about getting in and nothing about which kind of October team you were. Homegrown share says nothing about going deep, but something about how you got there.',
  sections: [
    {
      id: 'the-null',
      heading: 'Does it predict how far a team goes? Not clearly.',
      prose: [
        'Every number below compares a club\'s homegrown share to the rest of the league that same season. Line those shares up against the 0-5 ladder, three different ways, and not one of the three clears the usual bar for "probably real." All three do lean the same direction every time a season is dropped out and the whole thing is run again, which is a faint hum, not a signal you would build a plan on.',
      ],
      table: {
        caption: 'Homegrown share, by how far a team went (percentage points above/below did-not-make-it teams)',
        columns: ['Team went', 'Hitters', 'Pitchers'],
        rows: [
          ['Made the postseason (178 teams) vs. did not (392)', '+2.1pp (not a reliable difference)', '+1.5pp (not a reliable difference)'],
          ['Reached the League Championship Series or better (76 teams)', '+1.0pp (not a reliable difference)', '+2.7pp (not a reliable difference)'],
          ['Won the World Series (19 teams)', '+1.2pp (not a reliable difference)', '−2.3pp (not a reliable difference — only 19 champions, far too few to trust a flipped sign)'],
        ],
      },
      proseAfter: [
        'Put this next to the roster-age spike, which ran the very same table and found a real, sizable gap at every step. This one does not. The differences above are small enough, and jumpy enough, that they read as noise rather than a lever any front office could pull.',
      ],
    },
    {
      id: 'the-real-finding',
      heading: 'The one number in this spike that does hold up',
      prose: [
        'Now throw out every club that missed October and look only at the 178 that got in. The division winners had a noticeably more homegrown roster than the clubs that arrived through the wild card. It shows up on BOTH sides of the ball, at almost exactly the same size.',
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
        'This is the roster-age spike turned inside out. Age told October clubs apart from the rest of the league but said nothing about division winners against wild cards. Homegrown share does the reverse. It has nothing to say about how deep a club goes, but it does separate the two ways into October: winning your division outright looks like a roster you raised, and sneaking in on a wild card looks like a roster you assembled.',
        'One more check. Instead of counting everyone who was on the roster all season, count only the men who actually played in October, weighted by how much they played there. Nothing changes. The typical club\'s October lineup and pitching staff came within a point of its full-season homegrown share, and the link to the ladder stayed a nothing either way.',
      ],
    },
  ],
  caveats: [
    'The overall link to the ladder is weak, but it is not pinned tightly to zero. That matters. The earlier finding that a homegrown roster does not win you more regular-season games was a tight, well-fenced nothing. This one is a loose one — it leaves real room for a small true effect that this pile of teams is simply not big enough to see.',
    'The division-winner result is the standout among eight separate comparisons run in this spike. Both the hitting and pitching versions of that SAME cut clearing the bar together is reassuring. Still, one test run on its own, decided on in advance, would be stronger evidence than the best of eight ever can be.',
    'The homegrown panel this spike borrows only covers 2004-2023, six years short of this program\'s full 2000-2025 window on each end. The usable pile here is 570-600 team-seasons, against the roster-age spike\'s 750.',
    'There is no way to account for payroll anywhere in this program yet, the same gap every other spike has.',
    'Nothing here says one thing caused the other. A more homegrown division winner could mean a good core simply stayed together long enough that the club never needed outside help. Or something else entirely — patient development, roster stability in general — could be driving the homegrown share and the division title both, on its own.',
  ],
  open: [
    'A single refit of the wonDivision result alone, decided on in advance, rather than reading it as the best of eight comparisons.',
    'A joint look at roster age alongside this — whether homegrown share adds anything once age is already accounted for, or the other way around.',
    'Extending the underlying sorter\'s pull to cover 2000-2003 and 2024-2025, closing the season-window gap with the ladder.',
  ],
  technical: [
    'homegrownShare/homegrownShareHit/homegrownSharePit: reused verbatim from docs/homegrown-dependence.md — the share of an org-season\'s MLB playing time (PA for hitters, batters faced for pitchers) contributed by players whose first professional minor-league season was with that same org. Joined against outcome-ladder.json on {teamId, season}.',
    '570 team-seasons (2004-2023, 2020 excluded). Spearman rho vs. the 0-5 ladder: 0.0747 (pooled), 0.0633 (hitting), 0.0494 (pitching) — permutation p=0.0714/0.1332/0.2262 respectively (5,000 within-season shuffles), same sign in 19/19 leave-one-season-out refits despite not clearing p<0.05.',
    'Band-difference permutation p-values (within-season shuffle, 5,000 draws): made postseason vs. not, p=0.1506 (hit) / 0.2858 (pit); LCS+ vs. not, p=0.6098 / 0.1362; WS winner vs. not, p=0.7314 / 0.5020 (n=19 champions).',
    'Division winner vs. wild card among the 178 postseason teams: +5.1pp hitting (p=0.0416), +5.2pp pitching (p=0.0374) — both significant at the conventional threshold.',
    'Postseason-actual homegrown share (reweighting by real October PA/IP instead of full-season role, reusing postseason-usage.json and the sorter\'s cached first-pro-org resolution — zero new statsapi calls): n=178, first-pro-org resolved for 1,850/1,867 distinct players referenced (99.1%), covering 4,455/4,486 PA/IP-weighted references (99.3%). RAW vs. ladder: hitting rho=-0.0068 (p=0.9264), pitching rho=0.0600 (p=0.3996), pooled rho=0.0362 (p=0.6264). CONTROLLED for total postseason PA/IP (the postseason-share-needs-a-volume-control trap from docs/team-success-postseason-usage.md): partial rho=-0.0944 (p=0.2102, hitting), +0.0398 (p=0.5802, pitching), -0.0332 (p=0.6460, pooled) — all null. Mean postseason-actual minus full-season share: hitting -0.19pp, pitching +0.81pp.',
    'Including the pandemic-shortened, 16-team 2020 field (n=600) changes every figure above by well under a point, no sign flips, and the wonDivision effect narrows slightly on the pitching side (+4.3pp, p=0.0808 — no longer under 0.05) — noted rather than hidden.',
    'Prose-to-formal map for this entry: "not a reliable difference" in the band table is the band-difference permutation p-value failing the conventional 0.05 threshold; "a faint hum, not a signal" is the 19/19 leave-one-season-out sign stability sitting alongside pooled p=0.0714, which does not clear that threshold; "a loose nothing rather than a tight one" is the point that these interval-free rank statistics do not bound the true effect near zero, unlike the regular-season-wins result in docs/homegrown-dependence.md.',
    'Multiple-comparison exposure behind the standout: eight band/wonDivision comparisons were run in this spike (three ladder bands x two sides of the ball, plus the wonDivision cut on each side), and no family-wise correction was applied to the two surviving p-values (0.0416, 0.0374). That exposure, not the size of the effect, is what the caveat asking for a preregistered single refit is about.',
  ],
}
