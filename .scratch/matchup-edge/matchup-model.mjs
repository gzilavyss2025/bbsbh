import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
const D=fileURLToPath(new URL('../../public/data/',import.meta.url))
const rd=p=>JSON.parse(fs.readFileSync(D+p,'utf8'))
const sh=id=>String(id%100).padStart(2,'0')
const S=a=>(a||[]).reduce((x,y)=>x+y,0)
const CODES=['FF','SI','FC','SL','ST','KC','CH']
const cmd=rd('pitch-command/2026/'+sh(621111)+'.json').pit['621111'].mlb
const lg=rd('hitter-grid/2026/league.json').bat.mlb
const arr=(a,n=25)=>a&&a.length?a:Array(n).fill(0)
// ---- Buehler profile
const inner=[6,7,8,11,12,13,16,17,18]
console.log('BUEHLER by pitch (all batters): n, zone%, whiff/sw, CSW%, HR | league whiff/sw vs RHP')
for(const c of CODES){let n=0,w=0,sw=0,cs=0,hr=0,z=0
 for(const st of ['L','R']){const g=cmd[c]?.[st];if(!g)continue;n+=S(g.cells);w+=S(g.whiffs);sw+=S(g.swings);cs+=S(g.calledStrikes);hr+=S(g.homers);z+=inner.reduce((a,i)=>a+g.cells[i],0)}
 let lw=0,ls=0,lp=0;for(const st of ['L','R']){const g=lg[c].R[st];lw+=S(g.whiffs);ls+=S(g.swings);lp+=S(g.pitches)}
 console.log(c,n,(100*z/n).toFixed(0)+'%',(100*w/sw).toFixed(0)+'% (lg '+(100*lw/ls).toFixed(0)+'%)',(100*(cs+w)/n).toFixed(0)+'%',hr)}
// ---- model
const hit={Turang:[668930,'L'],Yelich:[592885,'L'],Mitchell:[669003,'L'],Frelick:[686217,'L'],Bauers:[641343,'L'],Hamilton:[666152,'L'],Lara:[800325,'L'],Contreras:[661388,'R'],Chourio:[694192,'R'],Ortiz:[687401,'R'],Vaughn:[683734,'R'],Pratt:[806198,'R'],Sanchez:[596142,'R']}
const K_X=60,K_W=75
function lgStat(c,s){const g=lg[c].R[s];return {p:S(g.pitches),sw:S(g.swings),w:S(g.whiffs),pa:S(g.paEnd),x:S(g.xwobaBip)+S(g.wobaFixed)}}
function factors(c,s){ // Buehler location factors vs league for this pitch & stance
 const g=cmd[c]?.[s];const L=lg[c].R[s];if(!g||S(g.cells)<30)return null
 const n=S(g.cells);let xr=0,wr=0
 const lp=S(L.pitches);
 for(let i=0;i<25;i++){const f=g.cells[i]/n;const cp=L.pitches[i]||0;if(!cp)continue
  xr+=f*((L.xwobaBip[i]+L.wobaFixed[i])/cp); wr+=f*((L.whiffs[i])/cp)}
 const lx=(S(L.xwobaBip)+S(L.wobaFixed))/lp, lw=S(L.whiffs)/lp
 return {n,xf:xr/lx,wf:wr/lw}}
const res=[]
for(const [name,[id,s]] of Object.entries(hit)){
 const e=rd('hitter-grid/2026/'+sh(id)+'.json').bat[id]?.mlb||{}
 // Buehler mix by stance
 const tot=CODES.reduce((a,c)=>a+S(cmd[c]?.[s]?.cells),0)
 let ex=0,exL=0,ew=0,ewL=0,wsum=0,wsum2=0,detail=[]
 for(const c of CODES){const g=cmd[c]?.[s];const n=S(g?.cells);if(n<30)continue
  const f=factors(c,s);const L=lgStat(c,s);const h=e[c]?.R?.[s]||{}
  const hp=S(h.pitches),hsw=S(h.swings),hw=S(h.whiffs),hpa=S(h.paEnd),hx=S(h.xwobaBip)+S(h.wobaFixed)
  const lgx=L.x/L.pa, lgw=L.w/L.sw
  const hxS=(hx+K_X*lgx)/(hpa+K_X), hwS=(hw+K_W*lgw)/(hsw+K_W)
  const mix=n/tot
  const wx=mix*(L.pa/L.p) , ww=mix*(L.sw/L.p) // weight by PA-end / swing opportunity
  ex+=wx*hxS*f.xf; exL+=wx*lgx; wsum+=wx
  ew+=ww*hwS*f.wf; ewL+=ww*lgw; wsum2+=ww
  detail.push(`${c} ${(100*mix|0)}%: xw ${hxS.toFixed(3)}(lg ${lgx.toFixed(3)}, locx${f.xf.toFixed(2)}) n=${hpa}`)}
 const hAll=Object.values(e).reduce((a,v)=>{const h=v.R?.[s]||{};a.pa+=S(h.paEnd);a.x+=S(h.xwobaBip)+S(h.wobaFixed);return a},{pa:0,x:0})
 res.push({name,s,xw:ex/wsum,lgxw:exL/wsum,wh:ew/wsum2,lgwh:ewL/wsum2,seas:hAll.x/hAll.pa,pa:hAll.pa,detail})
}
res.sort((a,b)=>(b.xw-b.lgxw)-(a.xw-a.lgxw))
console.log('\nname stance seasonxwOBAvsRHP(PA) | expected xwOBA vs Buehler mix (lg avg same mix) delta | expected whiff/swing (lg)')
for(const r of res)console.log(r.name.padEnd(9),r.s,r.seas.toFixed(3),'('+r.pa+')','|',r.xw.toFixed(3),'(lg '+r.lgxw.toFixed(3)+')',((r.xw-r.lgxw)>=0?'+':'')+(r.xw-r.lgxw).toFixed(3),'|',(100*r.wh).toFixed(0)+'% (lg '+(100*r.lgwh).toFixed(0)+'%)')
console.log('\nLOCATION FACTORS (>1 = Buehler locates to damage zones; whiff factor >1 = whiff zones)')
for(const s of ['L','R'])console.log(s,CODES.map(c=>{const f=factors(c,s);return f?`${c} x${f.xf.toFixed(2)} w${f.wf.toFixed(2)}`:c+' -'}).join(' | '))
