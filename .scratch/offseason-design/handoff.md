# Local handoff

- Branch: `codex/offseason-design`
- Worktree: `C:\Users\gzilavy\bbsbh-offseason-design`
- Base: `origin/main` at `981a3a83c`; no dependency branch.
- PR: not opened, as requested. No push and no deployment.
- State: only `.scratch/offseason-design/` is untracked. Application files,
  generated production data and dependency manifests have no local diff.
- Active work checked: PR 1032 concerns nightly glove-target freshness. The
  design study does not edit its subsystem or any other active checkout.
- Cleanup: **do not remove**. These local, uncommitted artifacts are the only
  saved copy of the study. Preserve or explicitly abandon them first.

## Deliverables

- `index.html`: local gallery, all three desktop/mobile concepts and comparison.
- `research.md` and `research.html`: full assessment, sources, season rules,
  spoiler contract, data support, report selection criteria and decisions.
- `a-desktop.png`, `a-mobile.png`, `b-desktop.png`, `b-mobile.png`,
  `c-desktop.png`, `c-mobile.png`: static annotated wireframes.
- `draw.py`: editable drawing source. Uses Pillow and Windows Arial/Consolas;
  real production typography is specified in the study.
- `standings-probe.json`: 2025 standings endpoint row counts for 11 leagues.

## Validation

- Visually inspected all six PNGs using the image viewer; corrected a clipped
  desktop board and an unsupported dropdown glyph. Completed brackets now show
  illustrative named winners rather than undecided slots.
- Checked Python drawing-source syntax, valid PNGs, HTML image descriptions and
  local asset references. Passed.
- Requested the exact gallery, report and all six image URLs from localhost.
  All returned HTTP 200 with the expected content types.
- Confirmed Vite process 77956 belongs to this worktree. `npm run dev` started
  on the first reserved port, 5173, and remains running.
- Checked production paths with `git diff --exit-code`; no local changes.
- Verified season metadata for sport IDs 11–14 and league definitions for all
  supported minor levels. Verified all three standings periods for all 11
  leagues in 2025. Sampled High-A game 784185: 83 plays and both boxscore teams.
  These are coverage/shape checks, not a full dataset accuracy audit.
- Production unit/lint/E2E suites were not run: no production code changed.
  Artifact checks above are the validation for this research-only delivery.
- Browser limitation: discovery succeeded, but browser documentation/control
  failed after the plugin update (old documentation path missing; new runtime
  reports that a trusted browser service is required). Thus the existing app
  was inspected through source and real endpoints, not through a successful
  interactive browser session. HTML browser rendering, keyboard navigation,
  and the real at-bat interaction still need browser verification.

Local gallery: http://localhost:5173/.scratch/offseason-design/index.html?nointro

Local report: http://localhost:5173/.scratch/offseason-design/research.html?nointro
