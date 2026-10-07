import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
const D=fileURLToPath(new URL('../../public/data/',import.meta.url))
const sh=id=>String(id%100).padStart(2,'0')
const rd=p=>JSON.parse(fs.readFileSync(D+p,'utf8'))
// Buehler mix
const pa=rd('pitch-arsenal/2026/'+sh(621111)+'.json').pit['621111']
console.log('BUEHLER', pa?.name, JSON.stringify(pa?.mlb?.map(x=>[x.code,x.pitches,x.avgVelo,x.vs&&x.vs.L&&x.vs.L[0],x.vs&&x.vs.R&&x.vs.R[0]])))
const hit={683734:'Vaughn',668930:'Turang',592885:'Yelich',806198:'Pratt',666152:'Hamilton',669003:'Mitchell',596142:'Sanchez',694192:'Chourio',641343:'Bauers',687401:'Ortiz',800325:'Lara',686217:'Frelick',661388:'Contreras'}
const lg=rd('hitter-grid/2026/league.json')
const sum=a=>a?a.reduce((x,y)=>x+y,0):0
function agg(c){return {p:sum(c.pitches),s:sum(c.swings),w:sum(c.whiffs),pa:sum(c.paEnd),x:sum(c.xwobaBip),f:sum(c.wobaFixed)}}
const out={}
for(const [id,n] of Object.entries(hit)){
  const f=rd('hitter-grid/2026/'+sh(+id)+'.json'); const e=f.bat[id]?.mlb||{}
  out[n]={}
  for(const code of Object.keys(e)){const a={p:0,s:0,w:0,pa:0,x:0,f:0}
    for(const th of Object.keys(e[code])) if(th==='R') for(const st of Object.keys(e[code][th])){const g=agg(e[code][th][st]);for(const k in a)a[k]+=g[k]}
    out[n][code]=a}
}
const L={};const le=lg.bat.mlb
for(const code of Object.keys(le)){const a={p:0,s:0,w:0,pa:0,x:0,f:0};const t=le[code].R||{};for(const st of Object.keys(t)){const g=agg(t[st]);for(const k in a)a[k]+=g[k]}L[code]=a}
const codes=['FF','SI','FC','SL','ST','KC','CH']
const fmt=a=>a&&a.p>0?`${a.p}p sw${(100*a.s/a.p|0)}% wh${a.s?(100*a.w/a.s|0):0}% x${a.pa?((a.x+a.f)/a.pa).toFixed(3):'-'}(${a.pa})`:'-'
console.log('LEAGUE vs RHP',codes.map(c=>c+' '+fmt(L[c])).join(' | '))
for(const n of Object.keys(out)) console.log(n.padEnd(9),codes.map(c=>c+' '+fmt(out[n][c])).join(' | '))
console.log(Object.keys(agg({})), Object.keys(Object.values(Object.values(le)[0].R)[0]))
