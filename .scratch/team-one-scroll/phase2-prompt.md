Work issue #1106 Phase 2 — extend the settled band system. This CONTINUES an
open draft PR; it does not start new work.

WORKSPACE. Do NOT create a worktree and do NOT base on main. The branch
`claude/team-sections-design` is already checked out at
`C:\Users\gzilavy\bbsbh-team-sections` — work there. `git fetch origin` first
and confirm `git log --oneline -1` shows `acf8b094c` or later. Everything below
depends on that branch; main does not have it. The dev server is NOT running
(it was stopped when the machine ran low on memory) — start it on the first
free reserved port and keep it up.

READ FIRST, in this order:
  .scratch/team-one-scroll/design.md          the settled system. All of it.
  .scratch/team-one-scroll/canvas/README.md   how the canvas is built + published
  .scratch/team-one-scroll/canvas/records/records.md
  .scratch/team-one-scroll/scope.md  2B, 2E (all five clubs), 2G, 2I
  docs/adr/0082-... (DRAFT, stays DRAFT) · docs/adr/0030-club-theming-is-identity-only.md

THE CANVAS: https://claude.ai/artifact/NV6fz4ywi3d3nvX5rdRa8s
Phase 1 is signed off. Gary picked v4 on 2026-09-21.

SETTLED — build on these, do not redesign them.
  - Band head: a FULL-BLEED 2px --ink-0 rule, then the band name at --fs-h2
    21px, then a STANDFIRST at --fs-small 13px in --ink-1, natural case, 16px
    under it. Not a question. Not the report pages' trailing clay rule.
  - Sub-head: the same gesture one step down — full-bleed 1px --rule, then
    --fs-h3 17px in --ink-1. 32px of air above the rule.
  - So: FULL-BLEED = page structure, CONTAINED = card structure. Four levels,
    two devices, two planes.
  - Records is an index of twelve 44px ledger lines, closed on arrival, 826px.
    The league mark is green top-5 / clay bottom-5 at the level, drawn as a 3px
    row edge plus the rank on its own line ("1 of 30"), and a proportional edge
    on the index line.
  - TEN type sizes, THREE block spacings (48/32/16), ZERO new tokens.
    design.md section 5 is the contract. Hold every artboard to it, and say so
    if you break it.

WHAT PHASE 2 DRAWS.

  1. RANKS at 249 Wilson — the hard case, ONE card (the leaders ledger) under a
     full-width head. 2G says this head must carry a level qualifier so the band
     reads as "the rank boards do not exist at this level" rather than as
     truncated; the standfirst already drafted for it is in design.md section 5.
     Then say in ONE line how the ABS card slots in above it at 556 Nashville,
     whose Ranks is two cards (ABS 1,014 + ledger 534 = 1,548px).

  2. ABOUT with four unlike modules at 249 — Ballpark 93 · Logos & jerseys 260 ·
     Affiliation history 98 · Made The Show 906 = 1,357px. The head has to hold
     a real band AND read as the page's close. Then note what the two-module
     version at 158 (Ballpark 1,014 + jerseys 260 = 1,274px) drops, and the
     349px version at 675.

  3. THE STICKY JUMP BAR — resting, stuck, current-section. Club-neutral navy
     per ADR-0030: a club may colour a card that identifies the club, never page
     chrome. It is SHARED with the player hub (2I), so draw it as one control,
     not as a team-page control. No new shadow when it sticks — this is paper.

  Then the full pages, FLOOR FIRST, because the system has to survive the floor:

  4. 675 Caneros de los Mochis — FIVE bands, and the page no board has shown
     yet. Include the seam where a band is ABSENT. This club is UNTHEMED —
     headerThemeFor returns null, so every card head is graphite on transparent
     with a hairline, and the band head's ink rule is the only structural colour
     on the page. Its Roster band is 3,917px, LARGER than Milwaukee's, because
     the winter 40-man is one uncapped list of 55 players. Records does not
     render here at all.

  5. 158 Milwaukee — seven bands, everything present.

  6. 249 Wilson is a CHECK, not a full artboard. Its Ranks and About are drawn
     above; confirm in one paragraph that the system holds at six bands and draw
     only what else differs. 572 is identical to it; 556 differs by one card in
     Ranks.

THE PAGE TOTALS, with the reorganized Records card. Re-measure rather than
trusting these, and say so if they move:

  Band       | 158 Milwaukee | 249 Wilson | 675 Los Mochis
  Standing   |         2,099 |      1,252 |            599
  Ranks      |         2,533 |        534 |            534
  Games      |         2,622 |      2,010 |          1,711
  Roster     |         3,517 |      2,974 |          3,917
  Farm       |         3,185 |      3,205 |         absent
  Money      |         2,364 |     absent |         absent
  About      |         1,274 |      1,357 |            349
  TOTAL      |        17,594 |     11,332 |          7,110
  bands      |             7 |          6 |              5

The floor is now 40% of Milwaukee, up from 36% — reorganizing Records narrowed
the gap, because it cost the long page 2,412px and the floor nothing.

THE TRAPS.
  - Display and mono ship at ONE weight (700). font-weight is a no-op.
  - No native title= tooltips.
  - Headings shout; body copy stays natural case.
  - Rank numbers carry no "#", and a rank sits on its own line from its stat.
  - A band a club cannot fill is ABSENT — not rendered, not in the jump bar.
  - CANVAS.JSON IS HAND-POSITIONED. Gary moves the notes in the editor.
    build.mjs refuses to overwrite it and writes canvas.proposed.json instead.
    To publish: READ the live index, merge only your keys onto it, and publish
    that. Never send the generated one — it drags every sticky back.
  - The Artifact tool refuses a root outside the working directory, so copy
    canvas/project/ into the session scratchpad before publishing.
  - Write .dc.html via the build scripts, not by hand. A heredoc past ~140 lines
    gets truncated and fails with a bogus quoting error.
  - A backtick inside a CSS comment terminates the JS template literal in both
    builders. Do not put one there.
  - look.mjs renders a board at 390px and slices it. USE IT — render every
    artboard you make, open the PNGs, list three things wrong, and fix at least
    two before you publish.

DELIVERABLES. Commit and push after each one.
  1. The Phase 2 artboards, published to the SAME canvas, sources under
     .scratch/team-one-scroll/canvas/. Link in the PR body's Phase 2 slot,
     which is already there waiting.
  2. design.md PART TWO, appended: for each of the two problems, the mechanism
     chosen and what it beat; what was taken from each of the three shipped
     screens; the element-by-element harmonization list #1107 works through; and
     the band-head spec, which is also the evidence #1113 asked for. If context
     runs short, THIS FILE is the deliverable to protect.
  3. Any correction to scope.md or ADR-0082 your own measurements prove — list
     each in the PR body. ADR-0082 stays DRAFT.

VERIFY: npm run lint and npm test, both foreground, echo the exit code. Keep the
dev server running and put the clickable local URL in the handoff.

FINISH: push to the SAME branch and the SAME PR (#1149). Do not open a second
PR. Do not merge main into the branch without asking. Do not merge the PR —
Gary signs off on the design before #1107 opens.
