// The at-bat trail: every step already revealed this half, as a row of small
// chips (batter last name + result code, or a short tag for a notice step —
// see PlayByPlay.jsx's noticeLabel), replacing the old bare Back/Next pager.
// Tapping a chip reviews that step WITHOUT losing the live cursor —
// useFocusMode's `step` is the same cursor a chip jump uses (`goToStep`), so
// "Back to the live at-bat" is just `followLatest`, not a second mode.
//
// `items` is a plain array built by PlayByPlay from entries already ≤
// effectiveCap (see its own header comment) — this component only lays it
// out, same discipline as FocusControls/RollingLine/Scorebug.
export function AtBatTrail({ items, cursor, following, onSelect, onFollowLatest, turning }) {
  if (items.length <= 1) return null
  return (
    <div className="trailstrip">
      <div className="trailstrip__chips" role="tablist" aria-label="At-bats this half">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`trailchip trailchip--${item.kind || 'note'}`}
            role="tab"
            aria-selected={i === cursor}
            aria-current={i === cursor}
            aria-disabled={turning || undefined}
            onClick={() => onSelect(i)}
          >
            <span className="trailchip__name">{item.name}</span>
            {item.code && <span className="trailchip__code">{item.code}</span>}
          </button>
        ))}
      </div>
      {!following && (
        <button
          type="button"
          className="trailstrip__followbtn"
          aria-disabled={turning || undefined}
          onClick={onFollowLatest}
        >
          Back to the live at-bat
        </button>
      )}
    </div>
  )
}
