#!/usr/bin/env node
// An @media width that is not on the list is rejected (#1179).
//
// The wide step is 740px (src/tokens/layout.css). The widths below are the others
// already in use when this guard landed: a GRANDFATHER list. It never shrinks the
// CSS and it moves no layout; it stops the next width from being 735px. A real
// new width goes on the list in the same PR, with its reason, or opts out with
// `breakpoint-exempt: <reason>` in a comment on the @media line or the line above.
//
// The list lives here and is mirrored as a table in src/tokens/layout.css (custom
// properties do not work inside @media, so the table is a comment). The unit test
// fails when a listed width is missing from the table. Only width queries count; heights, features
// (prefers-reduced-motion, hover) and `@container` are not covered.
//
// Scans src/ CSS. Run by `npm run lint`.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk } from '../lib/walk.mjs'

export const WIDTHS = [
  '350px', '359px', '360px', '370px', '420px', '430px', '480px', '520px', '560px',
  '600px', '620px', '640px', '700px', '720px', '739px', '739.98px', '740px', '760px',
  '860px', '899px', '900px', '959.98px', '1024px', '1040px', '1200px', '1279px', '30rem',
]

const EXEMPT = /breakpoint-exempt\s*:\s*\S/
const PRELUDE = /@media([^{]*)\{/g
// Every `(...)` group that names `width` — min-width, max-width or range syntax,
// either side of the operator — and every length inside it.
const WIDTH_GROUP = /\(([^()]*width[^()]*)\)/g
const LENGTH = /[\d.]+(?:px|rem|em)/g

export function findUnlistedWidths(css) {
  const rawLines = css.split('\n')
  const masked = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const found = []
  for (const q of masked.matchAll(PRELUDE)) {
    const line = masked.slice(0, q.index).split('\n').length
    if (EXEMPT.test(rawLines[line - 1]) || EXEMPT.test(rawLines[line - 2] ?? '')) continue
    for (const g of q[1].matchAll(WIDTH_GROUP)) {
      for (const [width] of g[1].matchAll(LENGTH)) if (!WIDTHS.includes(width)) found.push({ line, width })
    }
  }
  return found
}

function main() {
  const files = walk(`${ROOT}/src`, { exts: ['.css'] })
  const problems = []
  for (const file of files) {
    for (const { line, width } of findUnlistedWidths(readFileSync(file, 'utf8'))) {
      problems.push(`${relative(ROOT, file)}:${line}: @media width ${width}`)
    }
  }
  if (problems.length) {
    console.error(`✗ media-width guard: ${problems.length} width(s) not on the list.`)
    for (const p of problems) console.error(`  ${p}`)
    console.error('  Use 740px, or add a `breakpoint-exempt: <reason>` comment. The table is in')
    console.error('  src/tokens/layout.css; the list is WIDTHS in scripts/layout/check-media-widths.mjs.')
    process.exit(1)
  }
  console.log(`✓ media-width guard holds — ${files.length} stylesheets checked, every @media width is on the list.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
