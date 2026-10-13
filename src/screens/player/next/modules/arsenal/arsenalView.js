import { commandPitchMarks } from '../../../../../api/commandMap.js'
import { arsenalLevelOf, pitchArsenalFor, physOf } from '../../../../../api/pitchArsenal.js'
import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'
import { flightPath, markFeet } from './flightView.js'

// The Pitch arsenal rows (#1892): one per pitch type, most thrown first. The mix, speed and physics are the
// season store's (pitchArsenal.js); whiff % and the landing mark are the command grid's (commandPitchMarks);
// xwOBA is Savant's, handed in as `xwoba(code)`. Completed-game season aggregates: open surface (ADR-0034).
// Every figure a file does not hold is null, never 0, and a row with no physics stays in the list with no path.
// -> null | rows
export function arsenalView({ shard, command, id, xwoba = () => null }) {
  const mlb = arsenalLevelOf(shard, id)
  const types = mlb == null ? null : pitchArsenalFor(shard, id, mlb)
  if (!types) return null
  const marks = new Map(commandPitchMarks(command, { level: mlb ? 'mlb' : 'aaa' }).map((m) => [m.code, m]))
  return types.map((t) => {
    const phys = physOf(t)
    const m = marks.get(t.code)
    const landing = markFeet(m?.mark)
    return {
      code: t.code,
      mark: pitchMark(t.code),
      pitches: t.pitches,
      pct: t.pct,
      velo: t.avgVelo ?? null,
      spin: phys.spinRate,
      flight: phys.plateTime,
      whiffPct: m?.whiffPct ?? null,
      // Savant's board is MLB only: an arm shown at Triple-A has no figure of his own there.
      xwoba: mlb ? xwoba(t.code) : null,
      landing,
      path: flightPath(phys, landing),
    }
  })
}
