// Diary entry — the trade-deadline factor spike, net WAR acquired vs. the
// outcome ladder, and the confound check an independent recheck could not
// let stand as written. Full method: docs/team-success-trade-deadline-value.md.
export const tradeDeadlineValueEntry = {
  id: 'trade-deadline-value-v1',
  date: '2026-08-26',
  source: 'Spike #7',
  doc: 'docs/team-success-trade-deadline-value.md',
  title: 'Buying at the deadline looks like it wins games — but nobody can say how much of that is just being good enough to buy',
  verdict: 'holds',
  question:
    'When a club adds more talent than it gives away at the trade deadline, does it go further that October? Or is that just what an already-good team looks like from the outside?',
  headline:
    'The pattern is real and it does not wobble: teams that gain more value than they give up at the deadline go further in October, and that link survives every stress test thrown at it. But the harder question — is the deadline itself doing the winning, or is a good team simply the kind of team that goes shopping — comes back unresolved. One honest way of checking it says the buying barely matters once you account for how good the team already was. A second, equally honest way of checking it says the buying keeps almost all its power. Both checks have a real flaw. The truth sits somewhere between them, and this spike cannot say exactly where.',
  sections: [
    {
      id: 'the-story',
      heading: 'Two trades, two mirror images',
      prose: [
        'In 2021 the Los Angeles Dodgers added more talent at the deadline than almost any other club that year and still lost the League Championship Series. Two years later the Texas Rangers did something similar and went all the way, winning the World Series. On the other side of the ledger, the 2021 Washington Nationals sold off Max Scherzer and Trea Turner, giving up more value than any other club that summer. They finished at the bottom of the standings, the Dodgers\' story running in reverse.',
        'And then there is the 2021 Oakland Athletics, who added the second-most value of any club that whole year and still missed the postseason entirely. Buying well is not the same thing as being good enough to cash it in.',
      ],
    },
    {
      id: 'the-check',
      heading: 'The question this spike actually set out to answer',
      prose: [
        'Here is the worry. A team already winning in July is exactly the team that goes out and trades for a proven starter or a big bat for the stretch run. If that is mostly what is happening, then the deadline is not making teams better so much as confirming that they were already good. This spike tried to check that directly, the same worry the very first spike in this program only had room to flag in passing about roster age.',
        'The first attempt held aside each team\'s record at the end of the season and asked what was left of the buying-and-winning link. Almost nothing was left. That looked like an answer: teams buy value because they are already good, and the buying itself does not add much.',
        'But there is a problem with using a team\'s final record to check that. The final record already includes whatever those August and September trades did to help the team win games down the stretch. Using it to hold aside "how good the team already was" partly holds aside the very thing being tested.',
        'So a second check used each team\'s record from the year before instead, a number the current season\'s trades could not possibly have touched. On that version, the buying-and-winning link barely moved. It kept almost all its strength.',
        'Both checks are fair ones. Both lean on an imperfect stand-in. The first one likely gives the trades too much credit for mattering less than they do; the second one is a weak, out-of-date read on how good a team already was by midseason. Put the two side by side and the honest answer sits somewhere between "barely matters" and "matters almost as much as the raw numbers suggest". This spike cannot narrow that range any further with what is on hand.',
      ],
    },
  ],
  caveats: [
    'This window covers only 2021 through 2025 — 150 team-seasons and five World Series champions, the smallest pile of seasons tested anywhere in this program. Do not read these numbers side by side with the roster-age or joint-model spikes, which cover 25 years and hundreds more team-seasons.',
    'The confirm-or-deny check on the selection-effect worry only covers three of those five years, because that is as far back as an available season-end standings file reaches. The other two years have no equivalent check.',
    'This spike is narrower than the full trades question this program set out to answer eventually — it looks only at the deadline window, not the whole season\'s player movement.',
    'No historical payroll information exists anywhere in this program yet. A team able to buy proven talent in July is often also a bigger spender, and neither way of checking "was this team already good" can rule that out.',
    'A trade partner who sends away a player with no big-league innings that season (about four in ten of all traded players) is correctly scored as gaining nothing that season. Who wins a trade three years later is a different question, one this spike does not attempt.',
  ],
  open: [
    'A cleaner "already good" number, measured on the actual day of the deadline rather than a season-end or prior-season stand-in — the natural next check, if a source for it can ever be found.',
    'Extending the trade-deadline data further back than 2021, if it ever becomes available, to grow this spike\'s thin window.',
    'The wider trades question this program\'s catalog actually asks: reconciling deadline activity with a club\'s full season of player movement into one number.',
  ],
  technical: [
    'netWarAcquired = sum of same-season MLB WAR (batting + pitching, two-way players summed) received in deadline trades minus WAR sent, per club-season. Built from 356 deadline trades / 713 team-sides / 1,678 player-sides across public/data/trade-deadline/{2021..2025}.json, joined to public/data/war-history/*.json (personId-keyed) for WAR and .scratch/team-success/outcome-ladder.json for the 0-5 ladder rung. Sent/received player sets match exactly across all 356 trades (0 mismatches); net WAR sums to ~0 every season by construction (2021: -0.000 … 2025: -0.000).',
    'Main test: Spearman(netWarAcquired, 0-5 ladder), n=150, rho=0.5588. Permutation test (5,000 within-season reshuffles): 0/5000 matched or exceeded observed |rho|, p<0.0002. Leave-one-season-out (5 refits): rho range [0.5264, 0.6081]. Leave-one-club-out (30 refits): 30/30 same sign, rho range [0.5439, 0.5901].',
    'Band cuts: Spearman(net, madePostseason)=0.5632 (58/150 made). Spearman(net, ladder>=3 "LCS or better")=0.3404 (n=20). Among the 58 postseason clubs, Spearman(net, wonDivision)=-0.2175 (weak, opposite-signed, not significant).',
    'Volume-confound check (independently verified): Spearman(netWarAcquired, tradeCount)=-0.0075. Partial Spearman(net, ladder | tradeCount)=0.5624, essentially unchanged from raw — net value is not a volume-of-trading artifact.',
    'BUILD\'S confound check (2021-2023 subsample, n=90, "already good" proxy = same-season FINAL win percentage, from .scratch/level-benchmarks/standings-cache.json): raw Spearman(net, ladder)=0.5638; Spearman(net, finalWinPct)=0.6636; Spearman(finalWinPct, ladder)=0.7672; partial correlation of net vs. ladder controlling for finalWinPct = 0.1138; permutation p=0.2826 (indistinguishable from zero). The write-up\'s headline originally called this "almost entirely a selection effect... confirmed."',
    'INDEPENDENT VERIFICATION (this diary entry\'s correction): reproduced every one of the build\'s numbers exactly (rho, permutation p, LOO ranges, band cuts, missing-WAR count, per-year zero-sum, top/bottom team-seasons, per-year partial correlations -0.2279/0.3154/0.3421). Flagged that finalWinPct is measured AFTER the trades it is meant to control for (post-treatment), which mechanically inflates how much of the raw correlation it can "explain away." Reran the same partial-correlation logic using each club\'s PRIOR-season win percentage instead (n=120, 2021-2024, same standings-cache.json, a genuinely pre-treatment covariate): prior-year win% correlates only weakly with both net WAR (rho=0.28) and the ladder (rho=0.31), versus final win%\'s 0.66/0.77. Partial correlation of net vs. ladder controlling for prior-year win% = 0.5038 (permutation p<0.0002 on 5,000 within-year reshuffles) — essentially unchanged from the raw 0.546 on that subsample.',
    'Reading of the two confound checks together: final-win% partial (0.114) and prior-year-win% partial (0.504) bracket the true controlled-for effect from opposite directions (the former over-adjusts by including in-season trade impact; the latter under-adjusts because it is a weak, stale proxy for in-season quality). The bracket is wide enough that "almost entirely explained by selection, confirmed" overstates what this spike\'s data supports. Correct reading: a real, legitimate selection-effect concern that current data cannot pin down more precisely than roughly 0.11 to roughly 0.50. This is why the entry carries a "holds" verdict for the raw correlation and its stress tests, but treats the original confound headline as WEAKENED, not confirmed.',
    'Missing-WAR audit: 674 of 1,678 player-sides (40.2%) had no MLB WAR row in the traded season, split exactly 337 sent / 337 received (rules out a directional scoring bug). Overwhelmingly pre-debut prospects (e.g. Kevin Alcantara, Anderson Espinoza, 2021).',
    'Ordered-logit (proportional-odds) fit of the full 6-rung ladder (netWarAcquired_z + era2021 dummy, n=150) converged with an invertible Hessian (netWarAcquired_z beta=1.6695, se=0.2766, p=1.60e-9), validated first against synthetic n=2000 data with known coefficients [0.8,-0.3], recovering [0.827,-0.338]. Rung counts across all 150 rows: [92, 29, 9, 10, 5, 5] — three of six rungs in single digits, which is why this number is reported here only, not as a headline figure alongside the plain correlation and band cuts.',
    'Novelty check: docs/team-success-research.md\'s factor #7 (Trades/acquisition) was logged "Not started" before this spike, and no other docs/team-success-*.md file touches trade-deadline WAR — confirmed by independent recheck, no duplicate finding elsewhere in this program.',
    'Process note: a docs/team-success-trade-deadline-value.md draft carrying a pre-written "Independent verification" section existed ahead of the adversarial recheck that produced the numbers above; every specific figure in that earlier draft checked out against fresh recomputation and none of it was fabricated, but the ordering (write-up before verification) is worth flagging for whoever runs this pipeline next. This committed document was authored fresh, after both the build and the verification passes, and reflects the corrected framing throughout.',
  ],
}
