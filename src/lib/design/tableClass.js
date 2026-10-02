// THE TABLE'S CLASS LIST (#1132) — the one place a frame, a density and the
// sticky flag turn into class names, shared by components/ui/table/Table.jsx
// and its tests. Pure, so node --test can pin it, the way cardClass.js pins the
// card.
//
// FRAMES. sheet draws the box on the wrap; bare draws none, for a table inside
// a Card that already draws it.
// DENSITIES. row is the standard cell (6 by 8); tight is the box score's (4 by 2);
// keep pads nothing, for a table whose namespace sets its own cells (a drawn mark,
// a rank track).
// An unknown frame or density is a caller's typo, and it throws.
//
// LABEL. Names the scroll region and makes it a Tab stop, so a keyboard can
// scroll a wide table (WCAG 2.1.1). Without one the wrap is a plain div.
export const FRAMES = ['sheet', 'bare']
export const DENSITIES = ['row', 'tight', 'keep']

export function tableParts({ frame = 'sheet', density = 'row', sticky = false, label, className = '' } = {}) {
  if (!FRAMES.includes(frame)) throw new Error(`Table: unknown frame "${frame}" (${FRAMES.join(', ')})`)
  if (!DENSITIES.includes(density)) throw new Error(`Table: unknown density "${density}" (${DENSITIES.join(', ')})`)
  return {
    wrap: ['table', `table--${frame}`, `table--${density}`, sticky && 'table--sticky'].filter(Boolean).join(' '),
    grid: ['table__grid', className].filter(Boolean).join(' '),
    region: label ? { role: 'region', tabIndex: 0, 'aria-label': label } : undefined,
  }
}
