// Regenerates public/data/logos/mono/{teamId}.svg — a ONE-COLOR knockout
// version of every club's mlbstatic mark, for the navy section mastheads on the
// lineup / innings / box score pages (see src/lib/logoMono.js for what
// "knockout" means here and ADR-0031 for why the app precomputes this art
// instead of whitening the CDN mark with a CSS filter at render time).
//
// Precomputed rather than converted in the browser for the same reasons the
// other build-time-fetch data is (src/api/CLAUDE.md): no per-logo round trip on
// a page that already fetches a live feed, no logo popping in after paint, and
// no remote SVG markup injected into the DOM. The output is plain art served
// same-origin, so the app just points an <img> at it.
//
// Reads public/data/teams.json (every active club at each searchable level,
// written by gen-teams.mjs) rather than re-enumerating statsapi, so the two
// files can't cover different team sets. Run it AFTER gen-teams.mjs — that's
// how the structural data block of .github/workflows/update-nightly-data.yml
// wires them (update-teams.yml until 2026-08-28), which is also the cadence
// this needs: a club's mark only changes when it rebrands or a new affiliate
// appears, and until this file exists for a team the app falls back to the
// full-color CDN mark on its own.
//
// Also writes src/lib/data/mono-logo-manifest.json — one content hash per
// club, appended by teams.js as the mono URL's `?v=`. The deployed PWA caches
// these SVGs CacheFirst for up to 30 days (vite.config.js); without a
// version in the URL, a browser that already visited a club would keep
// serving its stale cached mark until that cache entry expired, long after a
// corrected file (from the lab, via mono-ink.json, OR from the team hub's
// identity drawer — a `mono` runtime override, ADR-0054) had shipped.
// Changing the hash changes the URL, so a corrected mark reaches every
// visitor on the very next deploy instead of waiting on expiry.
//
// Pins live in TWO places and this run merges them: the committed
// mono-ink.json file (the lab's Save) and the live `mono` identity override
// (the drawer's Save, fetched from /api/identity) — see
// scripts/lib/mono-logo-art.mjs's readMonoInkStoreWithOverrides. A drawer
// save is therefore not instant; it lands here, on this generator's own
// weekly schedule.
//
//   node scripts/gen-mono-logos.mjs            # every club in teams.json
//   node scripts/gen-mono-logos.mjs --ids=158,498   # spot-check a few
//   node scripts/gen-mono-logos.mjs --sheet    # + a contact sheet to eyeball
//
// --sheet writes .scratch/mono-logos/contact-sheet.html (gitignored): every
// club's original mark beside its knockout, on navy and re-inked through a CSS
// mask. The conversion is a heuristic over art nobody controls, so LOOK at the
// sheet after a run that adds clubs — a mark that converts badly is a
// wrong-looking logo, not a crash. A blank cell means that file failed to
// decode as an image at all, which is the failure mode strict XML parsing
// gives you (see namespaceDecls in logoMono.js).
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logoCdnUrl } from '../src/lib/logoCdn.js'
import { monoLogoFingerprint, monoLogoSvg } from '../src/lib/logoMono.js'
import {
  MONO_LOGO_MANIFEST_PATH,
  monoLogoHash,
  pinsFor,
  readMonoInkStoreWithOverrides,
  sourceVariantFor,
} from './lib/mono-logo-art.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const teamsPath = join(here, '..', 'public', 'data', 'teams.json')
const outDir = join(here, '..', 'public', 'data', 'logos', 'mono')
// Kept OUT of public/ — it's a review artifact, not something to ship in the
// build (and at ~4 MB of inlined art it would dwarf everything else there).
const sheetDir = join(here, '..', '.scratch', 'mono-logos')
const sheetPath = join(sheetDir, 'contact-sheet.html')

const CONCURRENCY = 8

const args = process.argv.slice(2)
const onlyIds = (() => {
  const raw = args.find((a) => a.startsWith('--ids='))?.slice('--ids='.length)
  if (!raw) return null
  return new Set(raw.split(',').map((s) => Number(s.trim())).filter(Boolean))
})()
const wantSheet = args.includes('--sheet')

