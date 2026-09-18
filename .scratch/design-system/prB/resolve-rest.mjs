// The 79 rules that never rendered on any route the probe walked (conditional
// states: an IL mark, a hover drop badge, a tied series). Resolve each from the
// nearest rule IN ITS OWN FILE that sets a family for an ancestor selector --
// which is how CSS would resolve it at runtime -- and print the evidence so the
// call can be eyeballed rather than trusted.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const files = []
;(function w(d){for(const f of readdirSync(d)){const p=join(d,f);if(statSync(p).isDirectory())w(p);else if(f.endsWith('.css'))files.push(p)}})('src/styles')
const FACE=(v)=>v.includes('--font-display')?'display':v.includes('--font-mono')?'mono':v.includes('--font-read')?'read':v.includes('--font-body')?'body':'other'
// every selector anywhere that sets a family
const fam=[]
for(const file of files){ const css=readFileSync(file,'utf8'); const re=/([^{}]+)\{([^{}]*)\}/g; let m
  while((m=re.exec(css))){ const sel=m[1].trim().replace(/\s+/g,' '); const f=m[2].match(/font-family\s*:\s*([^;]+);/)
    if(f) for(const s of sel.split(',')) fam.push({file,sel:s.trim(),face:FACE(f[1])}) } }
const out=[]
for(const r of rows){
  if(r.face!=='unknown') continue
  const last=(r.sel.split(',')[0]||'').trim().split(/[\s>+~]/).pop()||''
  const classes=last.split(/[.:]/).filter(Boolean)
  const block=classes[0]||''
  const root=block.split('__')[0].split('--')[0]
  // candidates, most specific first: same file, then anywhere
  const cands=fam.filter(f=>{
    const t=f.sel.replace(/[.:]/g,' ').split(/\s+/).filter(Boolean)
    return t.includes(block)||t.includes(root)||f.sel.includes('.'+root+' ')||f.sel==='.'+root
  })
  const same=cands.filter(c=>c.file===r.file)
  const pick=(same[0]||cands[0])
  out.push({ file:r.file.replace(/.*styles./,''), line:r.line, sel:r.sel.slice(0,52), root,
             guess: pick?pick.face:'body (:root default)', via: pick?pick.sel.slice(0,34):'-' })
}
const by={}; for(const o of out) by[o.guess]=(by[o.guess]||0)+1
console.log('the 79, by resolved face:', by, '\n')
for(const o of out) console.log(`  ${o.guess.padEnd(22)} ${(o.file+':'+o.line).padEnd(38)} ${o.sel.padEnd(52)} via ${o.via}`)
