// Post-build guard: assert the built service worker still lets /learn through.
//
// THE BUG THIS EXISTS FOR. `navigateFallback: '/index.html'` in vite.config.js
// registers a Workbox NavigationRoute that answers every navigation the worker
// controls with the precached app shell. The guides at /learn are the one part
// of this site the server renders itself (api/page.js, ADR-0053), so for a
// reader with the worker installed that fallback served index.html AT the
// guide's URL — the client router then failed to match '/learn/{slug}', which
// it never matches on purpose (src/lib/route.js), and fell through to the
// slate. The document the server had already written was never requested.
//
// WHY IT NEEDS A GUARD ON THE ARTIFACT rather than a unit test. Nothing else
// that tests this app runs a service worker: `npm run dev` registers none, curl
// and Playwright begin with an empty one, and the AI crawlers these pages were
// written for execute no JavaScript. The failure was invisible to every check
// in this repo and visible to every installed reader. The only honest place to
// assert it is the shipped worker, which is what this reads.
//
// Same shape and same wiring as check-dist-dev-routes.mjs: it needs a build, so
// it runs after `npm run build` in .github/workflows/ci.yml, not inside
// `npm run lint`. Locally: `npm run build && npm run check:sw-learn`.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SW = path.resolve(fileURLToPath(new URL('../dist/sw.js', import.meta.url)))

// Paths that must NOT be handled by the precached shell — they are server-
// rendered documents. And paths that must still BE handled, so a denylist
// written too wide (say /^\//) fails here instead of silently taking the whole
// app offline-first.
const MUST_BYPASS = ['/learn', '/learn/read-a-box-score', '/learn/stats-glossary']
const MUST_FALL_BACK = ['/', '/standings', '/team/158', '/20260817/mil-at-chc/lineups']

let source
try {
  source = await readFile(SW, 'utf8')
} catch {
  console.error('check-sw-learn-fallback: no dist/sw.js — run `npm run build` first.')
  process.exit(1)
}

// Pull the denylist literal out of the generated worker and evaluate it, so
// this checks the REGEXES THAT SHIPPED rather than the presence of a string.
// Workbox emits `new NavigationRoute(handler,{denylist:[…]})`; the array is
// regex literals and commas only, which is why evaluating it is safe here.
const match = source.match(/denylist:\s*(\[[^\]]*\])/)
if (!match) {
  console.error(
    'check-sw-learn-fallback: the built worker registers its navigation fallback\n' +
      'with no denylist, so every navigation — including the server-rendered guides\n' +
      'at /learn — is answered from the precached app shell.\n\n' +
      "Restore `navigateFallbackDenylist` in vite.config.js's workbox block.",
  )
  process.exit(1)
}

let denylist
try {
  denylist = new Function(`return ${match[1]}`)()
} catch {
  console.error(`check-sw-learn-fallback: could not read the denylist literal: ${match[1]}`)
  process.exit(1)
}

const bypasses = (url) => denylist.some((pattern) => pattern.test(url))

const unsealed = MUST_BYPASS.filter((url) => !bypasses(url))
if (unsealed.length) {
  console.error(
    'check-sw-learn-fallback: the service worker would serve the app shell for:\n' +
      unsealed.map((u) => `  ${u}`).join('\n') +
      '\n\nThese are server-rendered guides, not React routes. A reader with the PWA\n' +
      'installed would land on the slate with the guide URL still in the address bar.\n' +
      'See docs/adr/0053 and the note beside navigateFallbackDenylist in vite.config.js.',
  )
  process.exit(1)
}

const overreach = MUST_FALL_BACK.filter((url) => bypasses(url))
if (overreach.length) {
  console.error(
    'check-sw-learn-fallback: the denylist is too wide — it also excludes:\n' +
      overreach.map((u) => `  ${u}`).join('\n') +
      '\n\nThese are ordinary app routes and MUST keep using the offline app shell.\n' +
      'Narrow the pattern to the /learn prefix.',
  )
  process.exit(1)
}

console.log(
  `check-sw-learn-fallback: ok — ${MUST_BYPASS.length} guide paths bypass the app ` +
    `shell, ${MUST_FALL_BACK.length} app routes still use it.`,
)
