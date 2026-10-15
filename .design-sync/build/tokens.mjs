// Builds tokens/TOKENS.md: every custom property in the design system's tokens/*.css, with a usage line each.
// Run after css.mjs (it reads the finished token files). Usage text lives in usage-data.json.
import fs from 'node:fs'

const OUT = process.env.DS_OUT || 'ds-bundle'
const data = JSON.parse(fs.readFileSync('.design-sync/build/usage-data.json', 'utf8'))
const files = ['colors', 'spacing', 'effects', 'typography', 'layout']
const sec = { colors: 'Colour', spacing: 'Spacing, radius, border width', effects: 'Shadow, motion, texture', typography: 'Type', layout: 'Layout' }
const layoutGeneric = 'App-specific component geometry (headshot rung, lens, console), not part of the look.'

const rows = []
for (const f of files) {
  const css = fs.readFileSync(`${OUT}/tokens/${f}.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const root = css.slice(css.indexOf(':root {'))
  for (const m of root.matchAll(/--([\w-]+):\s*([^;]+);/g)) rows.push({ file: f, name: m[1], value: m[2].replace(/\s+/g, ' ').trim() })
}

for (const r of rows) {
  let u = data.extra[r.name] || data.base[r.name]
  if (!u && r.file === 'layout') u = r.name.startsWith('z-') ? `Layer scale tier (${r.name.slice(2)}). A z-index above 3 reads one of these.` : layoutGeneric
  if (!u) throw new Error(`design-sync: no usage line for --${r.name}. Add it to .design-sync/build/usage-data.json`)
  r.usage = u.replace(/\|/g, '/')
  if (data.flags[r.name] && !r.usage.includes('FLAG')) r.usage += data.flags[r.name]
}

let md = '# Tokens\n\nEvery token below is copied from `src/tokens/*.css` in the bbsbh repo. Names are the CSS custom properties without the leading `--`. The app has one light theme and no dark theme, so every value holds in every theme. A usage line that carries FLAG marks a contrast pair that is under 4.5:1 in the source. The pair is kept exact.\n'
for (const f of files) {
  md += `\n## ${sec[f]} (\`tokens/${f}.css\`)\n\n| token | value | usage |\n| --- | --- | --- |\n`
  for (const r of rows.filter((x) => x.file === f)) md += `| \`${r.name}\` | \`${r.value.replace(/\|/g, '/').slice(0, 90)}\` | ${r.usage} |\n`
}
fs.writeFileSync(`${OUT}/tokens/TOKENS.md`, md)
console.log('tokens ok,', rows.length, 'tokens')
