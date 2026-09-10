// THE PLATE-APPEARANCE EXPAND — one at-bat opened into its own pitches.
//
// Not a nicety. Under the film gate it is the ONLY way to look again at a play
// that was not read the first time — a 6-4-3 pivot, or a runner going first to
// third — because there is no other route back into a picture that has already
// played.
//
// IT COSTS NOTHING IN BYTES, and that is the point. The pitch DATA is free in
// Tier 1 whether or not the pitch VIDEO was ever staged, so an opened plate
// appearance always has something real to show: the count, the pitch type and
// the velocity, off the same feed the app already holds. Result mode stages
// one clip per plate appearance and this list still fills, which makes Result
// mode a SUPERSET of what the paper sheet's pitch tracker needs rather than a
// lossy summary of it.
//
// SO AN UNSTAGED PITCH MUST NOT READ AS AN ERROR. It is an ordinary row with
// real numbers on it, and it is drawn like one. There is no "missing", no
// warning colour and no empty frame — the pitch happened, its data is here,
// and only its film is not.
//
// AND THE EXPAND IS NOT A SECOND DOOR AROUND THE GATE. It opens a plate
// appearance the scorer has ALREADY reached, never one ahead of the cursor.
// The caller enforces that by only ever passing a card at or behind the
// cursor; nothing here can widen it, because it renders what it is handed.

const CALL_LABEL = {
  B: 'Ball',
  S: 'Strike',
  C: 'Called strike',
  F: 'Foul',
  X: 'In play',
  D: 'Ball in dirt',
  W: 'Swinging strike',
  T: 'Foul tip',
  L: 'Foul bunt',
  M: 'Missed bunt',
  V: 'Automatic ball',
  VB: 'Automatic ball',
  VS: 'Automatic strike',
  Q: 'Swinging strike',
}

function pitchLine(row, index) {
  const detail = row.pitch ?? {}
  const call = CALL_LABEL[detail.callCode] ?? detail.callCode ?? ''
  const count = row.count ?? {}
  return (
    <li key={row.key} className={`xl-pitch xl-pitch--${detail.dot ?? 'other'}`}>
      <span className="xl-pitch__n">{index + 1}</span>
      <span className="xl-pitch__call">{call}</span>
      <span className="xl-pitch__type">{detail.type || '—'}</span>
      <span className="xl-pitch__mph">{detail.mph ? `${Math.round(detail.mph)} mph` : '—'}</span>
      <span className="xl-pitch__count">
        {count.balls == null ? '' : `${count.balls}-${count.strikes}`}
      </span>
    </li>
  )
}

export function PitchExpand({ card, rows = [], onClose }) {
  const pitches = (rows ?? []).filter(
    (row) => row.atBatIndex === card?.atBatIndex && row.kind === 'pitch',
  )
  const name = card?.batter?.last ?? card?.runner?.last ?? ''

  return (
    <div className="xl-expand" role="dialog" aria-modal="true" aria-label={`${name}, pitch by pitch`}>
      <div className="xl-expand__panel">
        <header className="xl-expand__head">
          <h2 className="xl-expand__title">{name}</h2>
          <button type="button" className="xl-expand__close" onClick={onClose}>
            Close
          </button>
        </header>

        {pitches.length ? (
          <ol className="xl-expand__list">{pitches.map(pitchLine)}</ol>
        ) : (
          // No pitches on the card is a real state, not a failure: the
          // extra-innings automatic runner took no plate appearance, and a
          // pitchless intentional walk has none either.
          <p className="xl-expand__none">No pitches were thrown in this plate appearance.</p>
        )}
      </div>
    </div>
  )
}
