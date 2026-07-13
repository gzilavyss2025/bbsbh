// A row of fixed-size circles standing in for "how many of a capped resource
// are left" — filled for spent, hollow for still available. Shared by the
// mound-visit notification card (PlayByPlay.jsx) and the ABS challenge row
// (StatBox.jsx) so both stay visually identical: the ●/○ Unicode glyphs this
// replaces aren't drawn at the same optical size in any font (a filled dot
// reads smaller than a hollow ring at an identical font-size), so two
// independent glyph-based copies could never actually match, and a shared
// component means they can't drift apart either.
export function UsagePips({ allowed, used, label }) {
  return (
    <span className="usagepips" aria-label={label}>
      {Array.from({ length: allowed }, (_, i) => (
        <span
          key={i}
          className={`usagepips__pip ${i < used ? 'usagepips__pip--used' : 'usagepips__pip--open'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
