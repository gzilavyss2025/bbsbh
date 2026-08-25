// Diary entry — spike #5, and the first one in this program that does not
// measure a roster trait against the outcome ladder. It asks what is different
// about the GAMES, comparing the same men in the same year to themselves.
//
// Two first-pass findings did not survive this spike's own review and are not
// in this entry: "October at-bats are longer" (it collapses once both ends of
// the matchup are held, which is the method the spike is built on) and the
// strikeout surge as a settled result. Full method, every number, every
// sensitivity: docs/team-success-october-texture.md.
export const octoberTextureEntry = {
  id: 'october-texture-v1',
  date: '2026-08-25',
  source: 'Spike #5, commissioned directly',
  doc: 'docs/team-success-october-texture.md',
  title: 'October takes things away: the fifth pitch, the fifth inning, the fifth starter',
  verdict: 'holds',
  question:
    'Everybody says the same thing when the bracket starts: October is different. The at-bats feel like they last a week, the hitters look small, the manager is out of the dugout by the fifth. So we went looking for the difference — and then asked the question nobody asks: does any of it decide who goes home?',
  headline:
    'The difference is real and almost none of it is what people think. The at-bats are not longer. The hitters are not shrinking either — they are facing better pitchers, and once you allow for that the famous October collapse is somewhere between small and nothing. What changes is on the mound: everybody throws a little harder, the short outings get simpler, and the manager takes the ball an inning earlier than in July. And none of it appears to decide anything.',
  sections: [
    {
      id: 'the-image',
      heading: 'Twenty-four curveballs in a row',
      prose: [
        'Game seven of the 2017 American League Championship Series, in Houston. The winner goes to the World Series. The loser goes home for five months. In the sixth inning the Astros do a thing nobody does in June: they pull a healthy pitcher, bring in another starter, Lance McCullers Jr., and hand him the rest of the pennant.',
        'He throws fifty-four pitches. Seventeen of the first thirty are already his knuckle-curve, the big slow one that falls off the table on the way to the plate. By any normal standard that is a curveball-heavy night.',
        'Then normal stops. He throws the curve. He throws it again. He throws it twenty-four times in a row, all the way to Greg Bird flying out to George Springer to end the pennant, and he never throws anything else that season. The Yankees know what is coming. Forty thousand people know what is coming. It does not matter.',
        'That is October in one picture: a man throwing away most of what he can do, keeping the one thing he trusts, getting away with it. The question is whether the picture is true — one pitcher on one night, or the shape of the whole month.',
        'So we looked at every October since 2000, and every pitch thrown since the tracking cameras went up in 2008. There is only one honest way to ask it, and it is not "is October different from the summer." Of course it is — different men are playing. The question is whether the same man is different in October.',
      ],
    },
    {
      id: 'the-illusion',
      heading: 'Everybody knows hitters shrink in October. Everybody is watching the wrong man.',
      prose: [
        'The broadcast repeats it every night: good hitters get small in October. The pressure. The crowd. The cold. On the first try the numbers agreed so loudly it was embarrassing.',
        'The test is simple enough to do on paper. Take every man who batted in a postseason game, give him the trips to the plate October really gave him, and let him hit the way he hit all summer. Then put the real October beside it. The hitters fell short. Badly — by the gap between an everyday regular and a man who should not be in the lineup, in twenty-four of twenty-five years.',
        'And the number is worthless. We only found that out by running the whole thing backwards. Do it from the mound: every October pitcher, facing the hitters he really faced, pitching the way he pitched all summer. By that measure the pitchers fell short too, in almost every year.',
        'Read that again. In the same games, the hitters hit worse than they should have and the pitchers pitched worse than they should have. Both sides cannot be having a bad month against each other.',
        'What the first test measured was never October. It was the other guy. Think about a hitter in July: most weeks he faces somebody\'s fifth starter, or a kid up for a spot start, or the long man mopping up a blowout. None of those men are in October. Grade a hitter against his summer and you have handed him a harder test, then called him a worse student. The mirror does the same to the pitcher, who in July gets the bottom of a bad lineup twice a week.',
        'So we stopped grading one side at a time and asked it the way a fan asks it before the pitch: this hitter, against this pitcher — what should happen? Done that way the collapse shrinks to a shadow of the first number. How big a shadow depends on choices a reader should not have to trust us on. Change the arithmetic slightly and it halves. Set aside the men who batted fewer than ten times all October and it turns into a small rise.',
      ],
      table: {
        caption: 'Three ways to ask whether October hitters are worse',
        columns: ['How you ask it', 'What you get'],
        rows: [
          ['Grade the hitter against his own summer', 'A collapse — and a lie'],
          ['Grade the pitcher against his own summer', 'The same lie, from the other dugout'],
          ['Grade the matchup: this hitter, this pitcher', 'A small dip at most, and we cannot rule out nothing at all'],
        ],
      },
      proseAfter: [
        'The same trick was hiding in the thing fans feel most strongly: that October at-bats go on forever. Measured against the men actually playing, they are not longer at all. October hitters were already grinding out long at-bats in July, and October pitchers were already throwing plenty per man. Put the two together and the extra pitch vanishes.',
        'What survives is the walk. Asked the honest way, October hitters draw roughly one extra walk for every twenty they would otherwise have drawn. Strikeouts, asked the same way, come back too small to call. That is the reverse of what everybody says about October, and the reverse of what we wrote down on the first pass.',
      ],
    },
    {
      id: 'the-mound',
      heading: 'They throw harder. The short outings get simpler.',
      prose: [
        'McCullers was not the exception. He was the loud version of what almost everybody does.',
        'Put a thousand pitchers next to themselves — the same man, his summer and his October. In October his fastball is half a mile an hour faster. You could not see it, and no hitter alive could tell you it happened. What makes it worth writing down is that it is all of them at once, every October, for eighteen straight years.',
        'The mix narrows too, and that one needed a fair hearing first. Ask a man which pitch he threw most over a whole summer and you get an honest answer. Ask it about eleven October innings and the answer flatters him: over a short stretch somebody always looks like a favourite. So we cut each pitcher\'s summer down to an October-sized handful, drawn at random from his own real mix, and asked the shrunken version the same question. About a quarter of the narrowing was the short stretch. The rest was the pitcher deciding.',
        'But look where the rest lives. Among men who threw fifty to a hundred October pitches the narrowing is clear. Among men who carried a real October workload it fades to nothing. Velocity holds steady across that same split. This is not a story about short measurements. It is a story about short outings.',
      ],
      table: {
        caption: 'The same pitcher, his summer and his October',
        columns: ['', 'What changes in October'],
        rows: [
          ['His fastball', 'Half a mile an hour faster, everywhere we look'],
          ['His best pitch, in a short outing', 'He goes to it more'],
          ['His best pitch, over a real October workload', 'No change we can find'],
          ['Fastballs as a share of everything', 'No change at all'],
        ],
      },
      proseAfter: [
        'That last row is the surprise. Pitchers do not reach for the heater under pressure. When they simplify they drop the fourth pitch and the fifth — the show-me curve, the occasional cutter — and live on the two things they trust.',
        'Sean Manaea threw his best pitch about three times in ten for the Mets in 2024, and five and a half times in ten that October. Johnny Cueto did nearly the same in 2015, and so did Yordano Ventura — same rotation, the Kansas City club that won the World Series throwing roughly half of what it knew. None of them found a new pitch. They stopped throwing the other ones.',
      ],
    },
    {
      id: 'the-hook',
      heading: 'The hook keeps getting quicker. It has never won a thing.',
      prose: [
        'Now the part everybody has noticed, including everybody who complains about it.',
        'Six hundred pitcher-seasons here belong to men who started a postseason game and had started all summer long. Put each one next to himself. In July he gives his manager just over six innings. In October, just over five. A full inning, every start, gone.',
        'Clubs use half an extra pitcher per game in October, in twenty-four of twenty-five seasons, and it is speeding up. Early this century an October starter lost about four-fifths of an inning against his own form. Since 2013 he loses a full inning and a quarter. Managers do not simply manage October differently. They manage it more differently every year.',
        'We first wrote down that this was a decision rather than exhaustion. That was too neat. Split those starters by how they actually pitched: the men who matched their own summer lost about a quarter of an inning, and the men who were getting hit lost an inning and a half. Most of the vanished innings belong to a starter having a bad night against a good lineup, not to a manager with a plan. What is left is real, and the way it has grown is the strongest evidence here that October managing genuinely changed.',
      ],
      table: {
        caption: 'The same starter, his summer and his October',
        columns: ['', 'July', 'October'],
        rows: [
          ['How long he lasts', 'Just over 6 innings', 'Just over 5'],
          ['Pitchers his club uses per game', 'About 4', 'About 4 and a half'],
          ['Innings lost against his own form, the 2000s', '—', 'Four-fifths of one'],
          ['Innings lost against his own form, since 2013', '—', 'One and a quarter'],
        ],
      },
      proseAfter: [
        'So does it work? Look at the clubs that reached October and the answer seems obvious: the ones whose starters went deep went further, and the ones who emptied the bullpen went home.',
        'It is also fake, and this diary has been caught by the trick before. A club that plays twenty October games got there by winning; a club swept in three did not. Winning teams leave starters in because they are ahead, so a long start is a symptom of going deep rather than a cause. Allow for how much October a club actually played and both relationships go to nothing.',
        'Two hundred and thirty-three clubs cannot rule out something small. But the quick hook is the biggest visible difference between an October game and a July one, and no sign in a quarter century that it decided a series.',
      ],
    },
    {
      id: 'the-coin',
      heading: 'And then the part nobody wants to hear',
      prose: [
        'Since 2000, a hundred and ninety-eight postseason series were played between clubs with different records. One of them was better; you could look it up in the standings. That club won a hundred of them.',
        'Half. A coin.',
        'The honest version is more interesting, and it took building a fair opponent to see it. We shrank every club\'s record toward the middle, because a season is a noisy way to measure a team, then ran every series in its real format. In that world — where the better club genuinely is better — the better record still only wins about fifty-six times in a hundred. And a hundred and ninety-eight series cannot tell fifty from fifty-six apart. So the finding is not "October is a coin." It is that October is close enough to a coin that a quarter century cannot see the difference.',
        'One thing we got wrong on the first pass is worth correcting out loud. The club with the best record in baseball has won the World Series six times in twenty-six years, and we called that proof of chaos. It is the opposite. That club has to win three rounds to get there, and a pure coin would deliver about three champions in that time. Six is quiet evidence that the better team really is a little better.',
      ],
      table: {
        caption: 'How often the better club won',
        columns: ['', 'How many series', 'Better club won'],
        rows: [
          ['One-game wild card', '13', 'Just over half'],
          ['Best-of-three', '16', 'About a third'],
          ['Best-of-five', '97', 'Just under half'],
          ['Best-of-seven', '72', 'Just over half'],
          ['A world where the better club really is better', '—', 'About fifty-six in a hundred'],
        ],
      },
      proseAfter: [
        'What about being much better? Clubs eight to twelve games ahead won about three-fifths of their series, which sounds like something, until you see that clubs thirteen or more games ahead won fewer than half. There is no ladder there — but we cannot say the gap does not matter, either. A pile of series this size would spot an edge that size only about one time in six.',
        'And that is the shape of the whole month. October does not add anything. It takes things away. It takes away the fifth starter and the long man, so every arm a hitter sees is a good one and hitters only look like they shrank. It takes away the fourth pitch and the fifth, so a man like McCullers can finish a pennant throwing one thing twenty-four times and dare anybody to touch it. It takes away the sixth inning from the starter, a little more of it every year.',
        'And when you have subtracted the weak half of everything, from both sides, what is left is two good teams and something very close to a coin. Which is the honest answer to why the four studies before this one went hunting for the trait that separates deep runs from early exits, and kept coming back with nothing.',
      ],
    },
  ],
  caveats: [
    'Could that small hitting dip be wrong? Easily. The way we put a hitter and a pitcher together into one fair expectation is arithmetic on the back of an envelope. Change it slightly and the dip halves; ignore the men who batted fewer than ten times all October and it turns into a small rise. Believe that the famous collapse is mostly the opposition. Do not believe any particular number for what is left.',
    'Could it just be the weather, the ballparks, or plain tiredness? Possibly all of it. October is played in the cold, at night, in twelve clubs\' parks, and a man\'s summer here means his whole summer, April included. Nothing here says pressure is what makes October hitters worse.',
    'The extra half mile an hour is measured against a whole summer, and pitchers throw slower in April than in August, so some of it is just the calendar. The cameras also changed twice since 2008, and the gap is largest in the oldest years. Take the newer figure, closer to two-fifths of a mile an hour.',
    'The narrowing is real for short outings and absent for long ones, and our fix for the short-stretch problem is probably too gentle. Read it as a ceiling.',
    'When we say "the better club," we mean the club with the better record — a noisy thing, partly an accident of schedule. Thirteen of those series were a single game, which is as close to a coin as baseball gets.',
    '2020 is not in any of this. A sixty-game season with sixteen clubs in the bracket is a different sport. It was left in three places on the first pass, and taking it out moved the better-club win rate down by more than a point.',
    'The starter numbers only count men whose October was all starts, about four in five. The ones left out belong to the clubs with the quickest hooks.',
  ],
  open: [
    'Do the hitting question one player at a time. Twenty-five seasons gives twenty-five numbers; one hitter at a time would give tens of thousands, and could tell "everybody dips a little" apart from "a few men fall apart."',
    'Count how often an October hitter is seeing a pitcher for the third time that night. That is the likeliest single explanation for both the quick hook and whatever is left of the hitting dip.',
    'Redo the pitch-mix fix by drawing whole outings instead of single pitches. If the narrowing survives among men with real October workloads, it is a finding. If not, this entry has been too generous to it.',
    'Settle whether the walk is really the plate-discipline story of October, one hitter at a time rather than one season at a time.',
  ],
  technical: [
    'Panels: statsapi teams/stats (2,060 rows), stats league-wide (54,486 player-season rows), people/{id}/stats?stats=pitchArsenal (1,209 pitcher-seasons pulled, 1,074 usable after dropping 2020), all split by gameType R vs P, 2000-2025 (arsenal 2008-2025, PITCHf/x floor, min 50 postseason pitches). Series from public/data/postseason-history.json. Built by .scratch/team-success/build-october-texture.mjs, analysed by analyze-october-texture.mjs. The 70 MB raw cache and 51 MB assembled panel are gitignored (both rebuild in ~2 min); october-texture-findings.json is committed.',
    'All paired tests are sign-flip permutation tests, 20,000 draws, deterministic LCG seed, reported with SE, t and a 95% normal interval. Rank correlations are Spearman with a within-season permutation shuffle. 2020 excluded everywhere, including — unlike the first pass — the series panel, the arsenal panel and the paired-starter panel.',
    'THE MATCHUP-HELD EXPECTATION, which governs every performance claim here. Selection-free expectation = each October participant\'s regular-season component counts scaled by postseasonPA/regularPA (hitters) or postseasonBF/regularBF (pitchers). ONE-SIDED VERSIONS MUST NOT BE QUOTED: hitter-side OPS residual −0.0882, pitcher-side +0.0366. The sign flip proves each one estimates opposition quality, not a month effect. Combination: additive E_h + E_p − E_league for OPS, AVG and pitches-per-PA; log5 odds ratio for K/PA and BB/PA.',
    'Q1 pitches per plate appearance — the finding the first pass got wrong. Naive league gap +0.0373 (t=3.44), which is the ZERO-sided version of the same error. Hitter-side only +0.0210 (t=2.70); pitcher-side only +0.0073 (t=0.62); both ends held −0.0090 (t=−1.05, p=0.3033, 95% [−0.0259, +0.0078]). October at-bats are not longer. Reported in the entry as a reversal, not a finding.',
    'Q1 plate discipline, both rates by the same log5 method. The first pass used log5 for strikeouts and the naive gap for walks, which inverted the conclusion. Walks +0.492pp (t=3.54, p=0.0025, 95% [+0.22, +0.76]); strikeouts +0.398pp (t=1.65, p=0.1111, 95% [−0.08, +0.87]). The raw uncontrolled October strikeout gap is +2.04pp, so the matchup accounts for roughly four-fifths of it — but the interval leaves anywhere from about half to all of it, so "entirely the opposition" is not supported and is not claimed.',
    'Q2 OPS residual and its fragility. Additive −0.0141 (t=−2.14, p=0.0413, 95% [−0.0270, −0.0012]); multiplicative −0.0089 (t=−1.36, 95% [−0.0217, +0.0039]). Minimum-usage floors of 1/5/10/20 October PA-BF give −0.0141 / −0.0111 / −0.0057 / +0.0081. Batting average −0.0082 (p=0.0019). Era-stable (2000-2012 −0.0138, 2013-2025 −0.0145). The residual is carried by participants with under ten October trips and the sign is not settled across reasonable choices. Realized-PA weighting is also endogenous — clubs whose October went well batted more, and equal-club weighting makes the dip larger — so the reported figure is conservative in magnitude and unreliable in sign.',
    'Q2 role split, each group against its own regular season: October starters +0.0361 OPS allowed (p=0.0007), relievers +0.0390 (p=0.0001), n=25 seasons each. The between-group comparison is clean; each figure alone carries the one-sided opposition problem.',
    'Q3, 2020 excluded: 198 series with unequal records. Better record won 50.5% (95% [43.5%, 57.5%]); higher seed 50.5% of 194, equal seeds now excluded — the first pass silently awarded all five #1-vs-#1 World Series to teamB. Record-gap Spearman rho=0.0361 (p=0.5772). By format: 1 game 53.8% (n=13), best-of-3 37.5% (n=16), best-of-5 49.5% (n=97), best-of-7 54.2% (n=72). By round: WC 44.8% (n=29), DS 49.5% (n=97), LCS 56.3% (n=48), WS 50.0% (n=24).',
    'Q3 fair-opponent model: empirical-Bayes shrink each club\'s win pct toward its season mean by that season\'s reliability (observed variance minus binomial noise variance); log5 between the two shrunken talents; home edge as an odds multiplier of 0.54/0.46; each series walked in its real format with the higher seed hosting on the standard pattern. Predicted better-record win rate 56.4% over the same 198 series. Observed 50.5% cannot be distinguished from either 50% or 56.4%. Power: simulating that world 2,000 times, a record-gap Spearman clears the conventional bar only 15.7% of the time — the gap null is about power, not baseball.',
    'Q3 champions: the best record in MLB won the World Series 6 of 26. A pure coin over three rounds predicts 3.25; the fair-opponent model predicts 4.67. Six is ABOVE both, so this is weak evidence FOR the better club being better — the reverse of how the first pass used it. Note also that "best record" is itself the maximum of 30 noisy records and so is upward-biased.',
    'Q4 small-sample correction: best-pitch share is a MAXIMUM over pitch-type shares and is upward-biased at small n. Control = 60 multinomial draws of size (October pitch count) from each pitcher\'s own regular-season type distribution; verified stable, since 2,000 draws reproduces every corrected mean to three decimals. Corrected best-pitch share +1.56pp (t=6.19) against a naive +2.03pp. BUT it is not flat in October workload: 50-99 pitches +2.07pp (t=5.13), 100-149 +1.92 (t=3.34), 150-199 +1.01 (t=1.51), 200-299 +0.68 (t=1.18), 300+ +0.32 (t=0.47). A complete correction would be flat, so the multinomial control — which treats pitches as independent when real sequences cluster by outing, handedness and count — under-corrects, and +1.56pp is an UPPER BOUND. Corrected share who narrowed 61%; who leaned harder on the best pitch 56%. Fastball share +0.13pp (p=0.5884, 95% [−0.36, +0.62]).',
    'Q4 velocity +0.516 mph (t=16.16, n=1,074), a MEAN and so not subject to the maximum bias, and flat across the October-workload bins (0.53/0.44/0.47/0.59/0.58). Role split redone on BOTH months, because the first pass split on October role alone and so counted regular-season starters working in October relief as "relievers": started both +0.53 (n=537), relieved both +0.41 (n=455), moved from rotation to bullpen for October +1.02 (n=82) — that last group is a role effect, not October. By tracking era: PITCHf/x 2008-2016 +0.64 (n=509), Trackman 2017-2019 +0.43 (n=194), Hawk-Eye 2021-2025 +0.39 (n=371); quote the newest. Uncontrolled: the within-season velocity ramp, since April is the slowest month and a full-season baseline flatters any late-season sample. A September-only baseline is the fix.',
    'Q5 league hook: pitcher appearances per club-game +0.514 (t=8.26, 95% [+0.39, +0.64], 24 of 25 seasons); batters faced per appearance −1.05. Era: +0.37 (2000-2012) against +0.67 (2013-2025).',
    'Q5 paired starters, 2020 excluded: n=627 pitcher-seasons from 326 distinct men, postseason GS==G and regular-season GS>=10 and GS/G>=0.8. Outs per start −3.13 (−1.04 IP, t=−18.69); pitches per start −12.56; batters per start −3.45. Regular-season mean 6.13 DECIMAL innings — just over six, NOT six and a third — and 96.6 pitches; October 5.09 and 84.0. Era: −0.85 IP (2000-2012) against −1.24 IP (2013-2025). Splitting by October form: men whose October OPS-against matched or beat their own season lost 0.24 innings (n=259); men who were hit harder lost 1.61 (n=368). The pure managerial component is therefore about a quarter of an inning; the first pass\'s "a decision, not fatigue" claim rested on pitches-per-batter, which is itself an opposition effect. Filter coverage: 1,395 of 1,772 October starts (79%), and the excluded starts belong disproportionately to flexibly-used staffs, which is the treatment itself.',
    'Q5 does the hook win: n=233 postseason club-seasons. Starter outs/start against the ladder raw rho=+0.2812, rank-residualised partial rho=+0.0097 (p=0.8699, Fisher 95% [−0.12, +0.14]) controlling total postseason outs. Appearances/game raw rho=−0.2382, partial +0.0300 (p=0.8156). The point estimate is zero; the test only rules out |rho| above about 0.13. This is the postseason-volume confound from docs/team-success-postseason-usage.md reproducing on a different measure, exactly as the framework predicted.',
    'Cluster check: re-running the two headline paired tests flipping signs by PITCHER rather than by pitcher-season leaves both at p<0.0001 (velocity +0.515, starter IP −1.037), so the repeated-men non-independence does not bite.',
    'Leave-one-season-out ranges are computed in the script as a LEVERAGE check and are deliberately not quoted as intervals — a LOO range over n seasons has width roughly SE x 2/(n−1), so it reads like a confidence interval while measuring something else. Every interval above is a proper one.',
    'The opening anecdote was verified against the live feed, not recalled: gamePk 526503 (2017 ALCS Game 7), Lance McCullers Jr. (id 621121) entered in the top of the 6th and threw 54 pitches — 41 knuckle-curves (code KC), 11 sinkers, 2 changeups — of which the final 24 consecutive were knuckle-curves, ending on Greg Bird flying out to George Springer. Astros 4, Yankees 0. The first draft of this entry said "fourth inning"; the feed says sixth.',
  ],
}
