# Video highlights on revealed plays

## Problem

`InningViewer`'s play-by-play cards (`PlayByPlay.jsx` / `AtBatCard`) show the
scorebook account of a play once its half is revealed, but there's no way to
watch it. MLB Stats API's undocumented `content` endpoint carries highlight
clips joined to plays by a shared GUID (`playEvents[].playId` in `feed/live`
== `guid` in `content`'s `highlights.highlights.items[]`) — see the research
note this PRD is based on (verified live 2026-07-12 against gamePk 823357,
Brewers @ Pirates).

## Why this is spoiler-shaped, not just a data-fetch

A clip's `title`/`headline`/`description` narrate the outcome by construction
("Jake Bauers' two-run home run"). That's the same risk class the app already
treats as reveal-only (root `CLAUDE.md`'s spoiler rule, ADR-0001) — this
isn't a bonus-content feature bolted on top, it's another score-revealing
data source that must thread through the exact same seal.

## Decision: bottom sheet presentation

Considered a modal, an inline per-play accordion, a bottom sheet, and a
deferred "highlights rail." **Chose the bottom sheet**: tapping "▶ Watch
highlight" on a revealed play slides up an iOS-style sheet (partial height,
swipe-down to dismiss) with the embedded video, keeping the play-by-play
dimmed but present behind it. Matches this app's phone-first / installable-
PWA identity better than a full-screen modal, and avoids the accordion's
"multiple players open on one page" problem.

## Non-goals for v1

- No offline/precached video — always a live fetch on tap.
- No autoplay, no thumbnail/poster preview before tap (a poster frame is
  itself spoiler-shaped — see the issue for detail).
- No highlight rail / recap view — this is strictly a per-play affordance.
- No non-iPhone-Safari video-compat work (no `hls.js`) — native `<video>`
  playing the `.m3u8` source is enough for this app's stated target device;
  revisit only if desktop/Android usage turns out to matter.

## Implementation

See `issues/01-highlights-bottom-sheet.md` for the full technical plan
(data layer, spoiler gating, component wiring, styling, verification).

## Open questions for the maintainer

- Confirm the bottom-sheet call over the other three options (recorded above
  for the record, but worth a final gut check before implementation starts).
- OK with "no clip found → button doesn't render" as the only empty state
  (no "highlight coming soon" placeholder)?
