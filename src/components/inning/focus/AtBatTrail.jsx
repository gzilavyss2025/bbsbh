// The at-bat trail: every step already revealed this half, drawn as the row of
// scorecard cells you have already filled in — because that is literally what
// it is. WINDOWED (`!stacked`): tapping a cell reviews that step WITHOUT
// losing the live cursor — useFocusMode's `step` is the same cursor a jump
// uses (`goToStep`), so "Back to the live at-bat" is just `followLatest`, not
// a second mode. STACKED (commit 3, decision 4): there is no window to
// switch — every step's card is already on screen — so a tap SCROLLS the
// stage to that card instead (`onSelect` is a different function per state;
// this component just calls it). `aria-current` and "Back to the live
// at-bat" drop while stacked: nothing is "live" once every card is showing.
//
// THE TRAIL ITSELF WRAPS, never scrolls (ADR-0043) — that is about this
// STRIP's own layout, unrelated to and unchanged by the stage-scroll a
// stacked tap now triggers. The first pass made these pills in a
// horizontally scrolling, snap-aligned strip, which put a real scrollbar under
// the hero card and — worse — hid the earliest at-bats of a long inning off the
// left edge, which is the exact complaint the trail exists to answer. Cells
// size to their own content rather than a fixed 48px square, so a long code
// (a double play, a note) and a full last name both fit instead of being
// squeezed toward illegibility — a long inning simply wraps to more rows. No
// `overflow-x` here, and none may be added.
//
// The CODE is the recognition key, not the name: a scorer reading back their
// own half looks for the K or the 6-3, the same way they would scanning the
// paper sheet. The name is a full last-name cue under it — no longer a
// 3-letter clip — with the same full name doubled onto the accessible label.
//
// `items` is a plain array built by PlayByPlay from entries already ≤
// effectiveCap (see its own header comment) — this component only lays it out,
// same discipline as FocusControls/RollingLine/Scorebug.
// NOT a tablist, though it was written as one first. `role="tab"` is a promise
// about structure that this strip does not keep: there is no `role="tabpanel"`
// for a cell to own via `aria-controls` (the thing a cell pages is the at-bat
// card, which is `.pbp`, a plain region shared with everything else on the
// stage), and a real tablist owes arrow-key navigation with a roving tabindex,
// which this never had — every cell sat in the tab order and the arrow keys
// were handled by an unrelated wrapper div. Announcing a widget contract and
// then honouring none of it is worse for a screen-reader user than the honest
// shape: a list of buttons, each naming the at-bat it returns to, with
// `aria-current` marking the one on screen. `aria-current` is also what the
// live cell's own styling keys on, so the markup and the CSS agree.
//
// The arrow keys live on the cell container now (`onKeyDown` here rather than
// on a wrapper in FocusControls), which is the element the keys actually mean
// something on — they fire when any cell has focus, and nowhere else.
export function AtBatTrail({
  items,
  cursor,
  following,
  onSelect,
  onStepBack,
  onStepNext,
  onFollowLatest,
  turning,
  stacked = false,
}) {
  if (items.length <= 1) return null
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      onStepBack()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      onStepNext()
    }
  }
  return (
    <div className="trailstrip">
      <div
        className="trailstrip__cells"
        role="group"
        aria-label="At-bats this half"
        onKeyDown={onKeyDown}
      >
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`trailcell trailcell--${item.kind || 'note'}`}
            aria-current={(!stacked && i === cursor) || undefined}
            aria-disabled={turning || undefined}
            aria-label={`${item.name}${item.code ? ` — ${item.code}` : ''}`}
            title={`${item.name}${item.code ? ` — ${item.code}` : ''}`}
            onClick={() => onSelect(i)}
          >
            <span className="trailcell__code">{item.code || '···'}</span>
            <span className="trailcell__name" aria-hidden="true">
              {item.name}
            </span>
          </button>
        ))}
      </div>
      {!stacked && !following && (
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
