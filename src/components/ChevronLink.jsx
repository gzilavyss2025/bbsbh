// The quiet uppercase "See all ›" text-button, in the one shared shape every
// placement composes: TeamLeaders' own header action, TeamPage's PreviewDoor
// (under a preview card), and NumbersTab's "Org leaders ›". A single control so
// its padding/hit-target only needs tuning once — see .chevron-link in
// index.css. `children` is the label text; the chevron itself is built in.
export function ChevronLink({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`chevron-link${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      {children} ›
    </button>
  )
}
