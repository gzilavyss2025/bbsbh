# bbsbh

A second-screen companion for scoring baseball by hand: it shows
live game data pulled from the MLB Stats API, but on the surfaces you score from
it keeps every score-revealing fact hidden until the user deliberately reveals
it, one half-inning at a time.

## Language

### Spoiler mechanism

**Spoiler rule**:
The core invariant, stated with the scope that is half of it: on the **scoring
surfaces**, a score-revealing value never exists in the DOM until the user has
revealed it — there is no fetched-then-hidden node to leak. Off them, baseball
opens live. The rule protects the game you are scoring by hand, not the sport's
public record.
_Avoid_: stating it without the scope ("no score anywhere, ever") — that was the
older, absolute framing, and reading it back is how these guards re-tighten by
accident.

**Scoring surfaces**:
The four places the spoiler rule governs: the slate's score cells, the two
lineup pages, the innings viewer, and the box score — everything you touch while
charting a game on paper. Everything else is an **open surface**: season and
career stats, player and team pages, leader boards, standings, and the
standalone pages outside the scoring flow (All-Star Rosters, Game Photos, the
Game Log). A season stat line moves by fractions and says nothing about tonight's
game; gating one was the rule reaching past what it protects (ADR-0034).
_Avoid_: calling an open surface an "exception" — it is outside the scope, not a
hole in it.

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

**Effective reveal** (render override):
The render-time reveal mark a reader's own stamp on a game substitutes for
`revealedThrough` (see `effectiveReveal`, ADR-0048). It unseals the screen for
viewing ONLY — it is never persisted, never ratcheted, and never crosses to
another device; the real high-water mark it shadows is left untouched, so
unstamping the game drops straight back to it. (The Scores Unlocked day pass was
a second input until ADR-0116 removed it.)
_Avoid_: fake reveal, temporary reveal

**Open by date** (box score):
A box score whose game's schedule date is before the slate's today renders with no tap
(`boxScoreOpensByDate`, ADR-0117). A render override like Effective reveal: it persists
nothing and never reaches `revealedThrough`. Today's games and the innings viewer keep
their seals.
_Avoid_: unlocked, old-game pass

**Live half**:
The half-inning the actual game is in right now, or — between halves — the one
it just finished, read from the linescore's live state (`selectLiveHalf`,
`src/api/liveEdge.js`, ADR-0055). It reports an inning number and which half,
never a score, and decides only which button the innings bar or the lineup page
draws ("Caught up", "Catch up to live").
_Avoid_: current play, latest inning, live edge

**Lens**:
The live scorecard's phone mode (`/{date}/{matchup}/scorecard` at phone width,
ADR-0092). A fixed navy frame holds the next sealed box in one place on the
screen (the seat), and the sheet scrolls under it after each tap. Near the top
of the order, where no box can reach the seat, the frame rides on the box. A bottom bar says the
last opened play in words and holds Unwrap, the same reveal as the seal. It is
not a reveal path of its own, and it is off under a force-reveal.
_Avoid_: zoom mode, focus mode (the old name for Gameday's windowed mode, not the Lens)

### Game structure

**Gameday**:
The screen of a game's half-inning pages (`top{n}` and `bottom{n}`), the tab after the two lineups. One window that never scrolls, at any size: the band, the stage, the hero and the bar always, and the panels the window's tier has room for; the rest fold into the Menu (#2566, ADR-0043's 2026-10-27 amendment). One tap on the advance reveals and plays one at-bat, or one sub-step in pitch mode. The tab reads "Gameday". Code and ADRs may still say "the innings viewer" (`InningViewer`). Addresses do not change. It replaced Express Lane.
_Avoid_: focus mode, innings tab, MLB Gameday (that is MLB's own product)

**Stage**:
Gameday's home-plate view, the centerpiece: 16-bit sprites, the pitch on its measured path, the swing, and the ball in play. It plays only on the reveal tap (ADR-0046). At rest, before the tapped play, it draws the due-up batter with his zone map (pre-game numbers), which a reader can dismiss for the game.
_Avoid_: scene, replay (the old pitcher card's terms)

**Checkpoint**:
The pause at the end of each half on Gameday: pages of the half's tally, its pitching, its at-bats and the game so far (plus the notes when the game has a callout bundle). It takes the stage's slot until the advance names the next half.
_Avoid_: summary, between-innings card

**Sub-step**:
One tap inside a Gameday at-bat: a pitch, an automatic call, a baserunning event, a substitution, or the result (ADR-0123). The at-bat cursor's finer grain; never a spoiler boundary of its own.
_Avoid_: micro-step, pitch step

**Pitch mode**:
Gameday's per-game mode in which each tap reveals one sub-step, pitch by pitch, instead of one at-bat (#2570, ADR-0123).
_Avoid_: pitch-by-pitch setting (it is not a My Tally setting)

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

**Line score (Gameday)**:
Gameday's navigator panel: a runs grid over every unlocked inning whose run
cells are buttons that jump to that half, the only way to reach a half more
than one step away (ADR-0043). A phone folds it into the Menu.
_Avoid_: RollingLine (the old screen's component, deleted in the swap)

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

### Names

**Game Log**:
The collection of the games a user has stamped, and the screen that holds it. Every
user-visible string says Game Log. The code name is `logbook`: the route
(`/logbook`), modules, CSS classes, and storage keys.
_Avoid_: Logbook in any user-visible string

**Pitcher Game Log**:
A different thing with the same name: on a pitcher's player page, his games of a
season, starts and relief outings, one row per game, with the score, his decision, his
line and the pitch mix (#1851, ADR-0110, retired by ADR-0117). The stamp Game Log is the games that YOU
stamped; the pitcher Game Log is the games that HE pitched. The code name is `pitchlog`.
_Avoid_: Start by start

**Box Lines**:
The drilldown behind a summary stat line: tap the line and see the game-by-game rows that
add up to it. An internal name for prompts and code; it never renders. The page says
"See all" and "Game lines".
_Avoid_: Stubs, Receipts
