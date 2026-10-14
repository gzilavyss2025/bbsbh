// The hidden new lineup page (docs/lineup-redesign.md): `?look=new` on a lineup route.
// Removed in the swap PR.
const params = (search) => new URLSearchParams(search)
export const isLookNew = (search = typeof window === 'undefined' ? '' : window.location.search) =>
  params(search).get('look') === 'new'

// The query to keep when a link moves to another game section. The flag only means something on
// the two lineup pages, so it rides along only there. `nointro` (the first-visit welcome modal's
// off switch, which test URLs carry) is kept on every section.
export function lookSuffix(search, section) {
  const from = params(search)
  const keep = new URLSearchParams()
  if (from.get('look') === 'new' && (section === 'lineup1' || section === 'lineup2')) keep.set('look', 'new')
  if (from.has('nointro')) keep.set('nointro', from.get('nointro'))
  const q = keep.toString()
  return q ? `?${q}` : ''
}
