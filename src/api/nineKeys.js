// Nine Keys report's data — every World Series champion since 2000 ranked
// against nine measures, the clubs currently holding a postseason place
// ranked the same way, and the figures that say how well the rule holds.
// Read from a static same-origin file (public/data/nine-keys.json) rather
// than computed live.
//
// scripts/gen-nine-keys.mjs builds it. The champion half is immutable once a
// season ends; the current-season half moves with the standings, so the file
// is regenerated alongside the other nightly data rather than by hand.
//
// NO SPOILER SURFACE HERE. Every number is a season-long rank or a finished
// season's result — the same footing as Standings, League Leaders and
// Postseason History, which all open live (see CLAUDE.md's scope note). It
// reads no live game and carries no per-game score, so it needs no cutoff
// and no SealBox.
//
// Degrades to an empty report before the file exists or on any failure — the
// page then says it has nothing to show rather than breaking.

import { staticJson } from './staticJson.js'

export const loadNineKeys = staticJson('/data/nine-keys.json', {
  shape: (d) => ({
    generatedAt: d.generatedAt ?? null,
    bar: d.bar ?? 15,
    limit: d.limit ?? 3,
    keys: d.keys ?? [],
    distribution: d.distribution ?? {},
    champions: d.champions ?? [],
    current: d.current ?? null,
    thresholds: d.thresholds ?? [],
    ladder: d.ladder ?? [],
    leaveOneOut: d.leaveOneOut ?? null,
    placebo: d.placebo ?? null,
  }),
  fallback: {
    generatedAt: null,
    bar: 15,
    limit: 3,
    keys: [],
    distribution: {},
    champions: [],
    current: null,
    thresholds: [],
    ladder: [],
    leaveOneOut: null,
    placebo: null,
  },
})
