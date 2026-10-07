// Builds stage.html: the handoff canvas plus the stage layer (stage.js, stage.css).
// Usage: node .scratch/at-bat-console/stage/build.mjs data-stage.json out.html
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const tpl = fs.readFileSync(path.join(HERE, '../../innings-console-redesign/mockup/template.html'), 'utf8')
const [dataPath, outPath, mode] = process.argv.slice(2)
// mode 'onescreen' adds round 3's one-screen layer on top of the stage layer.
const css = mode === 'onescreen' ? ['stage.css', 'onescreen.css'] : ['stage.css']
const js = mode === 'onescreen' ? ['stage.js', 'onescreen.js'] : ['stage.js']
const data = fs.readFileSync(dataPath, 'utf8')
const html = tpl.replace('/*__DATA__*/null', () => data.replace(/<\//g, '<\\/')).replace('"__TODAY__"', '""')
  .replace('</style>', () => css.map((f) => fs.readFileSync(path.join(HERE, f), 'utf8')).join('\n') + '\n</style>')
  .replace(/<\/script>\s*$/, () => '</script>\n' + js.map((f) => '<script>\n' + fs.readFileSync(path.join(HERE, f), 'utf8') + '\n</script>').join('\n') + '\n')
fs.writeFileSync(outPath, html)
console.log('wrote', outPath)
