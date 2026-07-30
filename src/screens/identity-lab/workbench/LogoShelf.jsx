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
// navigation for "I want to work on whatever uses THAT mark."
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
            className="idlab__shelfitem"
            onClick={() => onSelect(mark)}
            title={`Work on the jersey that wears ${mark.label}`}
          >
            <span className="idlab__shelfthumb">
              <MarkImage url={mark.url} alt="" />
            </span>
            <span className="idlab__shelflabel">{mark.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
