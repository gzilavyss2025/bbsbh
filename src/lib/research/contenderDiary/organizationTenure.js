// Diary entry — the follow-up to the joint model's fifth signal, giving the
// organization Triple-A tenure lead genuine temporal separation and testing
// it against incumbent depth. Full method: docs/team-success-organization-tenure.md.
export const organizationTenureEntry = {
  id: 'organization-tenure-v1',
  date: '2026-08-26',
  source: 'Spike #10, follow-up to #6',
  doc: 'docs/team-success-organization-tenure.md',
  title: 'The Rays and the Brewers keep their prospects at Triple-A a long time. It turns out that alone does not explain why some of them win',
  verdict: 'no-ship',
  question:
    'The joint model noticed something: organizations that keep their players at Triple-A longer before bringing them up also tend to go deeper in October. But that number was built the easy way, using a player\'s whole career at once. It could not tell whether patience causes winning, or whether winning teams simply have no open roster spot to call anyone up into. Does the pattern hold once you only let a season see the players who had already debuted before it, the way a scout could have known it in real time? And once you also account for whether a Triple-A roster was already blocked by a veteran, does either one explain the other away?',
  headline:
    'It does not hold up, once it has to actually look forward instead of backward. When every team is only allowed to use what happened before the season it is trying to explain, the pattern shrinks by more than half and stops clearing the bar for something real. Here is the part that makes it more than a coincidence: on the exact same organizations, simply putting the career-long number back in restores the strong result immediately. Nothing about the teams changed. Only whether the number was allowed to see the future did. That is a strong sign the original result was leaning on hindsight it should not have had. A Triple-A roster blocked by a veteran does not explain the drop either. That measure barely moves once patience is already in the picture, because the two hardly have anything to do with each other. This does not prove patient organizations do not really win more. It proves the case for it was weaker than it looked.',
  sections: [
    {
      id: 'the-honest-test',
      heading: 'Letting the number see only the past',
      prose: [
        'Picture the Tampa Bay Rays and the Milwaukee Brewers, two organizations known for making prospects wait their turn at Triple-A. The earlier finding lined up a team\'s whole-season success against how patient that organization was with every player it ever brought up. That included players who had not debuted yet when the season it was measuring was even played. That is a number a scout in the dugout could never have actually known at the time.',
        'This spike rebuilt the number the honest way: for each season, count only the players who had already reached the majors before that season started. Line that up against how far the team went that same year, across every organization with enough history to measure. The pattern that looked strong before comes back much weaker, and no longer clears the bar for "probably real."',
      ],
    },
    {
      id: 'the-same-rows-test',
      heading: 'The clean proof it was the lookback, not the sample',
      prose: [
        'To make sure this was not simply a smaller or different group of teams behaving differently, the exact same set of organization-seasons was tested twice. Once with the honest, forward-looking number. Once swapping back in the old career-long number, on the identical rows both times.',
        'The old number came back strong and clearly real. The honest number, on the same teams in the same years, came back roughly half as strong and landed right on the edge of "maybe." Nothing about the teams changed between the two tests. The only thing that changed was whether the number was allowed to know things that had not happened yet.',
      ],
    },
    {
      id: 'the-blocked-roster-check',
      heading: 'Does a blocked Triple-A roster explain it instead?',
      prose: [
        'A separate line of research on this program built a measure of whether a Triple-A team already had an established veteran holding down a job. That is the kind of thing that could make an organization look patient when really it just had nowhere to put the next player up.',
        'Put both measures in the same model and neither one moves the other. A blocked Triple-A roster comes back completely flat once patience is already accounted for, and patience barely changes whether the blocked-roster measure is in the picture or not. The two are close to unrelated to each other. That rules out one tidy explanation — it is not that "blocked rosters" is secretly the whole story hiding inside "patience" — but it does not rescue patience either. There was simply not enough left of the original pattern, once it had to look forward, for anything else to compete with.',
      ],
    },
  ],
  caveats: [
    'The honest, forward-looking version of this measure is a noisier one. Early seasons in the study window only have a couple of organizations with enough prior debuts to measure at all, growing to the full set of thirty only by the later seasons. A weak result here fits two different stories equally well: "the effect is not really there," or "the effect is real, but this thinner measure is not big enough yet to see it clearly."',
    'The head-to-head against the blocked-roster measure ran on a much smaller group of organization-seasons than the main test. It covers only about a decade\'s worth of seasons, and most of those seasons sat at the very bottom of the success ladder. Treat that specific comparison as a hint, not a settled answer, on top of the main result already being weak.',
    'The blocked-roster measure built for this comparison only looks at position players at Triple-A, not pitchers. It also uses that same season\'s roster, rather than looking backward the way the patience number now does — the fairest match available with the data on hand, but not a perfectly matched pair.',
    'This program still has no way to account for payroll anywhere, which matters here specifically because a rich organization can better afford to let a good prospect sit and develop.',
    'This spike did not re-test roster age, homegrown share, star variety, or postseason experience alongside the honest patience number. It answered the one specific question the joint model left open, not a full rebuild of that whole model.',
  ],
  open: [
    'Whether a bigger pile of seasons, once more years accumulate, would let the honest, forward-looking version of this measure clear the bar on its own.',
    'A full rebuild of the joint model with the honest, forward-looking patience number swapped in for all five factors together, rather than testing it alone and against depth only.',
    'A historical payroll source, the standing gap in every spike in this program.',
  ],
  technical: [
    'Lagged organization tenure: each organization-season\'s median days at Triple-A, computed only from debuts strictly before that season, floor of 6 prior debuts to be included. Wide sample n=327 organization-seasons, 2012-2025 excluding 2020 (partial coverage 2012-2016, full 30/30 from 2017). Ordered logit on the 0-5 ladder, era-controlled: laggedTenure_z beta=+0.1587, se=0.1088, p=0.1447, OR=1.172. Leave-one-organization-out (30 refits): same sign 30/30, individually p<0.05 in 0/30, beta range [0.120, 0.211]. Permutation test (2,000 within-season reshuffles): p=0.154.',
    'Depth-matched sample, n=104 organization-seasons (2013-2019, 2021-2023; intersection of lagged-tenure coverage and >=2 Triple-A hitter stays in the reconstructed depth panel). Tenure alone: beta=+0.3644, se=0.2061, p=0.0771, OR=1.440. Joint tenure+depth: tenure beta=+0.3641, p=0.0774; depth beta=+0.0081, se=0.2111, p=0.9695. Correlation(laggedTenure_z, depth_z), n=104: r=0.0350. Leave-one-organization-out on the joint fit: same sign 30/30, individually p<0.05 in 4/30, beta range [0.310, 0.481]. Permutation test on the joint model: p=0.0925.',
    'madePostseason logistic, n=104: tenure alone beta=+0.3672, se=0.2122, p=0.0835, OR=1.444, McFadden=0.0240; joint with depth, tenure beta=+0.3691, p=0.0828, depth beta=-0.0304, p=0.8886, McFadden=0.0242.',
    'Isolation check, identical 104 rows, tenure value swapped for the original unlagged/contemporaneous figure: beta=+0.6528, se=0.2216, z=2.945, p=0.0032, OR=1.921 — versus +0.3644 (p=0.0771) lagged on the same rows. This contrast, not sample composition, is what the headline is built on.',
    'For reference, the joint model\'s original contemporaneous figure (n=570): ladder +0.298 SD (p=0.0003); madePostseason +0.316 SD (p=0.0010).',
    'Depth construction: incumbentAt()-style per-stay measure ported line-for-line from docs/price-the-blockage.md\'s own build.mjs, restricted to Triple-A hitter stays (466 of 967 total duration records; 497 pitcher stays and 4 unresolved-organization stays dropped), aggregated by mean into organization-seasons with >=2 qualifying stays (125 meet that floor; 104 of those also have lagged-tenure coverage).',
    'Replication check: the same organization-attribution method used for the lagged panel reproduces the already-published, unlagged team-windows.json AAA per-organization medians in 30 of 30 organizations, within 1 day, at that document\'s own minimum-sample floor. Ordered-logit estimator (gradient ascent + numerical Hessian) re-validated against synthetic data with known coefficients before use, reusing the same validation docs/team-success-joint-model.md\'s trade-deadline follow-up already ran.',
    'Independent verification: an adversarial re-run of the analysis script end to end, from the same cached inputs, reproduced every number above exactly, including the drop-count chain behind the depth panel (497 pitchers / 4 no-org / 466 hitter stays / 125 organization-seasons) and the org-attribution replication check.',
    'One correction from an earlier draft: the r=0.035 (lagged tenure vs. depth) correlation was originally described as "closely matching" the joint model\'s own r=0.055 figure. That was wrong and has been removed — the joint model\'s r=0.055 is organization tenure versus HOMEGROWN SHARE (docs/team-success-joint-model.md), an unrelated pair; the joint model never computed a tenure-vs-depth correlation. The r=0.035 figure itself is unaffected and was independently reproduced; it simply has no prior figure to be compared against.',
    'Depth-matched sample\'s outcome distribution is bottom-loaded: 73 of 104 rows at ladder rung 0, only 12 of 104 above rung 1 — thinner than the joint model\'s own flagged rung-2 sparsity at n=570. The numerical-Hessian well-identified check passed, but the higher cutpoints in this specific fit are correspondingly weakly identified.',
    'Depth join uses a fielding pull keyed by team id and treated as organization id; safe only because no organization in the 2013-2023 window used here relocated. A latent fragility if the method is reused over a wider window.',
  ],
}
