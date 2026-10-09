// Which way a label hangs off its mark, so a label near either end stays inside the sheet.
const side = (at) => (at < 25 ? 'start' : at > 75 ? 'end' : 'mid')

// The "path to the majors" meter for a minor leaguer (#1703): the scale runs 20 to 99, the
// fill ends at his OVR, a bar marks POT (none off the Top 100) and a line marks the cap of his
// level. OVR and POT are labelled above the track and the cap below it, so the two labels
// that can sit close (cap and POT) never share a row. `minor` is ovrView's. Draw-only.
export function OvrPath({ minor: { marks, levelLabel, pot } }) {
  const { cap } = marks
  return (
    <div className="ovrpath">
      <div className="ovrpath__labels" aria-hidden="true">
        <span className={`ovrpath__lab--${side(marks.ovr)}`} style={{ left: `${marks.ovr}%` }}>OVR</span>
        {marks.pot != null && <span className={`ovrpath__lab--${side(marks.pot)}`} style={{ left: `${marks.pot}%` }}>POT {pot}</span>}
      </div>
      <div className="ovrpath__track" aria-hidden="true">
        <span className="ovrpath__now" style={{ width: `${marks.ovr}%` }} />
        {cap && <span className="ovrpath__cap" style={{ left: `${cap.at}%` }} />}
        {marks.pot != null && <span className="ovrpath__pot" style={{ left: `${marks.pot}%` }} />}
      </div>
      <div className="ovrpath__labels" aria-hidden="true">
        {cap && <span className={`ovrpath__lab--${side(cap.at)}`} style={{ left: `${cap.at}%` }}>{levelLabel} cap {cap.value}</span>}
      </div>
      <p className="sr-only">
        {cap ? `${levelLabel} cap ${cap.value}. ` : ''}
        {pot != null ? `POT ${pot}.` : 'Not on the Top 100, so no POT.'}
      </p>
    </div>
  )
}
