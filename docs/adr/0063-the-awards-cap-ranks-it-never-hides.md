# ADR-0063 — The awards cap ranks, it never hides — and the ranking is the owner's, not an allowlist's

The player page's career-honors card was the Trophy Case: one honor promoted to
a typographic marquee, everything else listed underneath as label-plus-dates.
What reached it at all came from two hand-kept allowlists in
`api/person/transactions.js` — `MAJOR_AWARDS` (about thirty major-league ids)
and `INSEASON_AWARDS` (ten more). Every award outside those forty ids was
dropped on the floor.

It is replaced by **Awards** (`components/player/AwardsLedger.jsx`,
`api/person/awards.js`): MLB.com's own shape — one table per award, columns
Year / Team / League — with the count of tables capped per width, and the order
of the tables set by the site owner at `/admin`.

## Two defects, one cause

**The allowlist decided what a career was.** MLB's awards catalog carries 652
non-ceremonial ids. Mike Trout's feed alone returns 89 selections across 43
distinct awards; the Trophy Case could see 18 of them. A prospect's page showed
*nothing* — his league MVP, his Futures Game selection and his Baseball America
teams were all outside both lists, and `loadPlayer` did not even fetch awards
for an undebuted player because there was known to be nothing to find. The WBC,
the Players Choice awards, the Wilson defensive awards, every MLB.com award: all
invisible, on a page whose whole job is "who is this guy".

**The marquee ranked, silently and permanently.** `HERO_RANK` was a hard-coded
list in the data layer. Disagreeing with it — deciding a twelve-time All-Star
selection says more about a career than a single Silver Slugger — meant an agent
editing a source file and a deploy.

Both are the same mistake: a judgement about *what matters* frozen into code
that only an agent can change, enforced by *dropping data* rather than by
ordering it.

## The decision

**1. Read every award; rank instead of filter.** `awardsView` shapes whatever
the feed returns. Nothing is dropped for being unrecognised. `MAJOR_AWARDS` and
a slightly wider `CURATED` map survive for one narrow job — collapsing an AL/NL
pair into one table and replacing a sponsor/namesake name ("Willie Mays World
Series MVP") with the name people use — and an id in neither keeps the feed's
own name and renders correctly on the day MLB invents it.

**2. The order is a setting, and it lives in the copy registry.** Three new
fields (`awards.order`, `awards.capDesktop`, `awards.capPhone`), edited at
`/admin` → Award weight. The registry already stores bounded, allowlisted,
versioned values the owner changes without a deploy, with history and a
server-side write allowlist (ADR-0025); a second store for one ordered list
would have been a parallel path, not an improvement. The stored value is a plain
newline-separated list of rank keys, so it stays readable and repairable by hand
even though the panel renders it as a reorder list rather than a textarea.

**An award the order does not name sorts LAST, never first.** This is the same
guard `HERO_RANK` carried (`indexOf === -1` had to mean last, not first), and it
is what makes opening the allowlist safe: a new award cannot jump to the top of
everyone's page on the day it appears.

**3. The cap is on TABLES, never on information.** Three awards get a table on a
phone, six past the 740px breakpoint — both editable, both clamped to 1–9, and a
phone cap above the desktop cap is clamped rather than obeyed. Everything below
the cut opens as an **index**: one line per award carrying its count, every date
and its league — the same information a table holds, minus the chrome. An award
won once *is* a single row, and a table drawn around a single row says nothing
the line does not.

This is the load-bearing half of the decision. A cap that hid things would have
recreated the allowlist with a different mechanism.

## Why MLB.com's shape, repetition included

Nine Silver Sluggers, one club, one league: MLB.com prints "Los Angeles Angels"
and "AL" on all nine rows. Three treatments were drawn — verbatim, the repeats
receding to graphite, and the club lifted into a run header above the years —
and **verbatim was chosen**. The repetition is the table saying, row by row,
that none of those nine was won anywhere else; a run header cannot survive a
mid-career trade without changing shape, and dimming the repeats optimises for
scanning a column the reader is not scanning.

What is ours is the paper: the ruled ledger on manila, a tier-coloured rule
under each award's name (the one motif kept from the marquee it replaces), and
the club's own mark ahead of its name — the one addition on top of MLB's shape,
and the thing that makes a career that moved read as one at a glance.

## Consequences

- `loadPlayer` now fetches awards for **every** player, not only a debuted one.
  One extra request on a prospect's page, which is the page the change exists
  for.
- `trophyCaseView`, `HERO_RANK`, `PREMIER_HERO_RANK_CUTOFF` and
  `INSEASON_AWARDS` are gone. `transactions.js` loses its honors half and is
  back to being about transactions; `person/awards.js` is the new home and
  carries its own `spoiler-manifest.json` entry.
- The weight order ranks *families*: one entry, `Post-Season All-Star`, governs
  the Midwest League's, the Texas League's and the Arizona Complex League's
  versions, which stay three separate tables the way MLB.com shows them.
- **The spoiler footing does not move.** An award is a season-level career fact
  on a surface deliberately outside the scoring flow (ADR-0034). Nothing here
  reads a linescore, a box score or a play, and the registry's own spoiler guard
  still holds: an admin types the order by hand, about a subject that has no
  score. The player page's `asOf` cutoff still applies, so a dated view cannot
  show an award that had not been won on that date.
