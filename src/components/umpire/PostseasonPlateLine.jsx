import { postseasonPlateLine } from './postseasonPlateLine.js'

// A plain reference line, in the .hint voice. Renders nothing for an umpire
// with no postseason plate games.
export function PostseasonPlateLine({ post, className = '' }) {
  const line = postseasonPlateLine(post)
  if (!line) return null
  return <p className={`hint ${className}`}>{line.text}</p>
}
