import { test as base, expect } from '@playwright/test'

// Shared test fixture. Every `page.goto()` automatically carries `?nointro` —
// the query flag that suppresses the first-visit welcome modal (see
// GameSelect.jsx `welcomeSuppressed`). On a fresh/cleared localStorage that
// modal pops on the slate (`/`, `/{MMDDYYYY}`), covers the screen, and steals
// focus, so a test that lands there without the flag flakes on an overlay it
// never asked for. Appending it everywhere is harmless: query strings don't
// affect routing (route.js parses the pathname only), so game/team/umpire/etc.
// routes are unchanged.
//
// ALWAYS import `test`/`expect` from this file, never from '@playwright/test'
// directly, so no spec can forget the flag. `page.reload()` re-requests the
// same `?nointro` URL, so it's covered too.
export const test = base.extend({
  page: async ({ page }, use) => {
    const origGoto = page.goto.bind(page)
    page.goto = (url, opts) => origGoto(withNoIntro(url), opts)
    await use(page)
  },
})

export { expect }

// Append `?nointro` without clobbering an existing query string or hash, and
// without doubling up if the caller already opted out. Handles absolute URLs,
// root-relative paths, and bare paths alike.
export function withNoIntro(url) {
  if (typeof url !== 'string') return url
  if (/[?&]nointro\b/.test(url)) return url
  const hashAt = url.indexOf('#')
  const hash = hashAt === -1 ? '' : url.slice(hashAt)
  const path = hashAt === -1 ? url : url.slice(0, hashAt)
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}nointro${hash}`
}
