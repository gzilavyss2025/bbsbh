import { HOME } from '../../lib/ballpark/ballparkGeometry.js'
import { round2 } from '../../lib/math/number.js'

// The regulation infield, the same in every park (no source measures one; the geometry builds it from
// constants). BallparkDiagram draws it under one fence, and the World Series Park fit overlay draws it
// once under two, so it lives here. `g` is one park's geometry (layout/parkWindow.js geometryOf), read
// only for the infield fields. Pure and spoiler-free.

// A dirt "skin" fanning out from home past the bases (capped by the 95'-off-the-mound arc), grass cut
// into the middle of it, dirt circles at the mound/home plate, and dirt running lanes on the
// baselines — the classic skinned-infield look, not a plain dirt diamond.
export function InfieldDirt({ g }) {
  return (
    <>
      <path d={g.skin} className="bpdiagram__dirt" />
      <path d={g.grassDiamond} className="bpdiagram__grass" />
      <path
        d={g.baselineDirtL}
        className="bpdiagram__dirt bpdiagram__baseline"
        style={{ strokeWidth: g.baselineDirtW }}
      />
      <path
        d={g.baselineDirtR}
        className="bpdiagram__dirt bpdiagram__baseline"
        style={{ strokeWidth: g.baselineDirtW }}
      />
      <circle className="bpdiagram__dirt" cx={round2(g.mound.x)} cy={round2(g.mound.y)} r={g.moundDirtR} />
      <circle className="bpdiagram__dirt" cx={round2(HOME.x)} cy={round2(HOME.y)} r={g.homeDirtR} />
    </>
  )
}

// Bases + mound + home plate. Drawn after the foul lines, so a bag sits on its line.
export function InfieldBags({ g }) {
  return (
    <>
      {g.bases.map((b, i) => (
        <rect
          key={i}
          className="bpdiagram__base"
          x={round2(b.x - 4)}
          y={round2(b.y - 4)}
          width="8"
          height="8"
          transform={`rotate(45 ${round2(b.x)} ${round2(b.y)})`}
        />
      ))}
      <rect
        className="bpdiagram__base"
        x={round2(g.mound.x - 4)}
        y={round2(g.mound.y - 1.5)}
        width="8"
        height="3"
      />
      <polygon
        className="bpdiagram__base"
        points={`${HOME.x - 5},${HOME.y - 2} ${HOME.x + 5},${HOME.y - 2} ${HOME.x + 5},${HOME.y + 3} ${HOME.x},${HOME.y + 7} ${HOME.x - 5},${HOME.y + 3}`}
      />
    </>
  )
}