async function mapConcurrent(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

// The two LEAGUE marks, which are not clubs and so are not in teams.json — the
// same CDN serves them under the All-Star team ids the All-Star pages already
// draw (159 American League, 160 National League). They are here because the
// standings page gives each league the same navy bar a club gets, and both
// marks are drawn mostly in #008 navy: on that bar the full-color art all but
// disappears, which is exactly the case this knockout art exists for
// (ADR-0031). Listed here rather than dropped in the output directory by hand
// because a full run rewrites that directory from scratch and would delete
// anything it did not write.
const LEAGUE_MARKS = [
  { id: 159, name: 'American League' },
  { id: 160, name: 'National League' },
]

async function teamList() {
  const { bySportId } = JSON.parse(await readFile(teamsPath, 'utf8'))
  const byId = new Map()
  for (const teams of Object.values(bySportId ?? {})) {
    for (const t of teams) {
      if (!t?.id) continue
      if (onlyIds && !onlyIds.has(t.id)) continue
      if (!byId.has(t.id)) byId.set(t.id, t.name ?? String(t.id))
    }
  }
  for (const mark of LEAGUE_MARKS) {
    if (onlyIds && !onlyIds.has(mark.id)) continue
    if (!byId.has(mark.id)) byId.set(mark.id, mark.name)
  }
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id)
}

async function convert(team, inkStore) {
  // 'base' unless the lab picked a different CDN source for this club — see
  // sourceVariantFor (some MiLB clubs' plain base mark converts worse than
  // their primary/cap/wordmark art on the same CDN).
  const variant = sourceVariantFor(inkStore, team.id)
  let svg
  try {
    const res = await fetch(logoCdnUrl(team.id, variant))
    // A club with no art on the CDN isn't an error — MiLB coverage has always
    // been partial, and the app falls back on its own (see TeamLogo.jsx).
    if (!res.ok) return { ...team, skipped: `HTTP ${res.status}` }
    svg = await res.text()
  } catch (err) {
    return { ...team, skipped: `fetch failed (${err.message})` }
  }
  // The hand-picked corrections to the automatic pass, when this club has any
  // and they were picked against THIS art (src/lib/monoInk.js). A pin set the
  // fingerprint rejects is reported below rather than silently ignored — it
  // means a club rebranded and its mark wants another look in the lab.
  const saved = inkStore[String(team.id)]?.parts
  const pins = pinsFor(inkStore, team.id, svg)
  const stalePins = Boolean(saved && Object.keys(saved).length && !pins)
  const mono = monoLogoSvg(svg, { maskId: `ink-${team.id}`, pins })
  if (!mono) return { ...team, skipped: 'not convertible' }
  return {
    ...team,
    svg,
    mono,
    pinned: Boolean(pins),
    stalePins,
    art: monoLogoFingerprint(svg),
    nonBaseSource: variant !== 'base' ? variant : null,
  }
}

function contactSheet(rows) {
  const cells = rows
    .map(
      (r) => `<tr><th>${r.name} <small>#${r.id}</small></th>
<td class="paper">${r.svg ?? ''}</td>
<td class="navy">${r.mono ?? `<em>${r.skipped}</em>`}</td>
<td class="paper">${r.mono ? `<i class="tint" style="--mark:url(&quot;data:image/svg+xml,${encodeURIComponent(r.mono)}&quot;)"></i>` : ''}</td></tr>`,
    )
    .join('\n')
  return `<!doctype html><meta charset="utf-8"><title>Mono logo contact sheet</title><style>
body{font:13px/1.3 system-ui;background:#f6f1e4;margin:0;padding:16px;color:#12233f}
table{border-collapse:collapse}
th{text-align:right;padding-right:10px;font-weight:600;white-space:nowrap}
th small{opacity:.5;font-weight:400}
td{width:80px;height:60px;text-align:center;vertical-align:middle;border:1px solid #d8cfb8}
td svg{width:40px;height:40px;vertical-align:middle}
.navy{background:#12233f;color:#fff}.paper{background:#f6f1e4}
/* The same art used as a CSS mask instead of an <img>: the mark's own alpha is
   the mask, so one asset re-inks to any color. Inlined as a data: URI because
   a mask image is CORS-checked and this sheet is opened straight off disk. */
.tint{display:inline-block;width:40px;height:40px;vertical-align:middle;background:#12233f;
  -webkit-mask:var(--mark) center/contain no-repeat;mask:var(--mark) center/contain no-repeat}
em{opacity:.6;font-size:11px}
thead td{height:auto;font-weight:700;padding:4px;width:auto}
</style><table><thead><tr><th></th><td class="paper">CDN art</td><td class="navy">knockout on navy</td><td class="paper">as a CSS mask, navy ink</td></tr></thead>
${cells}</table>`
}

