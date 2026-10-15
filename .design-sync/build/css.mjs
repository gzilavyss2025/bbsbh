// Builds the CSS half of the Tally Baseball design system: tokens/*.css, fonts, base, _ds_bundle.css, styles.css,
// the stub _ds_bundle.js and the update marker. Run from the repo root by run.mjs. Output: $DS_OUT (default ds-bundle).
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.env.DS_OUT || 'ds-bundle'
const HERE = '.design-sync/build/'
const rd = (p) => fs.readFileSync(p, 'utf8')
const wr = (p, s) => { fs.mkdirSync(path.dirname(OUT + '/' + p), { recursive: true }); fs.writeFileSync(OUT + '/' + p, s) }
const swap = (s, from, to) => { if (!s.includes(from)) throw new Error('design-sync: expected text not found, the source changed: ' + from.slice(0, 70)); return s.replace(from, to) }
const block = (src, sel) => {
  const lines = src.split('\n')
  const i = lines.findIndex((l) => l === sel + ' {')
  if (i < 0) throw new Error('design-sync: rule not found: ' + sel)
  let j = i
  while (lines[j] !== '}') j++
  return lines.slice(i, j + 1).join('\n')
}

// ---- tokens: the repo files, verbatim. The app and the project now agree on the body font (#2165)
for (const f of ['colors', 'spacing', 'effects', 'layout', 'typography']) wr(`tokens/${f}.css`, rd(`src/tokens/${f}.css`))

// ---- fonts: the Fontsource files the app bundles, minus Source Sans 3 and Big Shoulders; all OFL 1.1
const FONT_FILES = [
  ['barlow-condensed', 'barlow-condensed-latin-600-normal.woff2'], ['barlow-condensed', 'barlow-condensed-latin-700-normal.woff2'],
  ['jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff2'],
  ['lora', 'lora-latin-400-normal.woff2'], ['lora', 'lora-latin-700-normal.woff2'],
]
for (const [pkg, file] of FONT_FILES) {
  fs.mkdirSync(OUT + '/fonts', { recursive: true })
  fs.copyFileSync(`node_modules/@fontsource/${pkg}/files/${file}`, `${OUT}/fonts/${file}`)
}
for (const pkg of ['barlow-condensed', 'jetbrains-mono', 'lora']) fs.copyFileSync(`node_modules/@fontsource/${pkg}/LICENSE`, `${OUT}/fonts/LICENSE-${pkg}.txt`)
let fonts = rd('src/tokens/fonts.css').replace(/url\("@fontsource\/[a-z0-9-]+\/files\/([^"]+)"\)/g, 'url("../fonts/$1")')
fonts = fonts.replace(/@font-face \{\n  font-family: "Source Sans 3";[\s\S]*?\}\n\n?/g, '')
fonts = fonts.slice(0, fonts.indexOf('/* One weight, one use: the slate'))
fonts = swap(fonts, '   - Source Sans 3 ships 400, 500, 600 and 700, and no CSS rule asks for it since #2165: only the\n     poster canvas (src/lib/preview/posterPaper.js) draws it.\n', '')
fonts = swap(fonts, 'Lora ships TWO, as Source Sans 3 does: the regular', 'Lora ships TWO: the regular')
wr('tokens/fonts.css', "/* Design-system copy of the app's src/tokens/fonts.css: each url() points at ../fonts/, and the Big Shoulders watermark face is removed. The files are OFL 1.1 (fonts/LICENSE-*.txt). Source Sans 3 is removed (Gary): no token uses it. */\n" + fonts.trimEnd() + '\n')

// ---- part styles: the repo's own CSS
const team = rd('src/styles/09-team-info.css')
const sectionHead = rd('src/styles/system/section-head.css') // square and rippled in the app itself (#2165)
let bundle = '/* _ds_bundle.css: the stamped look, copied from the repo. Order follows the app (cluster, card, stamped, jump bar, section head, table, stamp-in). */\n'
const add = (label, css) => { bundle += `\n/* ==== ${label} ==== */\n${css}\n` }
add('src/styles/system/cluster.css', rd('src/styles/system/cluster.css'))
add('src/styles/system/card.css', rd('src/styles/system/card.css'))
add('src/styles/system/section-head.css', sectionHead)
add('src/styles/system/stamped/stamped.css', rd('src/styles/system/stamped/stamped.css'))
add('src/styles/09-team-info.css (the fact rules the fact strip uses)',
  ['.factgrid', '.factgrid__grid', '.fact', '.fact--wide', '.fact__label', '.fact__value', '.fact__na'].map((s) => block(team, s)).join('\n\n'))
add('src/styles/system/jumpbar/jumpbar.css', rd('src/styles/system/jumpbar/jumpbar.css'))
add('src/styles/system/table.css', rd('src/styles/system/table.css'))
add('src/styles/motion/stamp-in.css', rd('src/styles/motion/stamp-in.css'))
bundle += '\n/* ==== src/styles/motion/player-rise.css (the player rise) ==== */\n' + rd('src/styles/motion/player-rise.css')
wr('_ds_bundle.css', bundle)

// ---- base rules, entry stylesheet, stub bundle, update marker
const base = rd('src/styles/01-base.css')
wr('tokens/base.css', `/* BASE: copied rule for rule from src/styles/01-base.css. The app shouts every label in capitals
   with one rule, #root * { text-transform: uppercase }. Put a design in an element with id="root"
   to get the same. The body ground is manila paper with a faint 24px scorebook grid. */
${block(base, ':root')}

${block(base, '*')}

${block(base, '#root *')}

${block(base, 'body')}
`)
wr('styles.css', `/* Tally Baseball: the stamped look (the player-page look, ADR-0109). Light theme only. */
@import "./tokens/fonts.css";
@import "./tokens/colors.css";
@import "./tokens/spacing.css";
@import "./tokens/layout.css";
@import "./tokens/typography.css";
@import "./tokens/effects.css";
@import "./tokens/base.css";
@import "./_ds_bundle.css";
`)
wr('_ds_bundle.js', '/* @ds-bundle: {"namespace":"TallyBaseball","components":[],"sourceHashes":{},"inlinedExternals":[],"builtBy":"cc-design-sync"} */\n(function(){window.TallyBaseball={};})();\n')
wr('_ds_needs_recompile', 'by: claude-code design-sync\n')
wr('README.md', rd(HERE + 'README.template.md'))
console.log('css ok')
