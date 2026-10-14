# Player page redesign: the plan

Status: **phase 6 done** (2026-10-14, #1898): `/player/{id}` serves the new page and the
old tab code is deleted. Phase 7 is next.

This plan moves the batter and pitcher pages to a new look. Later, the rest of the
site moves to the same look. The player page is the first page, and its shared parts
are the parts that the other pages use.

## 1. The source

**Design canvas:** https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK ("Player Detail
Page - Pitcher and Batter"). The canvas is private to Gary. An agent that runs as Gary
reads it with the Artifact tool: `action: "read"`, `path: "project/<board>.dc.html"`.
`project/canvas.json` lists the boards and Gary's notes.

| Page | Boards |
| --- | --- |
| Batter | `B-phone` (390), `B-wide` (1180), `SeasonStats`, `Splits`, `PlateApproach`, `Contact`, `FormTrend`, `BatterGameLog`, `FoulBalls`, `PathToMajors`, `PathProspect`, `Firsts` |
| Pitcher | `D2-phone` (390), `D2-wide` (1180), `ArsenalReveal`, `PitcherSplits`, `GameLog`, `SeasonStatsPitcher`, `MoundCard` |
| Shared | `TbdWire`: the dashed wireframes for sections that the canvas does not draw yet |

The canvas uses the house faces (`src/tokens/fonts.css`: Barlow Condensed, Source
Sans 3, JetBrains Mono) and the house paper and ink (`--paper-0` #F6EFDC, `--paper-2`
#FBF6E9, `--ink-0` #0F1822, `--graphite` #6B6558). The look is an extension of the
design system. It does not replace it.

## 2. Decisions (Gary, 2026-10-13)

Recorded in [ADR-0109](adr/0109-the-canvas-is-the-site-wide-look.md).

1. **The canvas is the site-wide look.** It answers the open "pick a direction" item in
   #1198, section 1. The four directions in PR #1841 close. The shared parts go into the
   design system (`src/components/ui/`, `src/styles/system/`), not into the player page.
2. **A hidden page, then a swap.** The new page is built at an unlisted address beside
   the live page. The live page does not change until one swap PR.
3. **A card with no data hides.** Its jump-bar button hides with it. This is the rule
   for two-way, minor-league and retired players, as it is on the page today. A two-way
   player gets both the batting and the pitching modules, each under its own heading
   (today's `blocks.map` behaviour).
4. **TBD sections ship with today's content.** Each section that is still a dashed
   wireframe keeps its current content inside a plain stamped card. It does not need a
   design before the swap. Gary designs it later, when he is ready (phase 7).
5. **Data comes first.** Before a card is built, every number on it has a known source.
   Adapt an existing source (a statsapi call, a `/data/` file, a `scripts/gen-*.mjs`
   generator) before you add a new one. A card's build issue is blocked by its data
   issue.

## 3. The shared parts

Copy each part from a finished board. None of them needs new design work.

| Part | What it is | Seen on |
| --- | --- | --- |
| Stamped card | 2px ink border, hard 4px ink offset shadow, an ink name tab on the top-left edge, an optional count tag on the top-right edge | every module board |
| Stat tile | One label, one big number, one caption. Three fills: ink (the lead tile), tint, plain | header of `B-phone`, `SeasonStats` |
| Fact strip | A grid of small label and value cells under the hero | header of `B-phone` |
| Jump bar | Square buttons with a count badge; the current button is ink. It scrolls sideways on a phone and wraps on wide screens | `B-phone`, `B-wide` |
| Stamp-in motion | A card drops 4px into its shadow when it appears; off under `prefers-reduced-motion` | every board |

New tokens: the offset shadow, the hairline (#DED6C0 on the canvas; compare with
`--border-hairline` first), the tile tints (#DDE7CF, #86BE98) and the stamp motion. Each
new value goes in `src/tokens/` with a semantic alias (ADR-0023, ADR-0107) and passes
`check-contrast`. The jump bar extends `src/components/chrome/HubTabBar.jsx`, because
the team page uses the same control (ADR-0030: the bar stays the app's own colours).

The dashed TBD card is a canvas marker for "not drawn yet". It is **not** a shared part,
and users never see it.

## 4. The page

**Hero:** photo, role and number, name, club, position pill, fact strip, then five stat
tiles (a closer's first tile shows SV in place of W-L).

**Jump bar (batter):** Overview, Season, Splits, Plate approach, Contact, Form trend,
Game log, Career, History. The pitcher bar follows `D2-phone`.

**Sections:** one long scroll, in the order of the phone boards. Each section loads
when it scrolls into view. The PR that adds the page counts the requests of a cold load
of `/player/{id}`, before and after (in a production build; StrictMode doubles them in
dev).

**What holds from today** (#1108, "What holds"): `?d=` and `?s=` on every door out;
ADR-0057 addresses; the Money band decision from #928; the file and directory caps.

## 5. Phases

| Phase | Work | Output |
| --- | --- | --- |
| 0 | Record the decision | One ADR for the look and the rules in section 2. Update #1198. Close PR #1841, #1108, #1109, #1110 and #1391 as replaced, with a link to the parent issue. Move #1846 and #1851 under it. |
| 1 | Data audit (research, no code) | One table per designed card: each number, its source today, the gap, the smallest fix. One data issue per gap. |
| 2 | Data issues | One PR per gap. Runs alongside phase 3. |
| 3 | Shared parts | The tokens and parts in section 3, shown in `/design-lab` at 390 and 1180 px. |
| 4 | Hidden page | The new page at an unlisted address: hero, stat tiles, jump bar, for a batter and a pitcher. |
| 5 | Modules | One issue per designed module (section 6), each blocked by its data issue. Then the TBD sections, ported with today's content. |
| 6 | Swap (done, #1898) | `/player/{id}` serves the new page. `/stats`, `/analytics` and `/history` scroll to their sections, so old links work. Then delete the old tab code. |
| 7 | Follow-ups | One redesign issue per TBD section. The team page (#1107) is rebuilt on the same parts. |

Before the swap, Gary checks screenshots of four edge pages: a two-way player (Ohtani,
660271), a minor leaguer, a retired player and a closer.

## 6. Modules

| Module | Role | Board | Known data notes |
| --- | --- | --- | --- |
| Season statistics | both | `SeasonStats` | Scope switch (MLB, Minors, All, Postseason) drives tiles and table. All-Star star and gap rows not drawn yet. |
| Splits | both | `Splits`, `PitcherSplits` | |
| Plate approach | batter | `PlateApproach` | Zone map: reuse `hitterMap` (#1846). |
| Contact | batter | `Contact` | Spray: #1846. |
| Form trend | batter | `FormTrend` | `src/api/hitterForm.js`. A pitcher version is a TBD wireframe. |
| Game log | both | `BatterGameLog`, `GameLog` | Pitcher: #1851. |
| Foul balls | batter | `FoulBalls` | The nightly foul file has no counts, swings, outcomes or league averages by count. |
| Pitch arsenal | pitcher | `ArsenalReveal` | |
| On the mound | pitcher | `MoundCard` | Opponent logos are placeholders on the board. |
| Path to the Majors | both | `PathToMajors`, `PathProspect` | |
| Firsts | both | `Firsts` | |
| Hero stat tiles | both | `B-phone`, `D2-phone` | League rank ("Rank TBD"): #1856. |

TBD sections, ported with today's content (from `TbdWire`): status banners, header
extras (OVR), overview extras, percentile rank, Advanced, Run value, Command, Target
command, Hits like / Pitches like, Milestone watch, Prospect rankings, Awards, Innings
by position, Team history, Contract, Transactions, Photos and highlights.

## 7. Tracking

- Milestone: **Player page redesign**.
- One parent issue that links this spec. Every phase issue is a sub-issue, so the
  parent shows a progress bar.
- Native "blocked by" links: each module is blocked by its data issue, and each data
  issue is blocked by the audit.
- #1198 holds the order of work.

## 8. Not in this plan

- The team page and the other pages. They follow in phase 7 with their own issues.
- New designs for the TBD sections.
- `npm run e2e`. It runs only when Gary asks.
