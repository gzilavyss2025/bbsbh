// The page's standing front matter — the part that is true of every entry and
// would otherwise be repeated in all of them.
//
// TRAPS is the practical half. Every one of these cost real work to find, and
// every one of them will bite the next person who reads a duration figure out
// of this data without knowing about it. It belongs at the top of the page
// rather than buried in whichever entry happened to discover it.
export const HOW_TO_READ = [
  'This is a working notebook, not a report. Entries are dated, newest first, and nothing gets rewritten. When a later pass overturns an earlier one — and one of them here overturns two things — the old entry stays exactly as it was and the new one says plainly what it takes back. A notebook that quietly tidies its past to agree with its present cannot show you how a conclusion moved, and how a conclusion moved is usually the most useful thing in it.',
  'All of it is about the minor leagues. The first four entries ask about clubs — how long a prospect sits at a level, whether some organizations move men faster, whether any of it is worth anything. The four newest ask about the player instead: his size, his arm, what he had already won, and what he did once he got there. None of it touches a live game, and nothing here can spoil one.',
  'Every entry ends with a list of what is missing from it. Those lists are not throat-clearing. In most of them, the missing thing is the likeliest reason the finding is wrong.',
]

export const TRAPS = [
  {
    id: 'wire-starts-2009',
    title: 'The transaction log effectively starts in 2009',
    body: 'There are 457 minor-league assignment records for the whole stretch from 1997 to 2008, against 290,690 from 2009 onward. Anything that needs a dated move — which is every duration in this work — is measuring an empty room before 2009 and a clipped one until about 2011. That one fact manufactured a decade-long trend that took a whole pass to knock down.',
  },
  {
    id: 'lost-2020',
    title: 'There was no minor-league season in 2020',
    body: 'Any stay straddling that year gets stretched by an empty calendar, and our own rule discarding stays over 900 days then deletes the ones it stretched the most. The missing season pushes one era up; the cutoff pulls it back down. Neither has a thing to do with baseball, and no study crossing 2020 gets to ignore it.',
  },
  {
    id: 'post-debut-shuttling',
    title: 'A big leaguer riding the shuttle is not a prospect climbing',
    body: 'An established major leaguer optioned out in July leaves a paper trail that looks exactly like a prospect being assigned there. For a while, one duration in eight in this work was really a big leaguer’s roster churn. The fix is to stop reading a man’s transaction history at his debut, and any new work has to do the same or it will make the identical mistake.',
  },
  {
    id: 'position-converters',
    title: 'A position change erases a player’s early career',
    body: 'The cached player data pulls only the stat group matching a man’s CURRENT position, so a shortstop who became a pitcher loses every season he spent as a shortstop. Sergio Santos — a first-round shortstop taken by Arizona in 2002, a pitcher from 2009 — read as a Blue Jays product until both groups were pulled. Anything derived from a player’s "first season" needs this check before it is trusted.',
  },
  {
    id: 'listed-size-is-current',
    title: 'A player’s listed height and weight are today’s numbers',
    body: 'The league publishes one height and one weight per man, and it is his CURRENT listing — for somebody who retired in 2014, whatever he was last listed at. Height barely moves after eighteen. Weight does. So any study that relates a man’s build to something that happened in his minor-league years is reading the ruler at the wrong time, and there is no archive of past listings anywhere to fix it with.',
  },
  {
    id: 'no-milb-pitch-tracking',
    title: 'There is no pitch tracking below Triple-A, and never has been',
    body: 'Velocity and pitch type come from the cameras, and the cameras are in major-league parks and — only since the 2020s — Triple-A ones. Double-A and everything under it carry no pitch data at all. So what a prospect actually threw on his way up cannot be measured for anybody in this cohort. The only available substitute is what he threw AFTER he was promoted, which is a reading taken after the event it is meant to explain. Use it if you must, and say so every time.',
  },
  {
    id: 'award-dates-constrain-the-calendar',
    title: 'A mid-season award forbids an early-season debut',
    body: 'The Futures Game is played in July, so a man selected for it in 2019 was a minor leaguer in July 2019 and cannot possibly have debuted that April. Any comparison that sorts players by an award and then looks at WHEN something happened to them is partly measuring the award’s own calendar. This killed an entire finding on this page. The fix is to count only honors won in strictly earlier seasons.',
  },
  {
    id: 'no-payroll',
    title: 'There is no historical payroll anywhere in this repo',
    body: 'The salary and contract files are current-season snapshots looking forward; attendance is this season only. So the most obvious alternative explanation for almost any club-level finding here — that it is really about money — cannot be tested with what is on hand. Every entry carrying that gap says so.',
  },
]
