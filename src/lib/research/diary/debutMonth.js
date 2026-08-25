// Diary entry — the one where the interesting answer turned out to be an
// artifact of the question. It is filed as not shippable rather than as a
// correction, because nothing in an earlier entry is being taken back: the
// finding was made and killed inside this same pass.
//
// It is kept at full length anyway. A study that finds a pattern, doubts it,
// builds the test that would break it, and then reports that it broke is worth
// more on this page than a study that finds a pattern and stops.
export const debutMonthEntry = {
  id: 'debut-month',
  date: '2026-08-24',
  source: 'PR #891',
  doc: 'docs/prospect-traits.md',
  title: 'When the call comes — and the pattern that wasn’t there',
  verdict: 'no-ship',
  question:
    'Do the best prospects get called up at a particular time of year? Work backwards from who won the minor-league awards and see whether the top of the class arrives on a schedule.',
  headline:
    'They do not. Decorated prospects looked like they came up later in the summer than everybody else — and then the reason turned out to be the award calendar, not the promotion calendar. A man picked for the Futures Game in July was, by definition, still a minor leaguer in July. He cannot appear in the April column. Take that out and the gap between the best prospects and the anonymous ones is nothing at all.',
  sections: [
    {
      id: 'pedigree',
      heading: 'Where "top prospect" came from, since no list goes back far enough',
      prose: [
        'There is no historical top-100 list anywhere in this app. Our own prospect snapshot started in July of this year, which is no help to a man drafted in 2013. What does reach back is the trophy cabinet. The league keeps a dated record of every award a player ever won, down to the Midwest League mid-season all-star team.',
        'So pedigree here is what a man had won before he debuted, in four levels. The national player-of-the-year awards at the top. Then the Futures Game and the Baseball America all-star teams. Then a league’s own all-star squad. Then the organization all-star team a club names each year. Weekly awards were thrown out: a player of the week is a hot fortnight, and there are twenty-six of them a season in every league.',
      ],
    },
    {
      id: 'the-shape',
      heading: 'What the season actually looks like',
      prose: [
        'Before any of the pedigree question, the plain answer to "what month do players debut" is worth having on its own, because it is not what most people would guess.',
      ],
      table: {
        caption: 'Debut month, all 3,060 players',
        columns: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
        rows: [['1.9%', '20.0%', '15.6%', '14.8%', '12.4%', '16.0%', '19.0%']],
        note: 'Two humps and a trough. April and September are the busy months; July is the quietest. The last three tenths of a percent debut in October and are left off the table.',
      },
      proseAfter: [
        'And both humps crowd into the front of their month. Of the 613 April debuts, five in eight land in the first two weeks. Of the 580 September debuts, more than three quarters land in the first fifteen days — 297 in the opening week alone. These are not really two months. They are two doors: the Opening Day roster, and the September roster expansion.',
      ],
    },
    {
      id: 'the-finding',
      heading: 'The finding, as it first appeared',
      prose: [
        'Sorted by what a man had won, an interesting picture came up. The players with no minor-league honors at all were front-loaded: they took the April jobs and were scarce in late summer. The decorated ones ran the other way, thin in April and thick in August and September.',
        'It came with a tidy story, too. The unheralded man is organizational depth who breaks camp because somebody got hurt. The celebrated prospect is still at Triple-A in April, turns up in August, and the club buys itself an extra year of control on the way through. That story is plausible enough that it very nearly got written down.',
      ],
    },
    {
      id: 'the-kill',
      heading: 'And the reason it is not true',
      prose: [
        'Half of these honors are won partway through a season, on a date. The Futures Game is played in the middle of July. A player picked for it in 2019 was a minor leaguer in the middle of July 2019, so he could not possibly have debuted that April. The award forbids the very month the finding said he was avoiding.',
        'The fix is blunt and it is complete. Throw away every honor won in the same season as the debut, and re-sort everyone on what he had won in EARLIER years only. Now the trophy was in the cabinet before the season started, and nothing about it says a word about which month he comes up.',
      ],
      table: {
        caption: 'The same comparison, before and after the fix',
        columns: ['Test', 'As first measured', 'Honors from earlier seasons only'],
        rows: [
          ['Does debut month differ by pedigree at all?', 'Yes — 2 in 100', 'No — 19 in 100'],
          ['Decorated vs unknown, debuts in March/April', '—', '20.5% vs 22.0%'],
          ['Decorated vs unknown, debuts in Aug/Sep', '—', '34.8% vs 38.6%'],
          ['Decorated vs unknown, first half of the year', '—', '52.4% vs 50.3%'],
        ],
        note: 'Every gap is inside what chance produces. The pattern was the award schedule looking at itself in a mirror.',
      },
    },
    {
      id: 'survives',
      heading: 'What is left is the calendar, and it is a club’s calendar',
      points: [
        'April, week by week: 226 debuts, then 144, then 90, then 153. An Opening Day rush, a fortnight of quiet, then a small bump over the last nine days. That bump is the only thing anywhere in this data that looks like service-time management, and it is far too thin to lean on.',
        'September, week by week: 297, then 137, then 88, then 58. That is a door opening on the first of the month, not a gradual thing.',
        'The September share of all debuts fell from about a fifth of them in 2005 through 2019 to a sixth in 2021 through 2023, which is what you would expect after roster expansion shrank from forty men to twenty-eight. But 2019 — the last forty-man September — was itself the lowest year in the whole run, so the rule change does not read cleanly off the numbers and is not claimed to.',
        'And working backwards from the sharpest marker in the cabinet: the median gap from a man’s last Futures Game to his major-league debut is 323 days. Only a third arrive inside three months. Four in ten come up the FOLLOWING season, and better than a quarter take two more years. The Futures Game is not a waiting room.',
      ],
    },
  ],
  caveats: [
    'The whole approach rests on awards, and an award is partly just a restatement of "he played well" — which is also the main thing that gets a man promoted. So these tiers are not an independent read on pedigree, and never could be.',
    'Award coverage is denser in recent years than in 2005. Every tier comparison here was also run inside a single era for that reason, and it does not change the answer, but a reader should know the raw counts are not comparable across the window.',
    'Relievers win almost nothing. A pedigree tier is therefore partly a role, which is why the same cuts were run on hitters alone.',
    'The four tiers are a judgement call. A Futures Game selection was ranked above a league all-star team and below a national player-of-the-year award; somebody else would draw those lines differently. The full award lists are printed by the script rather than hidden, so the call can be argued with.',
  ],
  open: [
    'The one version of this question worth another look needs data we do not have: whether a club’s FIRST call-up of the year differs from its fifth. A club with an April hole to fill behaves differently from the same club in August, and lumping every debut together may be washing out two different decisions.',
  ],
  technical: [
    '3,060 players, debuts 2005–2023. Pedigree from /api/v1/people/{id}/awards — 21,375 award rows, tiered A–D; weekly awards, winter ball, independent ball and the WBC excluded; 149 wins across 42 types left untiered and printed.',
    'Original spec (any honor before the debut DATE): X²=35.4, df=20, p=0.018 across five tiers × six month bands.',
    'Artifact-free spec (honors from strictly earlier SEASONS): X²=25.4, df=20, p=0.188. Two-proportion tests decorated vs undecorated: Mar/Apr p=0.40, Aug/Sep/Oct p=0.08, first half p=0.36.',
    'Futures Game: 590 selections in the cohort; median 323 days to debut; 32% within 90 days, 41% the next season, 27% two or more seasons later.',
    'September share of debuts: 19.6% across 2005–2019, 16.6% across 2021–2023. 2019 alone was 12.0%.',
  ],
}
