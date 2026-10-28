// Run manually; this authoring tool is never part of the nightly data cron.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { poses, renderSprite } from './template.mjs'

const config = JSON.parse(await readFile(process.argv[2] || new URL('./player.json', import.meta.url), 'utf8'))
const output = resolve(process.argv[3] || '.scratch/player-sprites')
// Validate the entire set before writing any files.
const sprites = Object.keys(poses).map(name => [name, renderSprite(config, name)])
await mkdir(output, { recursive: true })
for (const [name, svg] of sprites) await writeFile(resolve(output, `${name}.svg`), svg)
await writeFile(resolve(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Player sprite templates</title>
<style>body{font:16px system-ui;background:#eee9dd;color:#282723}main{display:flex;flex-wrap:wrap}figure{margin:12px;text-align:center}img{background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/16px 16px}</style>
<h1>Player sprite templates</h1><p>Transparent SVG · ${config.heightInches ?? 72} inches · ${config.weightPounds ?? 195} pounds</p><main>
${sprites.map(([name]) => `<figure><img src="${name}.svg" width="192" height="256" alt="${name}"><figcaption><a href="${name}.svg" download>${name}</a></figcaption></figure>`).join('')}</main>`)
console.log(`Exported ${sprites.length} sprites and preview to ${output}`)
