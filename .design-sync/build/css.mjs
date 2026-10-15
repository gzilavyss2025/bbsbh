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

// ---- tokens: five repo files, verbatim, plus one deliberate change in typography.css
for (const f of ['colors', 'spacing', 'effects', 'layout']) wr(`tokens/${f}.css`, rd(`src/tokens/${f}.css`))
let typo = rd('src/tokens/typography.css')
typo = swap(typo, '   - Source Sans 3     → UI + body\n', '')
typo = swap(typo, '  --font-body:    "Source Sans 3", system-ui, sans-serif;\n',
  '  /* Design-system change (Gary): body copy and fact values are JetBrains Mono 500, not Source Sans 3, which is removed from this system. The app repo still has "Source Sans 3", system-ui, sans-serif here. */\n' +
  '  --font-body:    "JetBrains Mono", ui-monospace, "SFMono-Regular", monospace;\n')
typo = swap(typo, 'The canvas draws "Born" at 500. Source Sans 3 is the only family\n     with a real 500 face; Barlow and mono ship one weight each. */',
  'The canvas draws "Born" at 500. In the app Source Sans 3 is the only family\n     with a real 500 face; Barlow and mono ship one weight each. This system ships no Source Sans 3, so the fact value draws JetBrains Mono 500. */')
wr('tokens/typography.css', typo)

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
fonts = swap(fonts, '   - Source Sans 3 ships 400, 500, 600 and 700.\n', '')
fonts = swap(fonts, 'Lora ships TWO, and Source Sans 3 more: the regular', 'Lora ships TWO: the regular')
wr('tokens/fonts.css', "/* Design-system copy of the app's src/tokens/fonts.css: each url() points at ../fonts/, and the Big Shoulders watermark face is removed. The files are OFL 1.1 (fonts/LICENSE-*.txt). Source Sans 3 is removed (Gary): no token uses it. */\n" + fonts.trimEnd() + '\n')

// ---- part styles: the repo's own CSS, then the design-system additions
const team = rd('src/styles/09-team-info.css')
const sectionHead = swap(rd('src/styles/system/section-head.css'),
  '  border-radius: var(--radius-md) var(--radius-md) 0 0;',
  '  /* Design-system change (Gary): square, like every stamped part. The app repo rounds the top corners to var(--radius-md) here. */\n  border-radius: 0;')
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
bundle += '\n' + rd(HERE + 'ds-compact-tile.css')
bundle += '\n/* ==== src/styles/motion/player-rise.css (the player rise) ==== */\n' + rd('src/styles/motion/player-rise.css')
bundle += '\n' + rd(HERE + 'ds-texture.css')
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
