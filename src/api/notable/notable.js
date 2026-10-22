// The box score's feat label: no-hitters, cycles and triple plays, from the three
// public/data/notable/ files (scripts/gen-notable.mjs; the row keys are ALLOWED_KEYS in
// scripts/lib/notable/merge.mjs).
//
// REVEAL-ONLY (ADR-0101). A feat names the result: "No-hitter" says one club had no
// hits. Two readers sit inside a seal: screens/boxscore/FeatLabel.jsx mounts inside the box
// score's SealBox reveal render, and hooks/callouts/useLastTime.js feeds the revealed play card
// and the Final roll-up, so these files are fetched only after the reveal. A missing file
// degrades to no line.
//
// The open reader is the shelf (#2508): screens/notable/NotablePage.jsx (/notable) through
// lib/notable/shelf.js, an open results page behind a labelled door (ADR-0081). It sits outside
// any seal on purpose (ADR-0101, section 4), so it lists only games whose box score opens by
// date (boxScoreOpensByDate, ADR-0117), and test/notable-shelf.test.js checks that over the
// committed files.

import { staticJson } from '../staticJson.js'

export const KINDS = ['nohitters', 'cycles', 'tripleplays']
const loaders = KINDS.map((kind) => staticJson(`/data/notable/${kind}.json`))

// All three docs, keyed by kind. A file that fails to load is null.
export async function fetchNotable() {
  const docs = await Promise.all(loaders.map((load) => load()))
  return Object.fromEntries(KINDS.map((kind, i) => [kind, docs[i]]))
}

// The generator writes '' for a name the feed left out, so a line may carry none.
const line = (feat, names) => (names ? `${feat}: ${names}` : feat)

function noHitterLine(row) {
  const pitchers = row.pitchers ?? []
  const marks = [row.shortened && 'shortened', row.lost && 'lost'].filter(Boolean)
  const feat = `${pitchers.length > 1 ? 'Combined no-hitter' : 'No-hitter'}${marks.length ? ` (${marks.join(', ')})` : ''}`
  return line(feat, pitchers.map((p) => p.name).filter(Boolean).join(', '))
}

const LINE = {
  nohitters: noHitterLine,
  cycles: (row) => line('Cycle', row.player?.name),
  tripleplays: (row) => line('Triple play', row[row.side]?.name),
}

// The label line for one row of one kind.
export const featLine = (kind, row) => LINE[kind](row)

// The label lines for one game, no-hitters first. Empty for a game with no feat.
export function featsForGame(docs, gamePk) {
  return KINDS.flatMap((kind) => (docs?.[kind]?.rows ?? []).filter((row) => row.gamePk === gamePk).map((row) => LINE[kind](row)))
}
