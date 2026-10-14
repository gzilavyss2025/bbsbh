// The hidden new lineup page (docs/lineup-redesign.md): `?look=new` on a lineup route.
// Removed in the swap PR.
export const isLookNew = (search = typeof window === 'undefined' ? '' : window.location.search) =>
  new URLSearchParams(search).get('look') === 'new'

// The query to keep when a link moves between game sections.
export const lookSuffix = (search) => (isLookNew(search) ? '?look=new' : '')
