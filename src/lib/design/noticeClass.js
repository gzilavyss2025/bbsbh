// THE NOTICE'S CLASS LIST (#1132) — the one place a tone and a size turn into
// class names, and the one place that says which optional parts render. Shared
// by components/ui/state/Notice.jsx, by a caller that owns its root (the pitcher
// cards and one <button>, from slice N6: noticeClass), and by the tests. Pure, so
// node --test can pin it, the way emptyStateClass.js pins the empty state.
//
// TONES are roles, never colours (spec.md section 4): info (a neutral fact about
// the page or the game), event (something changed in the game), caution (heed
// this) and error (a fetch or an action failed). No tone reads --seal (ADR-0083)
// and none wears a club colour (ADR-0030).
// SIZES. block is the full padding. compact is for a line inside a card or a row.
// An unknown tone or size is a caller's typo, and it throws.
//
// PARTS. The text (children) always renders. The label, the icon and the action
// render only when the caller gives one: null, undefined, false and '' are "not
// given", so a `cond && 'Why'` label draws no empty line.
//
// ROLE. The error tone defaults to role="alert": it replaces content after a
// fetch fails, so a reader's tool should say it at once (spec.md section 8). Any
// other tone sets none. A caller's own role wins (Notice.jsx).
export const TONES = ['info', 'event', 'caution', 'error']
export const SIZES = ['block', 'compact']

const given = (v) => v != null && v !== false && v !== ''

export function noticeClass({ tone = 'info', size = 'block', className = '' } = {}) {
  if (!TONES.includes(tone)) throw new Error(`Notice: unknown tone "${tone}" (${TONES.join(', ')})`)
  if (!SIZES.includes(size)) throw new Error(`Notice: unknown size "${size}" (${SIZES.join(', ')})`)
  return ['notice', `notice--${tone}`, `notice--${size}`, className].filter(Boolean).join(' ')
}

export function noticeParts({ tone, size, className, label, icon, action } = {}) {
  const root = noticeClass({ tone, size, className })
  return {
    root,
    role: tone === 'error' ? 'alert' : undefined,
    label: given(label),
    icon: given(icon),
    action: given(action),
  }
}
