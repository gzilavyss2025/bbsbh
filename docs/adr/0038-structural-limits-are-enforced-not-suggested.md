# Structural limits are enforced, not suggested

`CLAUDE.md` has said this since early on:

> **Flat directories don't stay flat.** Before adding roughly the 10th file to a
> directory, propose subdirectories instead of piling on.

At the time this ADR was written, `src/components/` held **126** files,
`src/api/` **84**, `src/lib/` **52**, and `src/index.css` had reached **29,828
lines**. The rule was not ignored out of carelessness — it was ignored because
nothing ever said no.

That is the whole finding, and it generalises past this one rule. Every
convention in this repo that has a `scripts/check-*.mjs` behind it has held:
the ALL-CAPS invariant, the typography roles, the focus-ring token, the WCAG
pairings, the menu/footer page lists, the skeleton frame counts, the Logbook
stamp containment, and the 200-line cap on root `CLAUDE.md` — which sits at 199
and has never once been raised. Every convention that exists only as prose has
drifted. Documentation sets intent; a guard is what makes intent survive contact
with a hundred sessions that each only see part of the picture.

So the directory rule now has a guard, and so does the file-length rule it
implies.

## `check-dir-size.mjs` — a ratchet, not a cap

`MAX_FILES` is 12. The seven directories already past it carry a budget pinned
at the count measured when this landed, and a budget may only ever be edited
**downward**. It fails three ways: an unbudgeted directory going over the cap, a
budgeted directory growing past its budget, and — the part that makes it a
ratchet rather than a high-water mark — a budgeted directory *shrinking* below
its budget without the number being tightened in the same commit.

That third rule is the one doing the long-term work. A high-water mark that is
never lowered stops describing anything within a few months; requiring the
cleanup to record itself means the table can only shrink. A directory's file
count changes rarely, so this costs an edit almost never.

## `check-file-size.mjs` — a ceiling, deliberately weaker

`MAX_LINES` is 600, which sits between p90 (411) and p99 (1,470) of this repo's
481 source files: large enough that the exception table stays readable, small
enough to catch the next `person.js` while splitting it is still cheap.

The ratchet here is deliberately **weaker** than its sibling, and the asymmetry
is the interesting part. Line counts change on nearly every commit, so a
fail-when-it-shrinks rule would fail lint constantly and be deleted within a
week — a guard that cries wolf is worse than no guard, because it teaches people
to route around guards. So a budget here is a ceiling: growth past it fails,
shrinkage is free. Rot is bounded from the other end instead — once a file drops
back under 600 lines it must surrender its entry, so the table still only
shrinks.

Both guards were verified to fail correctly before being committed, not merely
to pass: a directory at exactly 12 refusing a 13th file, a stale budget
demanding a tighten, a budgeted file refusing two added lines, and a new
700-line file being rejected outright.

## Why `src/index.css` is in the table at 29,828 rather than being split first

Recording the number is not an endorsement of it. The entry exists so that when
that file *is* split into partials, the guard fires and forces one entry per
oversized partial — which is precisely what stops 29,828 lines evaporating into
unrecorded 9,000-line pieces and being called an improvement.

That split has a hazard of its own, discovered while writing these guards and
fixed alongside them: `check-typography.mjs` and `check-focus-ring.mjs` each
read `src/index.css` and nothing else. Emptying that file of rules would leave
both scripts exiting 0 and printing their ✓ line while asserting nothing at all.
Both now fail when their target holds no rules. A guard that silently stops
guarding is the failure mode this ADR exists to prevent, and two of the eleven
were one refactor away from it.

## What these guards do not do

Neither reads code. They cannot tell a 600-line file that should be split from a
600-line file that is genuinely one cohesive thing, and they cannot tell a
well-organised directory of 12 from a junk drawer of 12. They are crude on
purpose: a structural budget that needs judgement to evaluate is one that gets
argued with, and the value here is entirely in being unarguable.
