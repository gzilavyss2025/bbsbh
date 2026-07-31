import { MarkImage } from './MarkImage.jsx'

// Every mark this club has on file, always in view while the club is open —
// the CDN base mark, a hand-recolored Main override, each procured treatment
// PNG, and any separately uploaded WPA-only art. Answers "what have we actually
// got for this club" without opening a single jersey, which used to be a
// collapsed-row-only strip that vanished the moment you started working.
//
// On a two-tone paper checkerboard because these are transparent PNGs and a
// mark's own white edge against a white tile is invisible — this is an
// inspection surface, so transparency has to read as transparency. Hover scales
// a thumbnail in place rather than opening anything.
//
// Clicking a mark selects the jersey that wears it: the shelf doubles as
// navigation for "I want to work on whatever uses THAT mark." A mark saved in
// the Logo art editor but not yet assigned anywhere (`treatment: null`,
// profiles/*.jsx's shelfMarks) has no jersey to open, so its button is inert —
// same "nothing to select" contract those profiles already document.
export function LogoShelf({ marks, onSelect }) {
  if (!marks?.length) return null
  return (
    <section className="idlab__shelf" aria-label="Marks on file">
      <div className="idlab__shelfhead">
        <span className="colorlab__wpapreviewlabel">Marks on file</span>
        <span className="idlab__shelfcount">
          {marks.length} mark{marks.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="idlab__shelfrow">
        {marks.map((mark) => (
          <button
            key={mark.key}
            type="button"
            className={`idlab__shelfitem${mark.wornBy?.length ? ' idlab__shelfitem--worn' : ''}`}
            onClick={() => onSelect(mark)}
            disabled={!mark.treatment}
            title={
              mark.wornBy?.length
                ? `Worn by ${mark.wornBy.join(', ')} — click to work on it`
                : mark.treatment
                  ? `Work on the jersey that wears ${mark.label}`
                  : `${mark.label} isn't assigned to any jersey yet — pick it from a jersey's "saved mark" select below`
            }
          >
            <span className="idlab__shelfthumb">
              <MarkImage url={mark.url} alt="" />
            </span>
            <span className="idlab__shelflabel">{mark.label}</span>
            {/* Only for a saved-mark entry with an assignment — the built-in
                marks (base/treatment art) don't carry `wornBy` at all, since
                which jersey they belong to is already the point of the row. */}
            {mark.wornBy?.length > 0 && (
              <span className="idlab__shelfworn">Worn by {mark.wornBy.join(', ')}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
