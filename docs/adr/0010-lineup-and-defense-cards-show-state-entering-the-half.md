# Lineup and defense cards show the state entering the half, rendered outside the seal

The half-inning page's lineup card and defense diamond used to live *inside*
the SealBox, computed by reveal-only `revealDefense`/`revealBattingOrder` and
built up "through the end of the half being revealed." That made them a tap
away and folded in substitutions made *during* the half — but the scorer wants
those cards as a set-up reference *before* scoring the half, the way you copy
the lineup and the opposing defense onto the sheet as the half begins.

So the cards now render **outside** the seal and show the state **entering the
half** — the starting nine plus every sub, switch, and pitching change made
*before that half's first pitch*, and none of the changes made during it. This
is the same spoiler logic ADR-0003 established for `selectPrePitchChanges`:
what's known at first pitch is what a broadcast announces before the half
starts, so it isn't score-revealing. The reveal-only functions were reframed
accordingly:

- `revealDefense` → `defenseEntering` (`api/defense.js`)
- `revealBattingOrder` → `lineupEntering` (`api/battingorder.js`)

Both compute their result by walking play events only up to the target half's
first pitch (`forEachEventBeforeFirstPitch`, `select.js`) — so a sub made mid-half
is not reconstructed until the user reveals into it. `lineupEntering` also
carries each occupant's jersey number and fielding position (inverted from
`defenseEntering`), and the page shows **both** teams' lineups (headed by the
spelled-out club name, `selectTeamMeta`'s `clubName` — "Diamondbacks", not "AZ"
or the "D-backs" short form), each row's standing occupant reading name │
number │ position, not just the batting side's.

The cards are positioned by reveal state: **above** the seal while the half is
still sealed (you stage the sheet before tapping), then **below** the
play-by-play once revealed (out of the way of the results). Either way they
stay outside the seal — the position just follows the reading flow.

The caller-gating contract is identical to ADR-0003's: `InningViewer` renders
the cards only when the half is at or one past the reveal mark
(`revealed || isNextToReveal`, i.e. `halfIndex <= revealedThrough + 1`). A half
further out stays fully sealed — showing its "entering" state would reconstruct
every intervening sealed half's substitutions, which is exactly the "flurry of
subs telegraphs a blowout" leak the reveal-only boundary guarded against.

**Amends ADR-0001.** `defenseEntering`/`lineupEntering` are no longer
reveal-only modules; they are caller-gated pre-pitch selectors alongside
`selectPrePitchChanges`. They still touch no runs/hits/errors. The box score
keeps calling `defenseEntering` with an `Infinity` cutoff to get the whole-game
alignment, rendered inside the box score's own seal — that use is unchanged.
`linescore.js` and `derive.js` remain strictly reveal-only.

## Addendum (2026-08-10): the titles stopped naming the half

Both cards used to be titled "Lineups entering the Top 7th" / "Defensive
alignment entering the Top 7th". They now read **"Lineups"** and **"Defensive
alignment"**.

The long form existed for a reason worth stating so it isn't reintroduced by
someone rediscovering it: a card that sits *below* the play-by-play once the
half is revealed can read as *current* rather than as the state the half opened
in — and it may sit under an at-bat card that already showed a mid-inning
defensive change contradicting it.

That reason no longer earns the words. The half is named three times before the
reader reaches either card — the half-inning navigator ("Top 7th"), the half's
own title bar, and the URL — and every row on both cards is a pre-pitch fact. A
fourth statement of the same thing was restating the obvious, and it did so in
the one place with least room for it: focus mode's reference rail is a fixed
328px track (ADR-0043), where the long titles wrapped to two lines.

**Nothing about the data changed.** These are still `lineupEntering` and
`defenseEntering`, still the state entering the half, still caller-gated to the
reader's own next half by `safeToShowEntering`. This addendum records a copy
decision, not a semantic one — and the two titles must stay matched to each
other, long or short, for the reason `12-sealbox.css` gives at
`.lineupcard__title`.