const teams = await teamList()
const inkStore = await readMonoInkStoreWithOverrides()
const rows = await mapConcurrent(teams, CONCURRENCY, (team) => convert(team, inkStore))

await mkdir(outDir, { recursive: true })

// Rewrite the directory from scratch each run so a club that rebrands into
// unconvertible art (or leaves the team list) can't leave a stale mark behind
// that the app would keep rendering.
const written = new Set()
const hashes = new Map()
for (const row of rows) {
  if (!row.mono) continue
  await writeFile(join(outDir, `${row.id}.svg`), row.mono)
  written.add(`${row.id}.svg`)
  hashes.set(row.id, monoLogoHash(row.mono))
}
if (!onlyIds) {
  for (const name of await readdir(outDir)) {
    if (name.endsWith('.svg') && !written.has(name)) await rm(join(outDir, name))
  }
}

// A --ids= spot-check only touches those clubs' entries, same as the SVG
// directory above leaving the rest of the league's files alone; a full run
// rewrites the manifest from scratch so a club that drops out loses its
// stale entry too.
const existingManifest = onlyIds ? JSON.parse(await readFile(MONO_LOGO_MANIFEST_PATH, 'utf8').catch(() => '{}')) : {}
const manifest = { ...existingManifest }
for (const [id, hash] of hashes) manifest[String(id)] = hash
if (!onlyIds) for (const id of Object.keys(manifest)) if (!written.has(`${id}.svg`)) delete manifest[id]
const sortedManifest = Object.fromEntries(
  Object.keys(manifest)
    .sort((a, b) => Number(a) - Number(b))
    .map((id) => [id, manifest[id]]),
)
await writeFile(MONO_LOGO_MANIFEST_PATH, `${JSON.stringify(sortedManifest, null, 2)}\n`)

if (wantSheet) {
  await mkdir(sheetDir, { recursive: true })
  await writeFile(sheetPath, contactSheet(rows))
}

const skipped = rows.filter((r) => r.skipped)
const pinned = rows.filter((r) => r.pinned)
const stale = rows.filter((r) => r.stalePins)
const nonBase = rows.filter((r) => r.nonBaseSource)
console.log(`wrote ${written.size} mono logos to ${outDir}`)
if (pinned.length) console.log(`${pinned.length} used hand-picked ink/knockout pins (src/lib/data/mono-ink.json)`)
if (nonBase.length) {
  console.log(`${nonBase.length} converted from a non-base CDN source (picked in /identity-lab):`)
  for (const n of nonBase) console.log(`  ${n.id} ${n.name} — ${n.nonBaseSource}`)
}
if (stale.length) {
  console.log(`${stale.length} have pins picked against DIFFERENT art — converted automatically instead:`)
  for (const s of stale) console.log(`  ${s.id} ${s.name} — re-pick in /identity-lab (art is now ${s.art})`)
}
if (skipped.length) {
  console.log(`skipped ${skipped.length} (app falls back to the full-color mark):`)
  for (const s of skipped) console.log(`  ${s.id} ${s.name} — ${s.skipped}`)
}
if (wantSheet) console.log(`contact sheet: ${sheetPath}`)
