// Diary entry — the first one on this page written from the other chair. Every
// entry under it is a study. This one is a reading OF the studies by the person
// who commissioned them, and it adds no measurement of its own.
//
// It is filed under its own verdict for that reason. "Holds up" would claim a
// finding survived checks, and nothing here was checked; "not shippable" would
// claim something was asked and answered. What this is instead is the half of
// research that usually happens in a meeting and then evaporates: somebody
// reads the stack, says what it means for the work, and hands back a list of
// things to go and measure. Written down and dated, it is a record of what was
// believed on a day — which is the same reason every other entry here is dated.
export const frontOfficeEntry = {
  id: 'front-office-read',
  date: '2026-08-25',
  source: 'PR #901',
  doc: 'docs/level-tenure-benchmark.md, docs/team-movement-windows.md, docs/homegrown-dependence.md, docs/prospect-traits.md',
  title: 'What eight entries look like from the front office',
  verdict: 'agenda',
  question:
    'Eight studies, and four of them end in no. On Monday somebody has to sit in a room and say what all of this bought us, and what to build next. So: what does the whole stack say that no single entry says?',
  headline:
    'That there is no secret in how other clubs develop players — or none you can see from outside the building. A club\'s name does not tell you how fast its prospects move. Building from within wins no games. The quality of a farm does not separate the four clubs still playing in October; the headcount does. Take all the nos out and two things are left that nobody here has put a price on: the job standing above the prospect, and the fact that every promotion is a rival front office saying out loud what it believes.',
  sections: [
    {
      id: 'the-nothings',
      heading: 'Start with the four nos, because they are the most valuable thing on this page',
      prose: [
        'Four of these entries end in no, and a fifth takes back part of a sixth. As a return on four months of work, that reads thin. From this chair it is the opposite. Every no on the list is something people in this game say out loud and with confidence. Now we know what saying it is worth.',
      ],
      table: {
        caption: 'Things people say, that this work says are not true',
        columns: ['The claim', 'What the work found'],
        rows: [
          [
            'That club moves prospects slowly',
            'Not one club in thirty stands clear of the pack, at any level, in either sample',
          ],
          [
            'Promotions slowed down in the late 2010s',
            'A fault in the ruler. Two clipped years at the front of the record, one missing season, and our own filter deleting what the missing season had stretched',
          ],
          [
            'Build from within and you win more',
            'Somewhere between two thirds of a win worse and two wins better per season. Nothing',
          ],
          [
            'The best prospects are held back for August',
            'The award calendar looking at itself in a mirror. Gone once you count only trophies won in earlier seasons',
          ],
          [
            'A big arm gets a man there sooner',
            'Not in summers. The hardest throwers spend about the same number of years, and far fewer innings inside them',
          ],
          [
            'Repertoire separates the arms',
            'Worth nothing at all, once you know whether he starts or relieves',
          ],
        ],
      },
      proseAfter: [
        'Every one of those is a belief somebody would act on, and two of them have been said out loud in this building. The value of a no is that it stops you paying for something.',
        'It also points somewhere. If nothing about how a club is run shows up from the outside, then the edge is not in being a better development shop than the club across the table. It is in the two places this work kept brushing past on its way somewhere else.',
      ],
    },
    {
      id: 'the-queue',
      heading: 'The first: Triple-A is a waiting room, and nobody has priced the wait',
      prose: [
        'Picture a 24-year-old at Triple-A with nothing left to prove there. He is hitting. He is ready. And in the big leagues, at his position, sits a healthy 30-year-old signed for three more years. Nothing about that young man\'s clock has anything to do with that young man.',
        'The benchmark says the Triple-A stay is the shortest of the four rungs and by some way the widest — six weeks for one man, the better part of two years for another. Then it says the honest reading in a single line and moves on: a Triple-A stay is often not about the player at all. It is about whether there is a job open above him.',
        'The homegrown entry gets to the same place from the other end. In a season where a club carried more of its own men in the majors than that club usually carries, its prospects sat about a month longer at Double-A the year after. That entry is careful to call it a pattern rather than a cause, and it names the natural story anyway: a club with eight homegrown regulars has no openings, and a prospect with nowhere to go stays where he is.',
        'Anybody who has spent a season around a farm system has watched this happen. It has a name in every clubhouse. What it does not have anywhere is a number.',
        'That gap is worth money in both directions. If the man ahead of him is the biggest single thing setting a prospect\'s clock, then a blockage is a price. Ours is a cost we pay every year without ever writing it down. Somebody else\'s is a discount on a player who is not actually any worse.',
      ],
    },
    {
      id: 'revealed-opinion',
      heading: 'The second: a promotion is a rival front office telling you what it thinks',
      prose: [
        'Two entries land on the same thing from different directions. The fastest third of graduates were worth about a win more across their first six seasons, and went bust a third less often. The rookies worth two wins had spent a year less in the minors than the rookies who were not. Both entries then say, correctly, that nobody was ever made better by being rushed. Clubs move the men who are already too good for the level.',
        'Now read that last sentence again from this side of the desk. It says a promotion is a club\'s own opinion, published. Twenty-nine other front offices pay people to watch these players every night, and every time one of them moves a man up early, it is telling us something its scouts believe and its box score does not show yet.',
        'The work already hints that the signal is bigger than the box score. Most of the gap between the fast movers and the slow ones is still there after you take account of how the men were hitting at the time. Most of it — not all of it. Whatever is left over is another club\'s scouting report, and it is free.',
      ],
    },
    {
      id: 'tampa',
      heading: 'And I am not willing to file Tampa Bay as a footnote',
      prose: [
        'Ask thirty clubs the same question and two or three will look special on luck alone. The work knows this, tests for it, and hands back exactly one club that survives everything: seven ways of counting, era corrections on and off, and an entirely different set of players. Tampa Bay is slow in all of them, by about a third.',
        'The entry calls that a footnote rather than a feature. For a page in this app that is the right call. For a front office it is not. The two results are not in conflict — twenty-nine clubs doing roughly the same thing and one club doing something else is precisely what "clubs as a group explain almost nothing, and this club is slow under every method" looks like.',
        'So the question I want asked is not whether. It is what the one club is doing, which is a smaller question and a far more answerable one than the question the study was originally given.',
      ],
    },
    {
      id: 'small-effects',
      heading: 'One place I read the same numbers differently',
      prose: [
        'Three entries deflate themselves, and the deflation is always the same sentence: this improves your guess about any one prospect by less than half of one percent. That is fair and necessary when the question is whether to build a feature out of it. I think it is the wrong frame for the room I sit in.',
        'We do not make one decision. We make a couple of hundred a year — who to protect, who to option, who to ask for in the third slot of a trade, which of two similar arms to take at pick 40. A thumb on the scale, laid on enough of those, is how this job gets won. Which is why a finding being real matters more to me than a finding being big.',
        'The caution is still right about the thing it is protecting, and I want it kept exactly where it is: none of this beats a scout on any single player. It is not for single players.',
      ],
    },
    {
      id: 'asks',
      heading: 'What I would like built next',
      prose: [
        'Seven of them, ordered by what I would fund first rather than by how hard they are. Three need something this club does not currently hold, and I have said which.',
      ],
      points: [
        'PRICE THE BLOCKAGE. For every Triple-A stay, describe the job above the man. Who holds it. How he is playing. How many years he is signed for. Whether he can be moved. Then ask whether that description predicts the length of the stay better than the prospect\'s own numbers do. The Triple-A stay is the widest and most job-shaped number in the whole benchmark, so if the answer is anywhere, it is there. Get it and we can put a price on a blocked prospect — ours, and everybody else\'s. This is the one I would fund first.',
        'BUILD THE BUST LIST. Every single entry on this page carries the same confession: everybody in it reached the majors. Eight studies, one missing half, and it is the half this job is about. The level-tenure entry says why nobody has done it — there is no clean signal for when a career ended. So find a dirty one and defend it in public. Released, with no affiliated game in the two following seasons. Or no affiliated game for two seasons at all. Or either of those past an age floor. Then publish how far the answers move when you change the rule. The cheap first test is already written down in the rookie-traits entry: minor leaguers who never graduated still have a listed height and weight, so compare the heavy men who made it against the heavy men who did not. That tells us inside a week whether size is an edge or just what a club looks for when it decides who gets the at-bats.',
        'SCORE THE SURPRISE. The benchmark already says what a normal stay looks like at each rung, so the difference between a man\'s real clock and the benchmark one can be worked out today. Call it surprise. Two questions follow. Does surprise tell you anything about what a player does in the majors, once his minor-league numbers are already accounted for? And whose surprises pay off? An answer to the second one is a scouting report on twenty-nine rival departments, built entirely out of public paperwork, and I do not believe anybody has one.',
        'ASK WHAT TAMPA BAY IS DOING. Not whether — that is settled across seven ways of counting. Where does the slowness live: one level, one position group, pitchers only, the forty-man or everybody else? Does it arrive at the same point of the season every year? Then the question that decides whether we copy it or ignore it: are their graduates any better for the wait? Match Rays graduates against faster men from other clubs on level, age and minor-league numbers, and compare the first six seasons. Patience that pays and patience that is merely slow look identical until somebody does that.',
        'TEST THE PITCHING-LAB EXPLANATION. The unusually light pitcher and the unusually heavy pitcher both wait about a third of a season longer, and the worry attached to that finding is that the whole thing sits in 2018 through 2023. I do not think those dates are a coincidence, and I do not think the cause is prejudice about odd bodies. Those are the years the pitching labs opened. So here is the test: a body that gets sent away and remodelled should come back throwing differently. We already pull the arsenal reading at debut. If the odd-bodied arms that waited longest arrive throwing harder than their signing reports said they would, the extra time was investment, and those are arms to buy. If they arrive throwing exactly what they always threw, it is a club being slow with a body it does not recognise — which is a market to shop in.',
        'DECOMPOSE THE THREE GRADUATES. The final-four entry says the clubs that get there raised 26 big leaguers over five years against 23. Three men, and it is the only club-level thing on this page that separates October. As it stands it is a finding and not an instruction. Where do the extra three come from — more international signings, more picks, better retention, fewer washouts out of the same intake? Break it apart that way and it turns into a budget line, and a budget line is a thing I can argue for in November.',
        'BUY THE PAYROLL HISTORY. Not a study — a purchase. Five entries name missing payroll as the best rival explanation for what they found, and one of them is reduced to using home attendance as a stand-in for the size of a market. Every club-level claim in this body of work is defensible right up to the moment somebody asks whether it is just money, and today the answer is that we cannot tell. Club payroll by season back to 2005 is compiled publicly. Buy it, load it, and rerun the four club-level entries. It is the cheapest thing on this list and it protects everything above it.',
      ],
    },
    {
      id: 'kill',
      heading: 'What a no looks like for each of them',
      prose: [
        'A house rule from this page, carried into the work: every one of these has to be able to come back and say no. So here is what no looks like in each case, agreed now rather than argued about afterwards.',
      ],
      table: {
        caption: 'The seven asks, and the result that would end each one',
        columns: ['The ask', 'What a no looks like'],
        rows: [
          [
            'Price the blockage',
            'The job above him adds nothing once the prospect\'s own numbers are already in the model',
          ],
          [
            'Build the list of players who never made it',
            'The answers move every time the rule for "his career ended" changes, and no rule can be defended over the others',
          ],
          [
            'Score the surprise',
            'Surprise tells you nothing beyond the minor-league numbers, or no club\'s surprises are worth more than any other club\'s',
          ],
          [
            'Ask what Tampa Bay is doing',
            'The slowness has no home — spread evenly across levels and roles, and their graduates are no better for it',
          ],
          [
            'Test the pitching lab',
            'The odd-bodied arms that waited longest arrive throwing exactly what they were always going to throw',
          ],
          [
            'Decompose the three graduates',
            'The extra three are spread evenly across every way of acquiring a player, so there is nothing in particular to buy',
          ],
          [
            'Buy the payroll history',
            'Payroll explains the club-level findings away entirely — which is worth knowing, and cheaper to learn than to keep guessing',
          ],
        ],
      },
    },
  ],
  caveats: [
    'There is no new measurement in this entry. It is a reading of eight studies by somebody who did not do them and cannot check the arithmetic in any of them. Where it disagrees with a conclusion above, it is disagreeing with an emphasis and not with a number.',
    'The "small edge, many decisions" argument is mine and it is not evidenced anywhere on this page. It is entirely possible that an edge of half of one percent is drowned by the noise inside every one of those two hundred decisions and never adds up to anything at all. Somebody should check that before I say it in a meeting again.',
    'An executive with no action to propose has nothing to propose, so I want these findings to imply action. That is a real bias and it points one way. Four of the eight entries here end in no, and the possibility I have to hold on to is that the next seven do too.',
    'The seven asks are ordered by my taste. Nobody has estimated what any of them would cost or what any of them would return, and at least three need data this club does not currently hold.',
    'Reading eight entries as one stack is a move the entries themselves warn against. The earlier four measure clubs and the newer four measure players; they do not share a group of players, a window of years, or a definition of who counts. Some of what is called a pattern across them here may be nothing better than numbers lined up that were never built to be lined up.',
  ],
  open: [
    'The one I cannot get at from this chair: every entry measures WHEN a man moved, and none of them measures WHO decided. A promotion is one person\'s call in a room, and the same club under two farm directors is two clubs. Nothing on this page can see that, and I do not know what data would.',
    'The reverse of the final-four entry is still the better question, exactly as its author said. Not what the four clubs had, but what the five clubs with none of them in twenty years were missing.',
  ],
  technical: [
    'Blockage: for each Triple-A stay, identify the incumbent as the modal starter at the prospect\'s primary position on the parent club inside the stay window; carry his rate line, service time and remaining contract years. Outcome log(days at level) against the existing level, tier and org controls. The number that matters is incremental R² over the current model, not a p-value.',
    'The list of players who never made it: compare three candidate exit rules — a release or minor-league free-agent record with no affiliated appearance in the two following seasons; no affiliated appearance for two consecutive seasons; either, with an age floor. Report every finding on this page under all three and publish the disagreement between them. The rule is more consequential than any result it produces.',
    'Promotion surprise: residual against the shipped level-tenure benchmark, per player-level, using its existing quartiles. Two models — WAR6 ~ surprise + minor-league rate + level + era, and the same with a club × surprise interaction for the rival-department read. Thirty clubs will be thin for the second; expect to pool by era.',
    'Tampa Bay: refit the org term with level, position group, forty-man status and month-of-move interactions. Then a matched comparison, Rays graduates against non-Rays graduates matched on level, age at level and minor-league rate, outcome WAR6.',
    'Weight U-shape: interact |zWeight| with the debut-season fastball residual against a signing-age and draft-tier prediction. The stated limit still bites and cannot be repaired from inside this data — the arsenal reading is taken after the promotion it is being used to explain.',
    'Graduate decomposition: partition the trailing five-year graduate count by acquisition channel (draft round bands, international signing, Rule 5, minor-league free agent, acquired before the first professional season) and refit the Championship-Series logistic with the channel counts entered separately. Eighty club-seasons will not carry five channels at once; expect to collapse to two or three.',
    'Payroll: club payroll by season, 2005–2023, entered as a within-season percentile to match the existing panel convention. Rerun the homegrown duration model, the winning-percentage model, the final-four logistic and the org-effect omnibus with it in.',
    'Provenance of the figures quoted in this reading, so a checker does not have to hunt: the −0.8-to-+2.4 wins-per-SD interval, the roughly one-month Double-A effect, and the fast-third WAR6 and bust-rate gaps all come from the homegrown-dependence entry; the 26-vs-23 five-year graduate counts and the count-not-quality split come from the final-four entry; the seven-method Tampa Bay result and the era-correction retraction come from the movement-windows correction. Nothing is recomputed here.',
    'The "half of one percent" this entry argues with is incremental R² on the order of 0.004 in the duration models. Nothing in the stack estimates what a small edge is worth once it is applied across many loosely independent decisions, which is exactly why the second caveat exists. A decision-count simulation with realistic per-decision noise would be the cheapest way to test the executive\'s claim rather than assert it.',
    'The three asks that need data the club does not hold are the blockage (incumbent job description per stay), the list of players who never made it (plus a defensible rule for when a career ended), and the payroll purchase. The other four — surprise, Tampa Bay, the pitching lab and the graduate decomposition — are refits or matches over data already in the repo. Ordering in the prose is by expected value, not by this split.',
  ],
}
