// The scorebug's live snapshot, as pure functions so `npm test` pins them
// (test/live-state.test.js). HalfInning.jsx builds the snapshot and InningViewer
// holds it; neither owns the rules below.

// Value-equality check for the snapshot — `entries` is rebuilt fresh every render
// in PlayByPlay.jsx, so a composite object arrives with a new identity every
// render even when nothing in it actually changed; comparing every leaf field is
// what lets the setState call that reports it become a true no-op on an
// unchanged snapshot instead of triggering another render (and another report)
// forever. `over` is one of those leaves: dropping it would leave the dimmed
// half-end state stuck on whatever the last report said.
export function sameLiveState(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.inning === b.inning &&
    a.half === b.half &&
    a.outs === b.outs &&
    a.over === b.over &&
    a.bases?.first === b.bases?.first &&
    a.bases?.second === b.bases?.second &&
    a.bases?.third === b.bases?.third &&
    a.batter?.order === b.batter?.order &&
    a.batter?.last === b.batter?.last &&
    a.batter?.line === b.batter?.line &&
    a.pitcher?.last === b.pitcher?.last &&
    a.pitcher?.pitches === b.pitcher?.pitches
  )
}

// The snapshot once the half's 3rd out is revealed and the reader has not
// navigated on. Bases and outs clear and the indicator points at what comes
// next. The name bars KEEP the half's last batter and pitcher (`over`), so the
// band holds its height instead of collapsing to its strip; both are already
// revealed, as this is only reached once the reveal mark reaches the 3rd out.
export function liveAtThirdOut({ batter, pitcher, inning, half }) {
  return {
    bases: { first: false, second: false, third: false },
    outs: 0,
    batter,
    pitcher,
    over: true,
    inning: half === 'top' ? inning : inning + 1,
    half: half === 'top' ? 'bottom' : 'top',
  }
}
