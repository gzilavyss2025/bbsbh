import { MarkImage } from './MarkImage.jsx'

// The club's jerseys hanging on a rod — one tag per jersey, all of them visible
// at once, exactly one of them on the bench below. This is what replaced five
// full-height stacked tiles: every treatment a club actually has stays in view
// (including the ones with no art procured yet, which is a gap worth seeing),
// and switching between them costs a click instead of a scroll.
//
// `barSlot` paints the tick across a chip's top edge with the header bar that
// jersey wears, so the "two bars govern five jerseys" fact is legible from the
// rack itself and not only from the panel above. A bar with nothing set yet
// gets a dashed tick rather than a painted one — the same blank-means-unset
// rule the header fields follow.
export function JerseyRack({ items, selectedKey, onSelect, highlightSlot }) {
  return (
    <div className="idlab__rack" role="tablist" aria-label="Jerseys">
      {items.map((item) => {
        const selected = item.key === selectedKey
        const classes = [
          'idlab__chip',
          selected ? 'idlab__chip--on' : '',
          highlightSlot && item.barSlot === highlightSlot ? 'idlab__chip--lit' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={classes}
            onClick={() => onSelect(item.key)}
            title={item.label}
          >
            <span
              className={`idlab__chiptick${item.barColor ? '' : ' idlab__chiptick--unset'}`}
              style={item.barColor ? { background: item.barColor } : undefined}
              aria-hidden="true"
            />
            <span className="idlab__chiphole" aria-hidden="true" />
            {item.hasDraft && <span className="idlab__dot" aria-hidden="true" />}
            <span className="idlab__chipmark">
              <span className={item.visual.className} style={item.visual.style}>
                <MarkImage url={item.visual.url} alt="" />
              </span>
            </span>
            <span className="idlab__chiplabel">{item.shortLabel}</span>
            {item.subLabel && <span className="idlab__chipsub">{item.subLabel}</span>}
          </button>
        )
      })}
    </div>
  )
}
