// ONE ENTRY ON THE DESIGN LAB: a heading, the specimen itself, and a caption
// saying where the thing lives and what the inventory proposes for it.
//
// THE LAB INVENTS NO GEOMETRY. Every specimen below is the real component or
// the real class name. The only CSS this page owns is the frame AROUND an
// entry — the grid, the heading, the caption. That rule is the whole point: a
// catalog that draws its own card has added a 33rd card, which is the exact
// problem #1112 exists to measure. If an entry looks wrong here, that is a
// finding for `.scratch/design-system/inventory.md`, not something to patch
// with a lab-only override.

export function Entry({ title, path, consumers, verdict, tone = '', note, wide = false, children }) {
  return (
    <section className={`dlab__entry${wide ? ' dlab__entry--wide' : ''}`}>
      <div className="dlab__entryhead">
        <h3 className="dlab__entrytitle">{title}</h3>
        {verdict && <span className={`dlab__verdict${tone ? ` dlab__verdict--${tone}` : ''}`}>{verdict}</span>}
      </div>
      {/* The specimen sits on the app canvas, not on a lab surface, so a card
          that sets --surface-card reads against the ground it really lands on. */}
      <div className="dlab__stage">{children}</div>
      {(path || consumers !== undefined) && (
        <p className="dlab__path">
          {path}
          {consumers !== undefined && (
            <span className="dlab__count">
              {consumers === 0 ? 'no consumers' : consumers === 1 ? '1 module' : `${consumers} modules`}
            </span>
          )}
        </p>
      )}
      {note && <p className="dlab__note">{note}</p>}
    </section>
  )
}

// A titled band of the page. `lede` carries the finding the band exists to
// show — the page is a catalog, and a catalog with no argument is a list.
export function Band({ id, title, lede, children }) {
  return (
    <section className="dlab__band" id={id}>
      <h2 className="dlab__bandtitle">{title}</h2>
      {lede && <p className="dlab__lede">{lede}</p>}
      {children}
    </section>
  )
}

// A group inside a band — the five verdict groups, and the token files.
export function Group({ title, lede, children, grid = true }) {
  return (
    <section className="dlab__group">
      <h3 className="dlab__grouptitle">{title}</h3>
      {lede && <p className="dlab__lede dlab__lede--tight">{lede}</p>}
      <div className={grid ? 'dlab__grid' : 'dlab__rows'}>{children}</div>
    </section>
  )
}
