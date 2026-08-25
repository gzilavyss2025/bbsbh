// Diary entry — the pass that checked the ruler before theorising about what
// it measured, and found the ruler was most of the story. It also carries this
// body of work's two retractions, which is why they get their own section
// instead of being folded into the prose: a retraction that is hard to find is
// a retraction nobody reads.
export const humpArtifactEntry = {
  id: 'movement-hump-artifact',
  date: '2026-08-24',
  source: 'PR #884',
  doc: 'docs/team-movement-windows.md',
  title: 'The late-2010s slowdown never happened',
  verdict: 'corrected',
  question:
    'The earlier work found that promotions slowed down sharply between 2016 and 2020, and called it the most interesting loose end in the whole study. Front-office fashion? The 2021 reorganization? What happened?',
  headline:
    'Nothing happened. The slowdown was never in the game — it was in our own ruler. And while checking it, a second and worse problem turned up: about one stay in eight was counting a big leaguer\'s trips up and down from Triple-A as if it were a prospect climbing the ladder.',
  sections: [
    {
      id: 'per-year',
      heading: 'Look at it a year at a time and the hump disappears',
      prose: [
        'The original finding came out of sorting the seasons into three big buckets and comparing one bucket against another. Break the very same data out one year at a time and there is no bump left to explain. Every year from 2011 through 2019 lands in the same narrow band, somewhere around nine or ten months.',
      ],
      table: {
        caption: 'Typical days at a level, by the year the stay ended',
        columns: ['Year', 'Days', 'Players'],
        rows: [
          ['2009', '50', '41'],
          ['2010', '126', '126'],
          ['2011', '285', '191'],
          ['2012', '282', '206'],
          ['2013', '282', '232'],
          ['2014', '270', '259'],
          ['2015', '303', '239'],
          ['2016', '286', '305'],
          ['2017', '318', '238'],
          ['2018', '327', '222'],
          ['2019', '302', '261'],
        ],
        note: 'Look at 2009 and 2010 against everything below them. Those two years are the story.',
      },
      proseAfter: [
        'Picture the three buckets as three fence posts. The middle one looked tall. It was not tall. The two posts on either side of it had sunk into the ground. What the buckets read as a peak in the middle was the two ends sagging. Nothing rose. The edges fell.',
      ],
    },
    {
      id: 'three-artifacts',
      heading: 'Why the edges sag — three reasons, none of them baseball',
      points: [
        'The transaction wire barely exists before 2009. There are 457 minor-league assignment records for the whole stretch from 1997 to 2008, against 290,690 from 2009 onward. To date a stay you need a record at each end of it, so a stay that ended in 2009 can only be traced back as far as the paperwork goes — at most about nine months, whatever really happened to the man. Those early years are not short. They are cut off. 2011 is the first year that can hold a full-length stay, and that is where the cutoff comes from.',
        'There was no minor-league season in 2020. Any stay with that empty year sitting inside it gets stretched by a calendar with no baseball in it — 218 of them.',
        'And then our own rules threw the stretched ones out. The pipeline discards any stay longer than 900 days as impossible, which deleted 48 of the stints the lost season had inflated, most of them ending in 2021. So the missing season shoves the late bucket up and our own cutoff drags it back down. Neither one has anything to do with how fast clubs promote players.',
      ],
    },
    {
      id: 'corrected',
      heading: 'What is left once all three come off',
      table: {
        caption: 'Typical days at a level, by era, as the corrections are applied',
        columns: ['How it was measured', 'Through 2015', '2016–2020', '2021–2023'],
        rows: [
          ['As originally published', '264', '324', '262'],
          ['Drop the years the wire cuts short', '283', '324', '262'],
          ['Also subtract the lost 2020 season', '283', '300', '265'],
          ['Or instead drop 2020 and 2021 entirely', '283', '311', '269'],
        ],
      },
      proseAfter: [
        'The peak shrinks from 23 percent above the early years down to 6 or 10 percent. The last two rows handle the pandemic in deliberately opposite ways — one adjusts for it, the other refuses to adjust and throws the disrupted years in the bin — so the answer does not depend on the adjustment being right.',
      ],
    },
    {
      id: 'wire-free',
      heading: 'The check that settles it: measure the same thing with a different ruler',
      prose: [
        'That leftover 6 to 10 percent could still be real. There is one way to find out, and none of the three problems above can touch it. Put the calendars and the transaction logs away. Count how many seasons a man spent at a level, and how many times he came to the plate there. Both of those come straight off the back of his baseball card. No transaction record goes anywhere near them, so no transaction-record problem can reach them.',
        'And the logic is airtight. If prospects in the late 2010s really were sitting ten percent longer, they had to be piling up more seasons and more at-bats while they sat there. There is nowhere else for the time to go.',
      ],
      table: {
        caption: 'Same players, measured without the transaction log',
        columns: ['Arrived at the level in', 'Player-levels', 'Seasons spent there', 'Plate appearances'],
        rows: [
          ['2011–2015', '1,586', '1.487', '442'],
          ['2016–2018', '970', '1.490', '448'],
        ],
        note: 'Identical for all practical purposes — three thousandths of a season and six plate appearances apart.',
      },
      proseAfter: [
        'Flat. The late-2010s prospect sat at a level exactly as long as the early-2010s prospect did. That is the lesson worth carrying out of all this: when you suspect your ruler, do not stand around arguing about the ruler. Go find a different one that cannot share the same fault, and measure the thing again.',
      ],
    },
    {
      id: 'resolver',
      heading: 'The bug found on the way, and what it cost',
      prose: [
        'To date a stay, the code walks forward through a player\'s paperwork looking for the move that ended it. When a prospect\'s early records were thin, it ran clean off the end of his minor-league history and just kept walking — straight into the options and rehab assignments from his big-league years. So it would close out a Double-A stay using a shuttle trip the man took three years later, as an established major leaguer.',
        'That was 434 stays out of 3,549 — better than one in eight — ending after the man had already debuted in the majors. Roster churn was being filed as player development.',
        'The fix is to stop reading a player\'s paperwork at his debut. Because the bad records all sit at the tail end of a career, the fix can only ever take rows away. It cannot corrupt a row that was already right. That was checked rather than assumed: no new rows appeared, not one surviving row changed its value, and every row removed did in fact end after the man\'s debut.',
      ],
      table: {
        caption: 'What changed when the bad rows came out',
        columns: ['', 'Before', 'After'],
        rows: [
          ['Stays we could date', '3,278', '3,019'],
          ['How much of the variation the model explains', '4.3%', '7.2%'],
          ['Clubs standing clear of the pack', '0 of 30', '0 of 30'],
          ['Clubs surviving the strictest correction', '0 of 30', '0 of 30'],
        ],
      },
      proseAfter: [
        'Throwing out 259 stays nearly doubled how much the model could explain. Those rows were not data. They were static.',
      ],
    },
    {
      id: 'retractions',
      heading: 'Two things we take back',
      points: [
        'That clubs matter a little, taken all together. The earlier entry said a player\'s organization carries a real if tiny effect. Once the era corrections come off, the two independent ways of testing that stop agreeing with each other — one still says yes, the other says no — and the slice of the differences you can pin on the club falls to roughly nothing. When two honest methods split, the honest report is that it is unsettled. Not that one of them won.',
        'That one particular correction always makes a result less certain. The earlier adversarial review stated that as an established fact and marked it confirmed. It is not true here: for 18 of the 30 clubs the correction made the result MORE certain, not less. That is why the Rays get stronger under it while Washington gets weaker, and why the two methods hand back opposite lists of notable clubs. Never assume which way a correction pushes. Measure it.',
      ],
    },
    {
      id: 'tampa-holds',
      heading: 'Tampa Bay comes out of this stronger',
      prose: [
        'The Rays clear every corrected version of the test — 33 percent, 29 percent and 34 percent slower than the league at their levels — and they are the only club that does. Cleveland and Milwaukee pass on the full range of years and then fall out the moment the era corrections go on, which is the same wobble that disqualified everybody else.',
      ],
    },
  ],
  caveats: [
    'The baseball-card check stops at 2018 on both ends, and that boundary is forced rather than chosen: it counts seasons, and 2020 had no season to count. So it speaks to the supposed rise into 2016–2018 and says nothing at all about 2019 or 2020. That is a real gap and it is not papered over.',
    'The wire got much denser over the same years — 13,731 assignment records in 2011 against 27,284 in 2019 — and denser records do go with longer measured stays. But the density climbs almost perfectly in step with the calendar, so this cannot tell "better records, longer measurements" apart from any other trend across those nine years. It is offered as consistent with the explanation, not as proof of it.',
    'The obvious objection — "you just deleted the rows that disagreed with you" — was tested instead of argued about. Two hundred random deletions of the same size were run for comparison. The targeted removal sits at the bottom of that range on every measure, while the random deletions leave the answer where it started. The rows that came out were not a random slice.',
  ],
  open: [
    'None of this changes what ships. No club stands clear of the pack at any level, none survives the strict correction, and how a player is performing remains the strongest thing in the study.',
  ],
  technical: [
    'Per-year granularity, wire-density audit and era specifications S0–S5 in .scratch/level-benchmarks/era-hump.mjs; the org refit in era-hump-org-recheck.mjs.',
    'Wire-free check: seasons-at-level and PA-at-level off yearByYear. 1.487 vs 1.490 seasons, Kruskal-Wallis H(1)=1.051, p=0.31.',
    'Resolver fix in dates.mjs drops wire events dated after the MLB debut before matching. 434 of 3,549 (12.2%) affected; 259 rows removed; 0 new, 0 changed.',
    'Post-fix omnibus: cluster-robust Wald F=1.962 (p=0.0018), player-collapsed ANOVA F=1.495 (p=0.0444), ICC 1.0%. After era corrections the two split (Wald p=0.019–0.028, ANOVA p=0.13–0.47) and ICC falls to 0.62% then 0.00%.',
    'Cluster-robust intervals are NARROWER than naive for 18 of 30 orgs (ratio 0.72–1.54, median 0.99). Tampa Bay p=0.00008 under CR; Washington rises to 0.106.',
    'Left-censoring mechanism: an assignment-to-assignment duration needs a wire record at both endpoints, so any stay terminating before the wire densifies is truncated at the wire\'s own start. 457 assignment records across 1997–2008 against 290,690 from 2009 forward. The per-year medians expose it directly — 50 days in 2009 and 126 in 2010 against 270–327 for every year 2011–2019 — which is why 2011 is the first admissible cohort year.',
    'Pandemic handling: 218 durations span the cancelled 2020 season; the pipeline\'s 900-day plausibility cap then removes 48 of the inflated stints, most terminating in 2021. The two remedies are deliberately opposed — subtract the missing season (S-row 3) versus drop 2020 and 2021 outright (S-row 4) — and they bracket the residual era gap at 6% and 10% against the 23% originally published.',
    'The variation-explained figures in the resolver table (4.3% → 7.2%) are model R² before and after the debut-truncation fix, on 3,278 and 3,019 datable stays respectively. The org-level conclusions are invariant across the fix: 0 of 30 orgs separate at any level and 0 of 30 survive the strict correction, both before and after.',
    'Deletion-placebo: 200 random removals matched on n against the targeted removal. The targeted removal is extremal on every reported statistic; the random draws recover the pre-fix values, so the shift is attributable to WHICH rows left rather than to how many.',
  ],
}
