Status: needs-triage

# One continuous multi-base advance is notated at every base it passes, not just where it ends

## What happened

PR #396 replaced the per-play "keep only the furthest leg" map in
`computeHalfInningFeed` with per-leg notation. That was right for the case it
was built for — a runner who takes 2nd on a wild pitch and then steals 3rd used
to show only his final code, losing both the WP and the SB. But the feed also
splits ONE continuous advance into several same-eventType legs, and those now
each get their own label.

Diffed against the pre-#396 module on gamePk 824735:

```
bottom 1  Rafaela   OLD {2: 1B⁴, 4: 1B⁵}          NEW {2: 1B⁴, 3: 1B⁵, 4: 1B⁵}
top 3     Alonso    OLD {4: 2B⁴}                  NEW {3: 2B⁴, 4: 2B⁴}
```

So a runner scoring from second on a double now reads `2B⁴` beside third AND
`2B⁴` beside home — one hit, penciled twice, which reads as two.

## How common

**59 of the 271 cards carrying leg notations (22%)** in a single day's MLB
slate have at least one duplicated consecutive leg. It is visible on the
Machado card in PR #403's own screenshot.

## Proposed fix (needs a call on the convention)

Within one play, skip a leg whose `code` and `slot` match the previous leg
already written for that runner — i.e. collapse consecutive identical legs to
the furthest base reached. Every case #396 exists for (WP→SB, SB→E5) has
DIFFERENT codes per leg and is untouched.

The judgment call is the scorekeeping convention itself: does a code belong at
every base the runner passed, or only at the base where the advance ended? The
app's own leg codes carry the driving hitter's lineup slot as a superscript,
which argues for one mark per advance, not one per base.

## Where

`src/api/playbyplay.js` — the `if (visible)` advancement block near the end of
`computeHalfInningFeed`, the `legs.set(canon, m)` writes.
