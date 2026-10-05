// THE EMPTY STATE'S CLASS LIST (#1132) — the one place a size turns into class
// names, and the one place that says which optional parts render. Shared by
// components/ui/state/EmptyState.jsx and its tests. Pure, so node --test can
// pin it, the way tableClass.js pins the table.
//
// SIZES. block is the full inset (--space-4): an empty card body or a page
// section. compact is the small one (--space-2 by --space-3): an empty tile,
// chart slot or short card row (#1132 decisions Q3).
// An unknown size is a caller's typo, and it throws.
//
// PARTS. The text (children) always renders. The label, the note and the
// action render only when the caller gives one: null, undefined, false and ''
// are "not given", so a `cond && 'Why'` note draws no empty line.
export const SIZES = ['block', 'compact']

const given = (v) => v != null && v !== false && v !== ''

export function emptyStateParts({ size = 'block', className = '', label, note, action } = {}) {
  if (!SIZES.includes(size)) throw new Error(`EmptyState: unknown size "${size}" (${SIZES.join(', ')})`)
  return {
    root: ['emptystate', `emptystate--${size}`, className].filter(Boolean).join(' '),
    label: given(label),
    note: given(note),
    action: given(action),
  }
}
