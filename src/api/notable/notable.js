// The box score's feat label: no-hitters, cycles and triple plays, from the three
// public/data/notable/ files (scripts/gen-notable.mjs; the row keys are ALLOWED_KEYS in
// scripts/lib/notable/merge.mjs).
//
// REVEAL-ONLY (ADR-0101). A feat names the result: "No-hitter" says one club had no
// hits. So the one importer, screens/boxscore/FeatLabel.jsx, mounts inside the box
// score's SealBox reveal render, and these files are fetched only after the reveal.
// A missing file degrades to no line.

import { staticJson } from '../staticJson.js'

const KINDS = ['nohitters', 'cycles', 'tripleplays']
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

// The label lines for one game, no-hitters first. Empty for a game with no feat.
export function featsForGame(docs, gamePk) {
  return KINDS.flatMap((kind) => (docs?.[kind]?.rows ?? []).filter((row) => row.gamePk === gamePk).map(LINE[kind]))
}
