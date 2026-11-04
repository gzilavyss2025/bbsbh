// Touch-prefetch for a slate game card: warm the HTTP cache for GameView's chunks, once per
// page. <link rel=prefetch> only; no import(), so nothing lands in Vite's preload state or
// the module map, and a failed prefetch fires no vite:preloadError (main.jsx's repair).
// vite.config.js's gameViewPrefetch names the files in a <meta> in index.html (build only).
export const prefetchLinks = (content) =>
  (content ?? '').split(' ').filter(Boolean).map((href) => ({ href, as: href.endsWith('.css') ? 'style' : 'script' }))

let done = false

export function prefetchGameView(doc = document) {
  if (done) return
  const content = doc.querySelector('meta[name="game-view-prefetch"]')?.content
  if (!content) return
  done = true
  for (const { href, as } of prefetchLinks(content)) {
    const link = doc.createElement('link')
    Object.assign(link, { rel: 'prefetch', as, href, crossOrigin: 'anonymous' })
    doc.head.append(link)
  }
}
