# MiLB team hex colors — research stash

Speculative research for a **future project**, not wired into the app. `bbsbh` has
no MLB-club-only `TEAM_COLOR_PAIRS` equivalent for MiLB — `src/lib/teams.js`
currently resolves any MiLB team id to its **parent MLB org's** color via
`MILB_PARENT_ORG` (see `gen-milb-team-colors.mjs`), because no clean per-team MiLB
color source existed. This stash is a first pass at closing that gap, in case a
future project wants each MiLB club's own colors instead of the parent org's.

## What's here

`milb-colors.json` — all 120 full-season MiLB affiliates (from
`public/data/affiliates.json`, 2026 season), keyed by MLB Stats API team id, with
`primary`/`secondary`/`third` hex, a `confidence` rating, and a `source`.

## How it was built

Confirmed first: **statsapi.mlb.com carries no color field for any team, MLB or
MiLB**, and MLB/MiLB do not publish an official public hex/Pantone spec sheet. So
this leans on the same kind of third-party color-aggregator sites the existing
MLB-club colors in `teams.js` cite (`teamcolorcodes.com`) — except for MiLB,
`teamcolorcodes.com` doesn't have per-team pages, and `sportsfancovers.com`
(which does) had an expired SSL cert during this research pass, so results are
**search-snippet excerpts of that site**, not a direct fetch — treat accordingly.

Four parallel research agents each covered one full level (Triple-A, Double-A,
High-A, Single-A, ~30 teams each), pulling from whatever source actually had
per-team hex data:
- **Triple-A** → Wikipedia infobox `{{Color box}}` values
- **Double-A** → sportsfancovers.com (via search snippets)
- **High-A / Single-A** → trucolor.net league portfolio pages

No hex was invented by any agent — where only color *names* were found (not a
hex code), the team is marked `"found": false` in the JSON rather than guessed.

## Confidence levels

- **high** — 2+ independent sources agreed on the same hex values
- **medium** — single-source (one aggregator), plausible but unverified
- **low** — conflicting sources, or a likely mislabel, or names-only (no hex)

Every entry in this file is single-sourced unless flagged `high`. **Re-verify
against the team's own site/brand guide before using any of this in a real
feature** — this is a snapshot, not a maintained source, and several MiLB teams
rebrand or relocate every year.

## Known gaps / unresolved conflicts (as of 2026-07-24)

- **546 Portland Sea Dogs** — two sources disagree on the entire navy family
  (not a rounding difference). Not usable as-is.
- **553 Knoxville Smokies**, **482 Corpus Christi Hooks**, **1956 Somerset
  Patriots** — only color *names* found, no hex at all (recent rebrands, not yet
  covered by aggregators).
- **106 Erie SeaWolves** — a source hex is mislabeled as "Navy Blue" when it's
  actually red/magenta; the color itself may be fine but don't trust the label.
- **3410 Richmond Flying Squirrels** — colors on file are the *pre-2026* identity;
  team debuted a refresh for the 2026 season ("Radiant Red"/"Squirrels Silver")
  that has no hex documented anywhere yet.
- **6325 Columbus Clingstones** — brand-new 2026 expansion team; hex source
  wasn't cleanly identified, lowest-confidence entry in the set.
- Several other 2025/2026 rebrands/relocations (Quad Cities River Bandits, Great
  Lakes Loons, Wilmington Blue Rocks, Eugene Emeralds, Jersey Shore BlueClaws,
  Rome Emperors, Hub City Spartanburgers, Salem RidgeYaks, Hill City Howlers,
  Ontario Tower Buzzers, Wilson Warbirds, Rancho Cucamonga Quakes, Inland Empire
  66ers) are included with hex values dated to the new identity, but are worth a
  spot-check since they're the newest and least-covered entries.

## If a future project picks this up

1. Re-run search/fetch on the flagged teams above first — those are the known
   holes.
2. Spot-check a sample of "medium" confidence entries against a second source
   (team's own site CSS, official brand guide PDF, or a working
   `sportsfancovers.com`/`teamcolorcodes.com` fetch) before trusting the set
   wholesale.
3. If this graduates into `src/lib/teams.js`, follow the existing
   `TEAM_COLOR_PAIRS` pattern (MLB clubs only today) — comment the source and
   verification date the way that block already does, and decide whether MiLB
   colors should extend `MILB_PARENT_ORG` or replace it.
