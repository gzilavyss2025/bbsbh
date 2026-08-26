// Diary entry — a spike testing whether a farm system's mix of promotion
// reasons (merit vs. injury/roster-rule/trade) predicts the parent club's
// postseason outcome. Reuses the acting-team join and exit-reason read this
// spike built on top of docs/price-the-blockage.md's transaction-wire read.
// Full method: docs/team-success-exit-reason-mix.md.
export const exitReasonMixEntry = {
  id: 'exit-reason-mix-v1',
  date: '2026-08-26',
  source: 'Spike #11, follow-up to #10',
  doc: 'docs/team-success-exit-reason-mix.md',
  title: 'The Mariners promoted almost everybody on merit. It didn\'t end the drought.',
  verdict: 'no-ship',
  question:
    'When a farm system opens up a seat in Triple-A, does it matter why the seat opened? A team can promote a player because he earned it, or lose him to injury, a roster rule, or a trade instead. Does a farm system that promotes mostly on merit send its big-league club further in October?',
  headline:
    'No. Seattle is the best example of why not. Through the run of seasons this spike covers, the Mariners promoted a bigger share of their Triple-A players on pure merit than almost any other team in baseball. Their thin, young roster gave them plenty of chances to. Over that same run, no other team in the league went to October less often. A clean, merit-driven pipeline sounds like the mark of a well-run system. It is not the mark of a winning one, at least not by this measure. Every other way this spike looked at the question came back with the same nothing.',
  sections: [
    {
      id: 'seattle',
      heading: 'A system that promotes on merit, and a drought anyway',
      prose: [
        'Picture a Triple-A season from a scouting director\'s chair. A seat opens up on the roster. Best case, it opens because a player forced the issue: he hit, he pitched, he earned the callup. Worst case, it opens because someone got hurt, got traded away, or had to be moved for a roster-rule reason that has nothing to do with how well he played.',
        'The Seattle Mariners lived in the best case more than almost any team in baseball across the years this spike covers. Their farm system promoted players for merit, again and again, more than 8 times out of 10. That is a mark of a well-run pipeline: thin big-league rosters that do not block a hot prospect behind an established veteran.',
        'And across those same years, Seattle went to October less than any other team in the sport. A clean pipeline and a long drought, side by side, in the same organization.',
      ],
    },
    {
      id: 'the-check',
      heading: 'Checking it every way this spike could think of',
      prose: [
        'Seattle by itself proves nothing. So this spike lined up every organization\'s season, every year, and asked the same question three times, at three different levels of strictness. First, teams with at least one promotion that season. Then teams with at least two. Then the cleanest group, teams with at least three. The answer came back the same nothing at every level. The direction of the tiny tilt even flipped between the three groups, which is itself a sign that nothing real is hiding in there, waiting to be found with a bigger pile of seasons.',
        'It stayed a nothing sliced by how far a team went, too. Teams that made October, teams that went deep, teams that won it all: none of them ran a noticeably cleaner or messier promotion mix than everyone else.',
      ],
    },
    {
      id: 'the-mirror',
      heading: 'One place a related idea worked, and this is not it',
      prose: [
        'A different spike in this same notebook asked a related question, a different way of slicing a farm system: how much of a roster a team raised itself, rather than why a promotion happened. Among teams that already made October, the ones built more on homegrown players were more likely to win their division outright rather than sneak in on a wild card.',
        'This spike tried the same comparison with its own measure, merit-driven promotions instead of homegrown players, and it does not hold up here. If anything it ran backward. Among the postseason teams studied, the division winners had a slightly lower merit-promotion share than the wild-card teams, not a higher one. Even that small backward tilt is not something you could bet on.',
      ],
    },
  ],
  caveats: [
    'This measure is thin for a lot of organization-seasons. More than a third of the team-seasons studied had exactly one promotion event to work with that whole year. For those, the merit share is either "the one guy earned it" or "the one guy did not," with nothing in between and no way to be more precise.',
    'A cleaner cut, keeping only organization-seasons with at least three promotion events, still came back a nothing. It even flipped the direction of the already tiny tilt from the looser cuts. That flip is read here as more evidence of a real nothing, not as a small pile of teams hiding a real effect.',
    'A second, rougher check pools every organization\'s whole run of seasons together, thirty organizations, one number each. It agrees there is nothing here, but its own number moves a lot depending on which single organization is left out. It should be read as a picture of the data, like the Seattle story above, not as a precise measurement.',
    'This spike had to work out for itself which organization each promotion belonged to, since no existing file in this notebook carries that link directly. It built that link from the same transaction records an earlier spike already collected. Along the way it caught and fixed one trap, a transaction description that could be misread as the wrong team because of a shared word, and spot-checked the fix against two already-verified real cases.',
    'The World Series and League Championship Series slices of this data are small, a dozen or so championship seasons. That is the same standing caution as every entry in this notebook that cuts down to the deepest rounds. None of them found anything anyway.',
    'Why a Triple-A stint truly ended (merit, injury, a roster rule, or a trade) is taken as given from an earlier spike\'s reading of the transaction wire. This spike did not re-check that underlying reading from scratch.',
  ],
  open: [
    'A joint look alongside a sibling spike running in this same batch. That one measures how long a typical Triple-A stay lasts, rather than why it ends. Both draw on the exact same pool of promotions and could be picking up related organizational behavior.',
    'Whether teams with no promotions at all in a given season look any different from teams that promoted a lot. A farm system that simply did not need to call anyone up may be its own kind of team. A pattern this spike noticed but did not chase down.',
    'Everything else on the factor catalog in docs/team-success-research.md this spike did not touch.',
  ],
  technical: [
    'meritShare = merit promotions / (merit + injury + roster-rule + trade exits), per organization-season, built from price-the-blockage.md\'s 962-stay Triple-A cohort (2009-2023). Acting organization recovered by parsing each transaction\'s own description text (946/962 matched; the 16 unmatched are exactly the pre-existing "unresolved" no-transaction stays). 899 of the matched stays carry one of the four core exit reasons (merit 573, roster-rule 187, injury 137, traded 2).',
    '359 of a possible 450 organization-season cells (30 orgs x 15 seasons) carry >=1 classified exit; median 2 exits per cell, 129 cells at exactly n=1, 147 at n=3+. Spearman rho vs. the 0-5 ladder: total>=1 rho=-0.0395 (perm p=0.4516, n=359); total>=2 rho=-0.0422 (p=0.5162, n=230); total>=3 rho=+0.1386 (p=0.1010, n=147) — sign flips across cuts, read as evidence of a genuine null. Partial rho controlling for exit volume barely moves the main cut (-0.0398 vs -0.0395).',
    'Band comparisons (mean meritShare, total>=1, n=359): postseason 59.5% vs not 63.4% (diff -3.9pp, perm p=0.3454); LCS+ 61.6% vs not 62.2% (diff -0.6pp, p=0.9236); WS winner 59.7% vs not 62.2% (diff -2.5pp, p=0.8318, n=12 champions).',
    'Division winner vs. wild card among postseason org-seasons (n=115): 56.0% (n=70 division winners) vs 64.8% (n=45 wild card), diff -8.8pp, perm p=0.2300; era-controlled logistic meritShare_z beta=-0.196, p=0.333, OR=0.822.',
    'Ordered logit, ladder(0-5) ~ meritShare_z + log(exitVolume)_z + era dummies (n=359): meritShare_z beta=-0.0964, se=0.1089, p=0.3757, OR=0.908. Confound checks: traded exits are 2/899 (0.2%, too rare to matter); roster-rule-only (n=334) rho=+0.0035, injury-only (n=322) rho=-0.0343, both null, same rough sign as pooled.',
    'Organization-level pooled sensitivity check (n=30 orgs, meritShare across all 2009-2023 exits vs mean ladder rung): rho=0.0646. Seattle Mariners highest at 86.2% (29 exits, mean ladder rung 0.13, lowest in the cohort); Houston Astros 81.0% (42 exits, ladder 1.93). This check\'s point estimate is not robust to single-organization removal (ranges -0.006 to +0.173 dropping Houston vs Seattle) — the reader-facing "picture, not a measurement" framing above is what that instability is doing.',
    'Unreported-in-build, found on verification: organization-seasons with zero classified exits that season average a higher ladder rung (0.901, n=91) than organization-seasons with at least one (0.705, n=359); perm p=0.22, not significant, but real, and the basis for the "open" item above about whether promoting-at-all matters more than the reason.',
    'Verification pass (independent): re-ran both build/analyze scripts and an existing adversarial-check script from scratch, all numbers reproduced exactly; independently re-derived the 946/962 acting-team match and the Pittsburgh/Indianapolis parsing-trap fix from raw transaction text (39 Indianapolis-mentioning descriptions, all correctly resolved to Pittsburgh); verified the non-duplication claim against docs/team-success-homegrown.md directly. Overall verdict: confirmed, with the one downgrade being the org-level (n=30) check\'s point-estimate stability, noted above and in the doc.',
  ],
}
