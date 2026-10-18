// WHICH AT-BATS GET A STAMP, as a pure function of the one entry the reader has
// just stepped to (focus mode, ADR-0046's footing).
//
// It reads fields the card already carries (`eventType`, `rbi`, `outNumber`,
// `basesAfter`) and nothing else. It is called in AtBatCard, where `stepCap`
// has already cut the feed to what the reader revealed, so it never sees a
// play they have not stepped to. It returns a KIND — a label to print — and
// never a duration: how long a stamp stays is `BIG_PLAY_MS` in beats.js, and
// it only starts after the denotation has inked (useBigPlayBeat.js).
//
// Imports nothing, on purpose, for the same reason beats.js does.

export const BIG_PLAY_LABELS = {
  slam: { label: 'Grand slam', sub: '' },
  homer: { label: 'Home run', sub: '' },
  triple: { label: 'Triple', sub: '' },
  double: { label: 'Double', sub: '' },
  stranded: { label: 'Stranded', sub: 'Bases loaded' },
}

export function bigPlayKind(entry) {
  if (!entry || entry.kind !== 'atbat' || entry.live) return null
  switch (entry.eventType) {
    case 'home_run':
      return entry.rbi >= 4 ? 'slam' : 'homer'
    case 'triple':
      return 'triple'
    case 'double':
      return 'double'
    default:
  }
  // The third out, made by this plate appearance (`codeKind: 'out'`), with all
  // three bases still held: the half ends, they stay. A walk whose runner is
  // thrown out for the third out later carries that `outNumber` too, once the
  // whole half is known, and is not this play.
  if (entry.codeKind === 'out' && entry.outNumber === 3 && Array.isArray(entry.basesAfter) && entry.basesAfter.length === 3) {
    return 'stranded'
  }
  return null
}
