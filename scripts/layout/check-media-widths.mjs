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
// fails when the two differ. Only width queries count; heights and features
// (prefers-reduced-motion, hover) are not widths.
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
const FEATURE = /(?:min-|max-)?width\s*:\s*([\d.]+(?:px|rem|em))/g
const RANGE = /width\s*[<>]=?\s*([\d.]+(?:px|rem|em))|([\d.]+(?:px|rem|em))\s*[<>]=?\s*width/g

export function findUnlistedWidths(css) {
  const rawLines = css.split('\n')
  const masked = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const found = []
  for (const q of masked.matchAll(PRELUDE)) {
    const line = masked.slice(0, q.index).split('\n').length
    if (EXEMPT.test(rawLines[line - 1]) || EXEMPT.test(rawLines[line - 2] ?? '')) continue
    for (const m of q[1].matchAll(FEATURE)) if (!WIDTHS.includes(m[1])) found.push({ line, width: m[1] })
    for (const m of q[1].matchAll(RANGE)) {
      const width = m[1] ?? m[2]
      if (!WIDTHS.includes(width)) found.push({ line, width })
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
