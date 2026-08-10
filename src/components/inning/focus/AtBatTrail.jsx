// The at-bat trail: every step already revealed this half, drawn as the row of
// scorecard cells you have already filled in — because that is literally what
// it is. Tapping a cell reviews that step WITHOUT losing the live cursor —
// useFocusMode's `step` is the same cursor a jump uses (`goToStep`), so "Back
// to the live at-bat" is just `followLatest`, not a second mode.
//
// WRAPS, never scrolls (ADR-0043). The first pass made these pills in a
// horizontally scrolling, snap-aligned strip, which put a real scrollbar under
// the hero card and — worse — hid the earliest at-bats of a long inning off the
// left edge, which is the exact complaint the trail exists to answer. A
// 12-batter inning is 2 wrapped rows of fixed 48px cells at phone width and
// costs ~100px; a hidden 13th cell costs the reader the thing they opened the
// trail for. No `overflow-x` here, and none may be added.
//
// The CODE is the recognition key, not the name: a scorer reading back their
// own half looks for the K or the 6-3, the same way they would scanning the
// paper sheet. The name is a 3-letter cue under it, with the full one on the
// accessible label rather than truncated on screen.
//
// `items` is a plain array built by PlayByPlay from entries already ≤
// effectiveCap (see its own header comment) — this component only lays it out,
// same discipline as FocusControls/RollingLine/Scorebug.
export function AtBatTrail({ items, cursor, following, onSelect, onFollowLatest, turning }) {
  if (items.length <= 1) return null
  return (
    <div className="trailstrip">
      <div className="trailstrip__cells" role="tablist" aria-label="At-bats this half">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`trailcell trailcell--${item.kind || 'note'}`}
            role="tab"
            aria-selected={i === cursor}
            aria-current={i === cursor}
            aria-disabled={turning || undefined}
            aria-label={`${item.name}${item.code ? ` — ${item.code}` : ''}`}
            title={`${item.name}${item.code ? ` — ${item.code}` : ''}`}
            onClick={() => onSelect(i)}
          >
            <span className="trailcell__code">{item.code || '···'}</span>
            <span className="trailcell__name" aria-hidden="true">
              {item.name.slice(0, 3)}
            </span>
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
