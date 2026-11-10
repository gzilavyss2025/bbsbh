# src/components/offseason — the empty-slate page state

`GameSelect`'s MLB/AAA/AA/A+/A rail grows a sixth `WINTER` tab, second, Oct-Feb —
`components/winter/`, ADR-0078.

An empty slate gets a second page state (`src/components/offseason/`): the wire at MLB
(ADR-0074); at a level, dark from mid-September on ITS leagues' published dates
(ADR-0079), a checked game to score and who moved up (ADR-0080). Both then carry one
notebook note — twelve-pitch at-bats at MLB (the /fouls batter-vs-pitcher row, minus its
scorebug), youngest regulars at a level — and the season record, the one door onto
results: a label, never a seal, inward at MLB and out to MiLB.com below it. MLB's row also
carries the postseason champion for the whole offseason, off slice 3's live bracket, with
the full bracket one tap away (ADR-0081's addendum). MLB's page is one column, no right rail:
a hero row (season record + countdown), the winter calendar, the top six unsigned free
agents (`TopFreeAgents.jsx`, hover-card stats, WAR order), the wire two-up, then the
notebook as three stamped cards. The logo rail links every club, so no club grid.
