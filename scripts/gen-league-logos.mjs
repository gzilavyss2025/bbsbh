// Regenerates public/data/logos/league/{mlb,milb}.svg — the ONE-COLOR knockout
// versions of the two LEAGUE marks, for the Game Log book covers that carry a
// league mark instead of a club crest (src/components/passport/BookCoverPicker.jsx).
//
// Deliberately NOT a loop inside gen-mono-logos.mjs. That script rewrites
// public/data/logos/mono/ from scratch on every full run and prunes any file
// not keyed by a numeric team id, so a league mark dropped in there would be
// deleted by the next nightly run. These two get their own output directory,
// and this script only ever touches that directory.
//
// Same build-time-fetch reasoning as its sibling (src/api/CLAUDE.md): the
// conversion runs once here, the app points an <image>/mask at plain
// same-origin art, and no remote SVG markup is ever injected into the DOM.
// Unlike the club marks these two are TINY (a few KB together) and every cover
// picker shows both, so they stay in the app-shell precache
// (vite.config.js's globPatterns already sweeps `**/*.svg`) rather than being
// globIgnored and runtime-cached. Workbox revisions a precached URL itself,
// which is why there is no `?v=` content hash here — the manifest below
// carries only the marks' geometry.
//
//   node scripts/gen-league-logos.mjs
//
// Run it by hand. Unlike a club's mark, a league mark changes about once a
// decade, so there is no cron behind this.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { monoLogoSvg } from '../src/lib/logoMono.js'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'logos', 'league')
const manifestPath = join(here, '..', 'src', 'lib', 'data', 'league-logo-manifest.json')

// mlbstatic's own league art, on-dark (i.e. already drawn as a light mark), the
// same CDN the club logos come from. `1` is MLB's sportId, matching how every
// other id in this app names a league.
const MARKS = [
  { key: 'mlb', url: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg' },
  { key: 'milb', url: 'https://www.mlbstatic.com/team-logos/league-on-dark/milb.svg' },
]

// The two marks are very different shapes — MLB is a near-square 128x72 badge,
// MiLB a wide 301x63 wordmark — so the cover cannot letterbox both into one
// square slot the way it does a club crest. The viewBox is recorded here, at
// build time, and the crest slot sizes itself from it.
function viewBoxOf(svg) {
  return svg.match(/viewBox="([^"]+)"/)?.[1] ?? null
}

const manifest = {}
for (const { key, url } of MARKS) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status} from ${url}`)
  const mono = monoLogoSvg(await res.text(), { maskId: `ink-league-${key}` })
  if (!mono) throw new Error(`${key}: art did not convert to a knockout mark`)
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, `${key}.svg`), mono)
  manifest[key] = { viewBox: viewBoxOf(mono) }
  console.log(`wrote ${key}.svg (${mono.length} chars, viewBox ${manifest[key].viewBox})`)
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`wrote ${manifestPath}`)
