# The challenge row gates on a pregame key, never on play data

The box score's ABS challenge row used to gate on `sport.id === 1`. That hid
real challenges at Triple-A, where the system has run for several seasons
(issue #957). Replacing the level check turned out to be the easy half. The
hard half is that the obvious better gate is a spoiler leak, and it looks like
a cleanup. This ADR records why `gameHasAbs` reads
`feed.gameData.absChallenges` and nothing else.

## A level cannot draw this line

The challenge system is a rule a league opts into, not a tier of the sport.
In 2026 it runs at MLB, at Triple-A, and inside Single-A in the Florida State
League alone — while Double-A, High-A, and Single-A's Carolina and California
Leagues do not run it. A sportId allowlist gets that wrong in both directions
at once: sportId 14 has to answer `true` for one of its leagues and `false`
for the other two, which no allowlist keyed on the level can do.

So the gate asks the feed instead. `gameData.absChallenges` was present on
89 of 89 MLB and 95 of 95 Triple-A Final games sampled across six dates
spanning the season, and absent — with no `MJ` review anywhere in the play
data — on all 125 Double-A, High-A, Carolina League and California League
games checked. A level that gains the system next season gets its row with no
change here, and a level that loses it loses the row the same way.

Contrast `hasPitchTracking` in `umpireFavor.js` next door, which correctly
stays a level check. Hawk-Eye is hardware a level equips its parks with; the
challenge system is a rule. The two questions look alike and are not, which
is why they are answered differently ten lines apart.

## Presence only, never the values

The same object carries live whole-game counts — `hasChallenges`,
`usedFailed`, `remaining` — that are NOT clamped to the reached half. Reading
one would put a later half's outcome on the page before the reader got there,
which is the ordinary reveal-only rule of ADR-0001.

What makes *presence* safe is a stronger fact: the key is already there before
the first pitch. Every Scheduled and Pre-Game feed checked carries
`{hasChallenges: false, remaining: 2}` at every level that runs the system. So
the key says which RULES this game plays under, the same class of fact as the
venue or the club ids beside it, and the row's existence never depends on
whether a challenge has happened yet. `gameHasAbs` is `!= null` and stays that
way; the remaining count the row shows still comes from `scanChallenges`'
clamped walk.

## The obvious improvement is the leak

The key is reported per VENUE, not per league, and one park runs the system
without reporting a bank. Every Tampa Tarpons home game at George M.
Steinbrenner Field carries real `MJ` challenges and no `absChallenges` key —
30 of them over 7 sampled games — so the gate hides a row that should show.
Daytona's Jackie Robinson Ballpark is the honest opposite: no key, and no
challenges either. Issue #964 tracks the gap.

The fix that suggests itself is to widen the gate to "has the key OR carries
an `MJ` review somewhere in the feed". **That is forbidden.** It reads play
data to decide whether the row exists, so the row appearing at all would tell
you a challenge happened somewhere in a game you have not revealed — a
one-bit spoiler on the game's own surface, leaking exactly the kind of fact
(a called third strike got overturned) the seal exists to hold. It would pass
every test in the suite, because a gate that reads too much still returns the
right booleans.

The honest fix is a venue allowlist. `venue.id` is in `gameData` pregame,
exactly like the key, so it says nothing about what has happened yet.

`challenges.test.js` pins this structurally rather than by comment: the gate
must return the same answer on a real feed with `liveData` deleted entirely.
A gate that starts reading play data fails that test the moment it is written.

## Which levels are actually claimed

The gate is exact at MLB and Triple-A, which is the scope issue #957 asked
for and where this row is read. Below that it is a strong heuristic with one
known hole. Comments and docs say that, rather than the tidier and false
"present on exactly the games that run the system" — a claim the first draft
of this work made, and which its own verification could not have caught,
because that sweep looked for challenges only inside games that already had
the key.

Two smaller facts fall out of the same change. Pre-2026 MLB feeds carry no
`absChallenges` and no `MJ` reviews at all, so the old gate was putting a
bogus "2 left" row on every historical MLB box score; the new gate removes it.
2025 Triple-A games do carry the key, so historical Triple-A box scores gain
a correct row.

## Not fixed here: a play can carry two challenges

`challengeForPlay` returns at most one challenge per play. A plate appearance
can carry two distinct ones — the same club twice, or both clubs — so the
derived tally runs one light on roughly a fifth of games at every level. That
is a pre-existing under-count, tracked as issue #963, and it is independent of
this gate: it changes what the row counts, never whether the row exists or
whether anything crosses the seal.
