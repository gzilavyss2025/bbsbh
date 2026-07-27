# MiLB team hex colors — research stash (RETIRED)

**The data is gone from here. It lives at `src/lib/data/milb-colors.json` and is
wired into the app.** Retired 2026-07-27 by Team Identity Lab PR 5
(`.scratch/team-identity-lab/PRD.md` §5).

Keeping this file for the two things the data store shouldn't carry: how the
research was done, and what the confidence ratings mean. Everything per-team —
the hexes, `third`, `confidence`, `source`, and every caveat note below — moved
into the store itself, one field per entry, so the warning travels with the
value instead of living in a README nobody opens.

## What happened to it

The stash held 120 affiliates; the app had already landed 115 of them (the pairs
were copied across in an earlier pass). A diff on 2026-07-27 found **zero hex
disagreements across all 115 shared entries** — the live table already *was* this
research. So PR 5 was not a merge. It was:

- the `third`/`confidence`/`source`/`note` metadata the earlier copy dropped,
  restored onto all 120 entries;
- the 5 missing teams resolved or explicitly marked unresolved (below);
- one fallback chain replacing two (`src/lib/brandColors.js`).

## How it was built

Confirmed first: **statsapi.mlb.com carries no color field for any team, MLB or
MiLB**, and MLB/MiLB do not publish an official public hex/Pantone spec sheet. So
this leaned on the same kind of third-party color-aggregator sites the MLB-club
colors in `src/lib/brandColors.js` cite (`teamcolorcodes.com`) — except for MiLB,
`teamcolorcodes.com` doesn't have per-team pages, and `sportsfancovers.com`
(which does) had an expired SSL cert during the research pass, so those results
are **search-snippet excerpts of that site**, not a direct fetch — treat
accordingly.

Four parallel research agents each covered one full level (Triple-A, Double-A,
High-A, Single-A, ~30 teams each), pulling from whatever source actually had
per-team hex data:

- **Triple-A** → Wikipedia infobox `{{Color box}}` values
- **Double-A** → sportsfancovers.com (via search snippets)
- **High-A / Single-A** → trucolor.net league portfolio pages

**No hex was invented.** Where only color *names* were found, the team is marked
`"found": false` rather than guessed — three still are (below).

## Confidence levels

These are the `confidence` field's three values, and the only three:

- **high** — 2+ independent sources agreed on the same hex values
- **medium** — single-source (one aggregator), plausible but unverified
- **low** — conflicting sources, or a likely mislabel, or names-only (no hex)

Today's spread: 6 high, 107 medium, 7 low. **Every entry is single-sourced unless
flagged `high`.** Re-verify against a team's own site or brand guide before
leaning on any one of them for something more permanent — this was a snapshot in
July 2026, not a maintained source, and several MiLB clubs rebrand or relocate
every year.

## Still unresolved — where a future pass should start

Three clubs carry `"found": false` and no pair. They fall through to their parent
org's colors and the Team Identity Lab flags each one "no researched color":

| Team | Why |
| --- | --- |
| 482 Corpus Christi Hooks | Rebranded 2025; color names only (navy, light blue, red, white, silver) |
| 553 Knoxville Smokies | Rebranded from Tennessee Smokies for 2026; names only (royal blue, light blue, red, gold) |
| 1956 Somerset Patriots | Names only (navy, maroon, silver, white) |

Two more were resolved by PR 5 but are worth re-checking, and both are flagged
`confidence: low` in the store with the reasoning in their `note`:

- **546 Portland Sea Dogs** — two sources disagreed on the entire navy family.
  Resolved toward the sportsfancovers reading (`#e03a3e`/`#003263`), owner-
  approved. The conflict is recorded, not settled by a new source.
- **6325 Columbus Clingstones** — brand-new 2026 club, source page never cleanly
  identified. Took the hand-tuned lab value, which matched the research reading
  closely in swapped roles.

Also still flagged in the store: **106 Erie SeaWolves** (a source hex mislabeled
as "Navy Blue" when it's red/magenta — the hex may be fine, the label is not) and
**3410 Richmond Flying Squirrels** (pre-2026 colors; the team's 2026 refresh,
"Radiant Red"/"Squirrels Silver", has no documented hex anywhere yet).

Beyond those, the newest identities are the least-covered and worth a spot-check:
Quad Cities River Bandits, Great Lakes Loons, Wilmington Blue Rocks, Eugene
Emeralds, Jersey Shore BlueClaws, Rome Emperors, Hub City Spartanburgers, Salem
RidgeYaks, Hill City Howlers, Ontario Tower Buzzers, Wilson Warbirds, Rancho
Cucamonga Quakes, Inland Empire 66ers.

## Editing any of this now

Don't hand-edit the JSON. Run `npm run dev`, open `/identity-lab`, and use the
MiLB dimension — see `src/lib/CLAUDE.md`.
