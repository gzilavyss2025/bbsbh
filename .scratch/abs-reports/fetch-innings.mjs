import { writeFile } from 'node:fs/promises'
const GT='R,F,D,L,W'
function* weeks(a,b){let d=new Date(a+'T00:00:00Z');const end=new Date(b+'T00:00:00Z');while(d<=end){const s=d.toISOString().slice(0,10);const e2=new Date(d);e2.setUTCDate(e2.getUTCDate()+6);const e=(e2>end?end:e2).toISOString().slice(0,10);yield[s,e];d=new Date(e2);d.setUTCDate(d.getUTCDate()+1)}}
const out={}
for (const [sportId,level] of [[1,'MLB'],[11,'AAA']]) {
  for (const [s,e] of weeks('2026-03-20','2026-09-16')) {
    const u=`https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&startDate=${s}&endDate=${e}&gameType=${GT}&hydrate=linescore`
    let r
    for (let a=0;a<2;a++){ try{ r=await (await fetch(u)).json(); break }catch(err){ if(a) throw err } }
    for (const d of r.dates??[]) for (const g of d.games??[]) {
      if (g.status?.abstractGameState!=='Final') continue
      if (d.date!==g.officialDate) continue
      const ls=g.linescore??{}
      const innings=ls.innings??[]
      const last=innings[innings.length-1]
      const bottomPlayed=last && last.home && last.home.runs!=null ? 1 : 0
      out[g.gamePk]={level,fin:ls.currentInning??innings.length??null,bot:bottomPlayed,sched:ls.scheduledInnings??null}
    }
    process.stdout.write('.')
  }
  console.log(' '+level+' done, total '+Object.keys(out).length)
}
await writeFile('.scratch/abs-reports/final-innings.json', JSON.stringify(out))
console.log('games with innings:', Object.keys(out).length)
