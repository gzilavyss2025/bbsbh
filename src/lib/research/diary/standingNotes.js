// The page's standing front matter — the part that is true of every entry and
// would otherwise be repeated in all of them.
//
// TRAPS is the practical half. Every one of these cost real work to find, and
// every one of them will bite the next person who reads a duration figure out
// of this data without knowing about it. It belongs at the top of the page
// rather than buried in whichever entry happened to discover it.
export const HOW_TO_READ = [
  'This is a working notebook, not a report. Entries are dated, newest first, and they are never rewritten. When a later pass overturns an earlier one — and one of them here overturns two things — the old entry stays exactly as it was and the new one says what it takes back. A notebook that quietly edits its past to agree with its present cannot show anyone how a conclusion actually moved, which is usually the most useful thing in it.',
  'Everything below is about the minor leagues: how long a prospect stays at a level, whether some clubs move players faster than others, and what any of it is worth. None of it touches live games, and nothing here can spoil one.',
  'Every entry ends with a plain list of what is missing from it. Those lists are not throat-clearing. In three of the four cases the missing thing is the most likely reason the finding is wrong.',
]

export const TRAPS = [
  {
    id: 'wire-starts-2009',
    title: 'The transaction log effectively starts in 2009',
    body: 'There are 457 minor-league assignment records for 1997 through 2008, against 290,690 from 2009 onward. Anything that needs a dated move — which is every duration in this work — is measuring an empty room before 2009 and a clipped one until about 2011. This single fact produced a fake decade-long trend that took a whole pass to knock down.',
  },
  {
    id: 'lost-2020',
    title: 'There was no minor-league season in 2020',
    body: 'Any stay that straddles that year is stretched by an empty calendar, and the pipeline’s own rule discarding stays over 900 days then deletes the ones it stretched the most. So the missing season pushes one era up and our own cutoff pulls it back down. Neither has anything to do with baseball, and no analysis crossing 2020 can ignore it.',
  },
  {
    id: 'post-debut-shuttling',
    title: 'A big leaguer riding the shuttle is not a prospect climbing',
    body: 'An established player optioned to Triple-A in July leaves records that look exactly like a prospect being assigned there. For a while, one duration in eight in this work was really a big leaguer’s roster churn. The fix is to stop reading a player’s transaction history at his major-league debut, and any new analysis has to do the same or it will make the identical mistake.',
  },
  {
    id: 'position-converters',
    title: 'A position change erases a player’s early career',
    body: 'The cached player data pulls only the stat group matching a man’s CURRENT position, so a shortstop who became a pitcher loses every season he spent as a shortstop. Sergio Santos — a first-round shortstop taken by Arizona in 2002, a pitcher from 2009 — read as a Blue Jays product until both groups were pulled. Anything derived from a player’s "first season" needs this check before it is trusted.',
  },
  {
    id: 'no-payroll',
    title: 'There is no historical payroll anywhere in this repo',
    body: 'The salary and contract files are current-season snapshots looking forward. Attendance is this season only. So the single most obvious alternative explanation for almost any club-level finding here — that it is really about money — cannot be tested with what is on hand. Every entry that has this gap says so.',
  },
]
