// Builds stage.html: the handoff canvas plus the stage layer (stage.js, stage.css).
// Usage: node .scratch/at-bat-console/stage/build.mjs data-stage.json out.html
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const tpl = fs.readFileSync(path.join(HERE, '../../innings-console-redesign/mockup/template.html'), 'utf8')
const [dataPath, outPath] = process.argv.slice(2)
const data = fs.readFileSync(dataPath, 'utf8')
const html = tpl.replace('/*__DATA__*/null', () => data.replace(/<\//g, '<\\/')).replace('"__TODAY__"', '""')
  .replace('</style>', () => fs.readFileSync(path.join(HERE, 'stage.css'), 'utf8') + '\n</style>')
  .replace(/<\/script>\s*$/, () => '</script>\n<script>\n' + fs.readFileSync(path.join(HERE, 'stage.js'), 'utf8') + '\n</script>\n')
fs.writeFileSync(outPath, html)
console.log('wrote', outPath)
