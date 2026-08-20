# ADR-0060 — A delay is worth a card only when it produced something, and the man it names is the one who left

The half-inning feed shows the in-game stoppages. `game_advisory` playEvents
carry two unrelated things — the feed's own lifecycle bookkeeping ("Status
Change - Pre-Game/Warmup/In Progress") and the real stoppages ("Injury Delay.",
"On-field Delay.", the weather "Status Change - Delayed…" lines) — and
`isDelayAdvisory` splits them, so the second group reaches the feed while the
first does not. That decision stands.

It answered "is this a stoppage". **It never answered "did anything come of
it", and four times in five nothing did.**

## The defect

Two independent sweeps of the live feed — 41 Final MLB games (2026-08-16..18)
and 53 more (2026-08-12..15) — carried 48 and 53 delay advisories, about 1.1 per
game. Of those, 81% and 85% were a sub-minute "Injury Delay." or "On-field
Delay." with no substitution after them and nothing else to report. The card
they drew read, in full: `DELAY  Injury delay.`

Empty is the smaller half of the problem. The card lands beside whichever plate
appearance the stoppage interrupted, so it reads as being ABOUT that plate
appearance — and the advisory's own `player` field says the same thing, because
that field holds the man in the batter's box, not the subject of the delay:

| game | the advisory names | who it was actually about |
| --- | --- | --- |
| 824319, bottom 7 | Jake McCarthy, batting | Hunter Feduccia, the catcher, replaced one event later |
| 823670, top 8 | Alec Bohm, batting | Austin Martin, the left fielder, replaced |
| 824398, top 5 | Christian Koss, batting | the home plate UMPIRE, who left |

One sampled advisory named its real subject (824642, bottom 3, where the batter
himself was the man replaced). A card that says "Injury delay." next to the
wrong player's at-bat is worse than no card, and it is what the reader saw.

Reported as: *"there is a delay or an injury delay, and these can often look
confusing or distracting because they are tied to a specific player or event and
there's no additional detail given on the page."*

## The decision

**A delay is carded only when it can say something, and what it says is what
became of the man it was about.**

Two grounds, either one enough:

1. **It produced a personnel change** before the next pitch — a pitching change,
   a defensive substitution, an offensive substitution, or an umpire change.
2. **It stopped play for at least five minutes.**

A delay meeting neither is dropped from the feed entirely. So is one meeting the
first on paper but resolving to no name — a thin MiLB feed naming a substitute
the roster has never heard of degrades to no card, not to a blank one.

Applied to the two sweeps this keeps about one delay advisory in five, and every
one that survives carries a subject, a length, or both.

### The subject is the man who LEFT

Never the advisory's own `player`. The feed puts the departing man on
`replacedPlayer` for a defensive or offensive substitution (3 of 3 in the
sweep), and never for a pitching change (0 of 5) — that one names its departing
arm only in the prose, "Pitching Change: Javier Assad replaces Kevin Gausman",
so it is read off the same name index the card's own text is linkified against.
An umpire change has no subject in `gameData.players` and carries none.

### The window closes at the next pitch

The lookahead runs from the advisory to the next PITCH of the same play. The
feed places a stoppage and the change it caused side by side, in the playEvents
of the plate appearance the stoppage interrupted, and leaves no pitch between
the two. Across both sweeps all 101 delay advisories had a later pitch in their
own play, so the window never runs off the end of one. A substitution after play
resumed is not this delay's doing, and is not claimed.

### Three plausible consequences are deliberately excluded

- **A mound visit** is a stoppage in its own right, with its own card and its
  own accounting. It is not a consequence of this one.
- **An ejection** and **a bare defensive switch** each already get a card, and
  each card carries the whole account. A delay card stacked above one would only
  repeat it — which is the noise this ADR exists to remove. (An ejection that is
  followed by a pitching change still yields a card, because the pitching change
  names a departure the ejection card does not.)

## What this does not change

- **The between-half `DelayCard`** (`selectDelays`, `components/inning/`) is
  untouched. It reports the same stoppage from ABOVE the half rather than inside
  it, and its own test — `/delayed/i` on the description — only ever matched the
  weather "Status Change - Delayed…" lines, never "Injury Delay."
- **The spoiler footing** is unchanged. Nothing here reads a score: an event
  type, a substitution's `replacedPlayer`, a name, and two timestamps. The delay
  card renders where it always did, inside an already-revealed half.
- **Ordering** (the note-order rule) is unchanged. A delay that survives still
  lands in feed order, ahead of the substitution it caused.

## Rejected: joining MLB's own injury clips

The `content` endpoint the game already fetches carries clips tagged `injury`
whose headlines are real reporting — "Kevin Gausman has a thumb cramp, exits
game in 5th", "Austin Martin exits game vs. Phillies", "Home plate umpire Jordan
Baker exits the game". They join to a delay by time: a clip is posted 3 to 13
minutes after the stoppage it belongs to, so assigning each clip to the most
recent delay that ended before it resolves correctly, including the two-clip
case where Gausman cramped in the 4th and left in the 5th.

Not taken, for one reason that outweighs the detail it would add: **entry
existence must be deterministic from the feed alone.** Clips land minutes after
the stoppage, so a rule that let a clip earn a card would make cards appear and
disappear as `content` caught up — and the at-bat stepping machinery (ADR-0016)
indexes into the entry list, so a list that grows underneath it moves step
boundaries. That is a worse version of the confusion this ADR is fixing. The
join is sound and the evidence is above if a later reader wants it as a
presentation-only enrichment of a card that already exists.

**Amends nothing.** The note-order work that first let delay advisories reach
the feed at all is upstream of this and still correct — this decides which of
them stay.
