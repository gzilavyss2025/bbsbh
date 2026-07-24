# bbsbh

A spoiler-safe second-screen companion for scoring baseball by hand: it shows
live game data pulled from the MLB Stats API, but keeps every score-revealing
fact hidden until the user deliberately reveals it, one half-inning at a time.

## Language

### Spoiler mechanism

**Spoiler rule**:
The core invariant: a score-revealing value must never exist in the DOM until
the user has revealed it — there is no fetched-then-hidden node to leak.

**Seal**:
The hidden state of a score-revealing value before the user has revealed it.
_Avoid_: hidden, locked

**Reveal**:
The user's deliberate action of un-sealing one half-inning's score-revealing
data. One-directional — there is no action that re-seals a half once revealed.
_Avoid_: unlock, show

**SealBox**:
The component that renders a seal. Holds its revealable content as a render
function invoked only once revealed, so the sealed value is never computed or
placed in the DOM ahead of time.

**Reveal-only module**:
A module whose exports compute score-revealing values (runs, hits, errors,
pitch/whiff counts). Callable only from inside a SealBox's reveal render path.
_Modules_: `linescore.js`, `derive.js`.

**Spoiler-free selector**:
A selector safe to call and render before reveal — lineups, umpires, venue,
rosters, pre-pitch changes. Touches no runs/hits/errors.

**Entering-the-half selector**:
A selector giving the defense or the lineup as it stands *entering* a half —
the starting nine plus every sub/switch/pitching change made before that
half's first pitch, and none made during it (`defenseEntering`,
`lineupEntering`). Not score-revealing, but substitution timing is
spoiler-adjacent, so — like a pre-pitch change — a caller may only render it
for a half the user has reached (`halfIndex <= revealedThrough + 1`).

**revealedThrough**:
The high-water mark of how far a user has revealed a given game — the
furthest half-inning uncovered. Revealing a later half auto-reveals everything
before it.
_Avoid_: reveal state, progress

**Pre-pitch change**:
A substitution, pitching change, or pinch-hitter logged before a
half-inning's own first pitch — the same information a broadcast would
announce before the half starts.

**Scores Unlocked**:
The app's single site-wide, opt-in switch that un-gates every score after an
explicit consent tap — the whole slate, every surface inside a game, and a live
game's view keeps pace with itself. Stored as an expiry timestamp (the next local
8:00am) plus the DAY consented to — never a score — and it fails closed on
anything stale, garbled, or past. At 8am the switch turns itself off so a new day
starts sealed; the day you agreed to stays open (ADR-0026).
_Avoid_: spoiler mode, unlock-all, Follow Live

**Effective reveal** (render override):
The render-time reveal mark the Scores Unlocked pass substitutes for
`revealedThrough` (see `effectiveReveal`). It unseals the screen for viewing
ONLY — it is never persisted, never ratcheted, and never crosses to another
device; the real high-water mark it shadows is left untouched, so flipping the
pass off drops straight back to it (ADR-0026).
_Avoid_: fake reveal, temporary reveal

**Spoiled day**:
A date the user explicitly agreed to see plainly. Recorded on consent
(`bbsbh:spoiledDays`), it outlives the 8am reset — you already agreed, so
pretending the next morning that the day might still be hand-scored would be a
fiction. It is a set of DATES, never a reveal mark, so it can't touch what you
scored by hand. Turning the switch off the same day takes the consent back
(ADR-0026).
_Avoid_: unlocked day, burned day

**Live edge**:
The furthest half-inning the actual game has reached so far — the half of the
most recent completed play. Under Scores Unlocked it keeps a caught-up viewer on
the newest half as it is played — NAVIGATION only, never a reveal. It reports
only how far the GAME has progressed, never a score (`selectLiveEdge`,
`src/api/liveEdge.js`).
_Avoid_: current play, latest inning

### Game structure

**Half-inning**:
The atomic unit of reveal granularity — a top or bottom of one inning.
_Avoid_: side, frame

**Regulation innings**:
The fixed set of innings (9, or 7 for a shortened game) shown to the user up
front, regardless of how long the actual game ran.

**Extra innings**:
Innings beyond regulation. They unlock one at a time as the user reveals
their way there, so the interface never hints a game went to extras in
advance.

**RollingLine**:
The boxscore-style component that doubles as the half-inning navigator —
every run cell is a button that jumps to that half, with cumulative R/H/E
over every revealed inning.

**Pitchers table**:
The running line (IP/R/ER/H…) for every pitcher who has appeared, one block
per team. Gated by revealedThrough rather than sealed as a unit, so an active
pitcher's line reflects only revealed innings.

**Starting nine**:
A team's starting lineup, identified by a player's own batting-order slot
being an exact multiple of 100.
_Avoid_: lineup (ambiguous with the printed lineup-card screen)

**Primary position**:
A player's true starting fielding position, independent of any position he's
moved to since. Determines roster-card membership and position labels.
_Avoid_: box position, current position
