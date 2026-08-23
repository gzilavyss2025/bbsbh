import { useNav } from '../../lib/nav.js'

// A plain, spoiler-safe link to a game's (sealed) box score — used by the
// player page's game log rows, its MLB-debut fact, and the vs-team split
// rows. Mirrors PlayerLink/TeamLink: no underline at rest, renders plain
// children when no path could be resolved.
export function GameLink({ path, className = '', children }) {
  const navigate = useNav()
  if (!path) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      onClick={() => navigate(path)}
    >
      {children}
    </button>
  )
}
