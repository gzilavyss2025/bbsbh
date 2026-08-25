// Diary entry — the correction to price-the-blockage.js below it. That entry
// ran on 864 of what should have been 962 Triple-A stays, and its "survives
// lagging" claims turned out to be running on a job description that was
// still half reading the present. Three bugs, all silent, are fixed here.
// Two new things came out of fixing them: a real transaction-verified read of
// why every stay actually ended, and a real, significant number that this
// entry reports and then rules out, because it fails the test the whole
// study is built to apply to itself.
export const blockageCorrectedEntry = {
  id: 'blockage-corrected',
  date: '2026-08-25',
  source: 'PR #908',
  doc: 'docs/price-the-blockage.md',
  title: 'What the missing ninety-eight stays were hiding',
  verdict: 'corrected',
  question:
    'The entry below this one answered a question on 864 of 962 Triple-A stays, on a "measured a season before" test that turned out to still be half-measuring the present. What was in the missing 98, does the lag test actually hold up, and does either change the answer?',
  headline:
    'Mostly no, in the reassuring direction — the study gets more right than it got wrong. Two bugs were dropping stays for reasons that had nothing to do with baseball, and a third was quietly leaking the present into a test built to rule that out. Fixed and rerun on the full 962, the waiting answer is still no on five ways of asking out of six, and the position-change answer survives the toughest check anyone has run on it yet: a model that weighs it and the trade question together, so neither one can borrow credit from the other. The sixth way of asking about waiting — the one this whole correction exists to redo properly — turns up a real number for the first time in this study. It does not survive being checked the way this study checks everything else, and this entry explains why it is reported anyway instead of quietly dropped.',
  sections: [
    {
      id: 'what-was-wrong',
      heading: 'What was actually wrong',
      prose: [
        'The first version of this study quietly ran on 864 stays out of a group that should have held 962. It said so, but it never went and found out what the missing ninety-eight actually were. They turned out to be two different bugs, not one. And a third bug, found while building this fix, means every claim in the first entry about something "surviving being measured a season earlier" was never really tested the way it said it was.',
        'The first bug: a pitcher\'s rate stat was only worked out if his ERA was above zero. A pitcher who had not yet given up a single earned run at the level — rare, but real, and it happens to the arms a club uses for short outings — has an ERA of exactly 0.00. That failed the check, and he silently dropped out of the model as though his season had never been played. Twenty-three stays, and all twenty-three were strong ones.',
        'The second cost more. This whole study needs the big-league debut date of the man ahead of the prospect, and sixty-eight real incumbents — Jamey Wright and Fernando Tatis Sr. among them, looked up live to be sure — had simply never been fetched. Not missing from the record. Never asked for. Seventy-five stays lost the man ahead of them because of it.',
        'The third one is worth understanding even if you skip everything else here. This study keeps asking whether something "survives" being measured a season before the stay begins. The whole point of that test is that the prospect cannot have caused a description of the roster written a year before he showed up. But the test only ever moved two of the six things it describes about the job above him. The other four — how crowded the job is, how old the man holding it is, how well his club is doing, how long he has held it — kept quietly reading the CURRENT season, no matter what the test claimed to be checking. So every "this survives lagging" sentence in the first entry was, to some real degree, still reading the present.',
      ],
    },
    {
      id: 'what-held',
      heading: 'What changed, and what did not',
      prose: [
        'All three bugs are fixed and the whole pipeline reran clean on the full 962 stays, with every backdated measurement genuinely backdated. Most of what the first entry said holds up.',
      ],
      table: {
        caption: 'The headline numbers, before and after the fix',
        columns: ['Result', 'First entry (864 stays)', 'Corrected (962 stays)'],
        rows: [
          ['Does the job above him predict how long he waits — five of six ways of asking', 'No, on all six', 'No, on five of six — see below for the sixth'],
          ['Hitters who arrive at a different position', '36.1%', '33.6%'],
          ['Hitters who arrive further down the ladder', '25.1%', '23.4%'],
          ['Position result, once you set position aside', 'holds', 'holds, essentially unchanged'],
          ['A real blockage — one owner, past his control window', '11.7% of stays', '12.4% of stays'],
          ['Cost of the move (WAR over 6 seasons)', '−2.08, too small to trust', '−2.26, too small to trust'],
        ],
        note: 'The position-change result also passed a new, tougher check this pass added — see "the strongest check yet," below.',
      },
      proseAfter: [
        'The five named blocked prospects the first pass found by eye — Austin Riley, Ryan Rua, Joshua Fuentes, José Miranda, Mike Tauchman — are all still there on the corrected data, still exactly as blocked as they looked before.',
      ],
    },
    {
      id: 'the-lag-fix',
      heading: 'The lag test, actually redone, tells a smaller story than before',
      prose: [
        'Here is the part the first entry has to take back. Now that every piece of the job description is genuinely read a season early, and each man is compared only against others at his own position — the toughest version of this test — nothing survives except the one term this study already does not trust (see the caveats). The first entry said plainly that a crowded job "survives and strengthens" when you measure it a season early, and that the club\'s winning percentage does too. Both of those were worked out on the half-fixed test. Neither one actually clears that bar once position is held steady AND the backdating is real.',
        'Loosen just the position control, and a crowded job on its own — predicting a position change of any kind, rather than a move specifically down the ladder — does come back strongly on the properly backdated data. So the honest, narrower version of the claim is this: a crowded job measured a season early predicts a future position change in general. On this group of players, it does not clear the bar for the tighter "moved down the ladder" question once position is also held steady, which may just mean this slice of the data is too small to carry both tests at once. What was never true, in the first entry or this one, is the contract-years claim — years of control remaining never survives a genuine backdating, in any version of this test, on any group.',
      ],
    },
    {
      id: 'the-asterisk',
      heading: 'A real number that fails its own test',
      prose: [
        'Fixing the backdating also meant rerunning the plain waiting-time question — not just the position-change one — with the job genuinely described a season early. And for the first time in this study, that turns up something real: a solid signal, comfortably past the usual one-in-a-hundred bar for a surprise, that a MORE crowded job a season earlier goes with a LONGER wait, not a shorter one. It gets stronger, not weaker, when the stay is counted in calendar days instead of season days. It also holds up when you throw out the most extreme 1% of stays at either end, so it is not a handful of freak cases dragging the whole thing along.',
        'This is exactly the kind of surprising number that could rewrite the headline of the whole study. So it was put through the same tests this study uses on itself — and it fails every one of them.',
      ],
      points: [
        'It is nearly absent exactly where blockage should hit hardest — catcher, shortstop, centre field — and it even points the wrong way there. It shows up strongest in the fifth starter\'s job, which this study\'s own rules already call the LEAST scarce pitching role there is, not the most.',
        'It is a pitcher pattern far more than a hitter one. The position-change finding is entirely about hitters and the defensive ladder; this signal barely touches them at all.',
        'Sort the stays into three groups by how crowded the job was, with no model or math involved — just the actual middle wait in each group — and the pattern does not even move in one direction. It goes up, then back down. A real blockage effect should climb steadily as the job gets more crowded, or fall steadily. This does neither.',
      ],
      proseAfter: [
        'Read plainly: this is a real number, and it is not evidence of blockage. It reads like something about how pitching staffs get built and cycled through — not the thing this study set out to measure. It is kept in the write-up rather than quietly dropped, because a number a study\'s own checks kill is still worth a record, and because whatever is actually producing it is a fair question for somebody else to chase.',
      ],
    },
    {
      id: 'the-new-thing',
      heading: 'What was not asked for: reading the actual transaction',
      prose: [
        'Building the fix meant re-pulling the transaction wire anyway, and once it was in hand there was a better way to answer a question the first entry could only guess at: why did each stay actually end? The first pass worked it out from the level change alone. This one reads the real move off the wire — for the prospect, and for the man ahead of him in the three weeks before. It looks for an injury, a designation for assignment, a trade, a release, or a waiver claim that would explain why the job opened up.',
      ],
      table: {
        caption: 'Why the stay actually ended, read off the transaction wire',
        columns: ['Reason', 'Stays', 'Share'],
        rows: [
          ['Merit — a clean promotion, nothing else on the wire explains it', '573', '59.6%'],
          ['A roster-rule event — the incumbent DFA’d, traded, released, waived, or a September call-up', '187', '19.4%'],
          ['Injury — the incumbent hit the injured list in the three weeks before', '137', '14.2%'],
          ['Settled earlier — he was already on the roster well before this "debut"', '27', '2.8%'],
          ['Demoted — the stay ended in a further assignment down, not a promotion', '20', '2.1%'],
          ['Unresolved — no matching transaction found', '16', '1.7%'],
          ['Traded — the prospect himself changed organizations', '2', '0.2%'],
        ],
        note: 'Three in five Triple-A stays end in a promotion with no roster-rule or injury signal attached at all.',
      },
      proseAfter: [
        'That is a real, transaction-verified number where the first entry only had a rough stand-in. Keep only the clean merit promotions — the 573 stays where blockage has the clearest shot at mattering, since nothing else is forcing the timing — and the waiting answer is still no. Feed the exit reason into the model as a control instead of cutting down to it, and the job terms go out entirely: the exit reason and the job description overlap so heavily that a model holding both has nothing distinct left for the job description to explain. Either way, the plain "no" holds.',
      ],
    },
    {
      id: 'the-joint-check',
      heading: 'The strongest check yet on the "yes"',
      prose: [
        'The position-change result, the trade result, and staying put were each checked on their own in the first entry, which risks one outcome borrowing credit from another. A prospect who changes position and a prospect who gets traded are not two unrelated events; they are two answers to the same closed door. Weighing all three together, as one outcome with three possible endings, closes that gap.',
        'The position-change result comes through completely unchanged — every term in it is essentially identical to what the separate check produced. This is the toughest test this study has run on its headline finding, and it passes cleanly.',
        'The trade side is where something moves. On its own, a crowded job looked like it predicted a trade. Weighed against position change at the same time, that drops to about coin-flip confidence. Some of what looked like "a crowded job predicts a trade" turns out to be the same signal as "a crowded job predicts a position change," counted twice. The trade result was never the point of this study, and this does not touch the "no" on waiting. It is recorded because catching exactly this kind of double-counting is what the joint check is for.',
      ],
    },
  ],
  caveats: [
    'The backdated crowded-job waiting-time signal is real by the standards anybody would normally apply, and it survives dropping the extreme cases, but it fails this study\'s own attempt to break it on every axis checked. No claim in this document treats it as evidence of blockage. What is actually driving it is not known.',
    'How well the man ahead of him is playing is unreliable from one version of the test to the next — wrong-signed in one place, and the one term that keeps turning up strong in tests meant to show nothing at all. Every other term here tells a consistent story across every cut; this one does not, and nothing here rests on it.',
    'The exit-reason numbers are new and verified against the wire, but they have only been checked against the waiting model, not against the position-change model or the WAR-pricing one.',
    'This correction does not revisit whether the original job-construction rules — who counts as "the job," how control years are worked out — are themselves right. It only asks whether the pipeline that implements them ran cleanly, and whether its own robustness tests actually tested what they claimed to.',
  ],
  open: [
    'What is actually behind the backdated crowded-job waiting-time pattern, since it is real but does not fit this study\'s own theory. It looks like a pitching-staff-construction question, not a blockage one.',
    'Do merit promotions, roster-rule promotions and injury-driven promotions differ on any of the OTHER blockage measures — position change, the WAR cost of a move — the way they have now been checked against waiting?',
    'The "settled earlier" group — 27 stays where the roster decision predates the debut this group of stays is built around — is small but its own honest finding, not investigated further here.',
  ],
  technical: [
    'Bug 1: model.mjs gated a pitcher\'s rate on ownEra > 0, dropping any 0.00 ERA cumulative line as null. 23 stays. Bug 2: incumbent-bio.json lagged incumbent-ids.json by 68 personIds, all of whom returned a valid mlbDebutDate on a live re-fetch. 75 stays. Bug 3: jobCols(r, useLag) only ever switched jobQZ and controlLeft on the lag flag; jobDepth, jobAge, orgWinPct and jobTenure read the concurrent season regardless. Fixed in model.mjs, deepen.mjs and confound.mjs identically.',
    'All model output reproduced independently against the committed cache: hydrate-incumbents.mjs, model.mjs, deepen.mjs, confound.mjs and check.mjs were rerun end to end and produced byte-identical JSON to the versions committed with this entry.',
    'The lagged waiting-time result: all-stays, season days, F(6,946)=2.87, p=0.0089, deltaR2=0.0155, depth term b=0.0643 p=0.0004. Calendar days: F(6,946)=5.09, p=0.00004. Winsorized at p1/p99 of activeDays: F(6,927)=3.30, p=0.0032. Falsification by scarcity: scarce F(6,188)=0.39 p=0.88 (depth term wrong-signed); mid F(6,97)=2.37 p=0.035; open F(6,136)=2.10 p=0.057; rotation F(6,294)=1.32 p=0.25 (depth term alone p=0.041, overall test not significant); bullpen F(6,172)=0.28 p=0.95. By group: pitchers F(6,481)=2.37 p=0.029; hitters F(6,451)=1.26 p=0.28. Descriptive tercile split on lagged depth (no model): low n=318 median 96 days, mid n=386 median 107, high n=258 median 92 — not monotonic. Diagnostic script: .scratch/blockage/diag-lagged-waiting.mjs, not part of the committed pipeline.',
    'Confound-plus-lag, position held fixed, moved-down-the-ladder outcome, n=458: control years OR 0.843 p=0.77, depth OR 0.827 p=0.21, age OR 0.983 p=0.77, win pct OR 3.62 p=0.43, quality OR 1.436 p=0.014. Without position fixed effects, depth alone on "changed position" (any direction), lagged: OR 0.698 p=0.0001.',
    'Exit reasons (join-txn.mjs, matched on transaction date not effectiveDate — date took the match rate from 659/962 to 946/962): merit 573 (59.6%), rosterRule 187 (19.4%), injury 137 (14.2%), settledEarlier 27 (2.8%), demoted 20 (2.1%), unresolved 16 (1.7%), traded 2 (0.2%). Merit-only waiting model: n=573, deltaR2=0.0036, F(6,561)=0.39. Full model with exit-reason dummies as controls: job terms all reduce toward zero (depth beta exactly 0.0000).',
    'Joint three-way model (multinomial(), lib.mjs), hitters only, n=458, classes {stayed: 295, traded: 20, positionChanged: 143}, McFadden=0.114. positionChanged class: control years OR 0.225 p=0.0052, depth OR 0.753 p=0.0018, age OR 0.848 p=0.0018, quality OR 1.363 p=0.0094, win pct OR 25.6 p=0.024 — matches the independent binary fit closely. traded class: depth OR 1.361 p=0.067 (independent binary fit: OR 1.48, p=0.017).',
    'What this entry RETRACTS from price-the-blockage, stated as the specific numbers: that entry\'s lagged refit reported depth OR 0.618 (p = 0.0015) and win pct OR 1.67 per .100 (p = 0.0028) as surviving the lag. Both were produced by the Bug 3 pipeline, in which jobDepth and orgWinPct were never lagged at all. Under a genuine lag with position fixed effects they are depth OR 0.827 (p = 0.21) and win pct OR 3.62 (p = 0.43) — neither significant. The contract-years claim is unchanged in either direction: it failed the lag before (OR 0.840, p = 0.68) and fails it now (OR 0.843, p = 0.77).',
    'Cohort-level deltas from the refetch, 864 → 962 stays: changed position 36.1% → 33.6%; moved down the ladder 25.1% → 23.4%; single-incumbent-and-out-of-control prevalence 11.7% → 12.4%; six-season WAR cost of a move down b = −2.08 → −2.26, not significant in either pass.',
    'The falsification battery this entry applies to its own new lagged-depth waiting signal is the same one price-the-blockage applied to its pitcher quality term: scarcity subsets, hitter/pitcher split, and a model-free tercile monotonicity check. Failing all three is the stated reason the signal is reported and then set aside rather than promoted.',
  ],
}
