# Home explorers share parts and one data recipe, and show results openly

**Status:** Accepted (Gary, 2026-11-17).
**Date:** 2026-11-17

## Context

The offseason home page now carries two "explorer" cards: Longest At-Bats (#1078, rebuilt as
v2 in #3183) and Wild Rides (#3182). Gary plans a steady series of five or more. Building the
second one taught a set of lessons the first had already paid for once:

- The first Wild Rides draft loaded **11.3 MB** of JSON on page open. The shipped version
  loads about **40 KB**, and nothing it shows was lost.
- Both cards wanted the same pieces: tabs with a line of meaning, a big number with a
  writer's label, a scrolling picker list, Gameday's scorebug, a club-coloured plate, a
  ride you can scrub, and the same baseball copy rules.
- Copy written from statistics read like a machine ("907 points of swing"). A beat writer's
  terms (runs down, leads blown, lead changes, the inning) read like baseball.

## Decision

1. **Shared parts, free layout.** The parts live in `src/components/explorers/` (UI) and
   `src/lib/explorers/` (pure). Each explorer arranges them its own way; there is no single
   card template. Today: `ExplorerTabs` and `lib/explorers/copy.js`.
2. **One data recipe.** A nightly generator reads each Final game once (incremental scan,
   the shared statsapi client, `season-in-play.mjs`) and keeps a small summary per game. It
   writes a **tiny index** the card opens with, and anything heavier loads only on demand:
   a search file when its tab opens, and a single game's detail read client-direct from
   statsapi with a trimmed `fields=` list. No per-game files are committed.
3. **Results show openly.** An explorer is an open season page, not one of the four scoring
   surfaces (root `CLAUDE.md`), so it may show final scores and headlines any time, in or
   out of season. Its data module is classified in `src/api/spoiler-manifest.json`.
4. **Tabs carry a line of meaning.** An explorer's tabs show a one-line description under
   each name. This is a second exception to `src/styles/CLAUDE.md`'s "cut secondary labels",
   beside the site menu's page descriptions.

## Consequences

- A new explorer starts from `docs/explorers.md` and these parts, and is built live with
  Gary (no skill, no cloud run).
- A third explorer is the test of these boundaries: pull more parts out (the picker list,
  the plate, the ride's scrub strip) only when a third card wants them too.
- Placement of many explorers on the home page is undecided; settle it when the page needs it.
