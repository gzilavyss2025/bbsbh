# The spoiler rule covers four scoring surfaces

**Status:** Accepted
**Date:** 2026-10-22
**Issue:** #2523
**Amends:** ADR-0042 (Stamp In has no consent step), ADR-0083 (where the seal colour may appear), ADR-0087 and ADR-0095 (the cutoffs are date footings, not seals)
**Relies on:** ADR-0034, ADR-0052, ADR-0116, ADR-0117

## Context

Many ADRs written since ADR-0001 describe sealing, gating or warning on pages that carry no
score: standings, team and player pages, leader boards, the money pages, the standalone pages.
Agents read that prose as a rule for the whole app. They added caution to open pages, and
the app grew seals that guarded nothing a reader keeps score against.

Gary decided on 2026-10-22 to scale the rule back ("scaling back the spoiler stuff"). PR #2524
rewrote the guidance in the CLAUDE.md files, the skills, `CONTEXT.md` and the PR template. This
ADR records the scope, so the older ADRs can stay as history without being read as current law.

## Decision

**The spoiler rule covers four scoring surfaces and nothing else:** the slate's score cells, the
lineup pages, the innings viewer, and the box score. On those, a score-revealing value never
exists in the DOM until the reader reveals it. Everything else opens live and needs no spoiler
thought. A stat line is not a score. Do not seal, gate or warn about anything outside the four
surfaces.

### What stays, unchanged

`SealBox` and its render-function shape (ADR-0002); the reveal-only and spoiler-free module
split and `spoiler-manifest.json` (ADR-0001); `NetworkOnly` for `statsapi.mlb.com` (ADR-0004);
the five gotchas (ADR-0005 to ADR-0009); the caller-gated pre-pitch selectors (ADR-0003,
ADR-0010); `revealedThrough` and `useRevealProgress`; the stamp mechanics and their containment
guard (ADR-0035, `check-stamp-surfaces.mjs`); the box score's open bit and the date opener
(ADR-0049, ADR-0117); the stamp override on a stamped game (ADR-0048).

### What changed

- **Seals outside the four surfaces are gone** (#2533). The standings reveal chip, the dead
  `.duepill` rule and the offseason "Score sealed" label were removed. Standings open live;
  "Entering today" is one tap away. ADR-0083's allowlist lost those three entries. Its rule
  stands: `--seal*` appears only where a reveal is possible.
- **Stamp In has no consent step** (#2537). `/team/{id}/stamp-in` opens straight to the season.
  The Games band already shows the same results openly (ADR-0119), so the consent gated nothing
  the team page did not show. ADR-0042's **render-only rule stays**: the page never writes
  `bbsbh:reveal:{gamePk}`, mounts no `SealBox` and imports no `useRevealProgress`. Its
  "no stamp art on this page" containment stays too. `ConsentModal` and the `stampIn` copy
  group are deleted, so ADR-0116's "What stays" line about Stamp In's own `ConsentModal` is
  history.
- **The guards were checked** (#2538). No guard in `check-spoiler-manifest.mjs`,
  `check-seal-scope.mjs` or `check-stamp-surfaces.mjs` blocked an open surface, so only wording
  changed there.

### What the older ADRs now mean

- **ADR-0087 (postseason) and ADR-0095 (Matchup Scout).** "The date cutoff is the seal" is a
  date footing, not a seal. Those pages read data up to the day before the slate date (or
  `?d=`) and stop there. That behavior is **kept**: the World Series home mounts on the slate,
  whose score cells are sealed, so a live score for today's game on that ledger would reveal
  the same game. Gary chose to keep the behavior and change only the wording (2026-10-22).
- **ADR-0034 and ADR-0052** already say open surfaces carry no seal. This ADR is the
  restatement agents should cite.
- **Any other ADR** that says a score on an open surface must be sealed, hidden or warned about
  describes a decision this ADR retires. It stays as a record of why the code looked the way it
  did.

## Consequences

- A new page outside the four surfaces opens live. Do not add a `SealBox` or a spoiler warning
  to it.
- `cutoff-gated` stays as a manifest class name. For 27 of its 28 modules it is a correctness
  rule for a dated view, not a spoiler gate. The class text says so.
- The `as-of` date picker (`AsOfBanner`) is a time-travel control for open pages, not a seal.
- Remaining work on #2523: narrow the spoiler wording in code comments (layer 3), tests that
  pin removed behavior (layer 4), and the README (layer 6).
