# Per-inning errors are read from the fielding side, the opposite half from that team's runs/hits

The MLB feed's linescore stores a team's per-inning `errors` under that
team's own node, but for the half it *fields* — home fields the top of the
inning, away fields the bottom — the opposite half from where that same
node's `runs`/`hits` apply. Reading `errors` the same way as `runs`/`hits`
(from the batting team's half) both shows the wrong number and leaks a still-
sealed half's errors before the user has revealed it. `errors` must be read
from the fielding team and gated on the fielding half, not the batting half.
