// A generated sentence on the Scout (#1490): a list of parts, each a string or
// { strong } for a figure set in bold (edge.js `textOf` reads the same list).
export function Rich({ parts }) {
  return parts.map((p, i) => (typeof p === 'string' ? p : <strong key={i}>{p.strong}</strong>))
}
