import { writeFile } from 'node:fs/promises'
const out=[]
for (const [sportId,level] of [[1,'MLB'],[11,'AAA']]) {
  const t=await (await fetch(`https://statsapi.mlb.com/api/v1/teams?sportId=${sportId}&season=2026`)).json()
  for (const team of t.teams) {
    const u=`https://statsapi.mlb.com/api/v1/teams/${team.id}/roster?rosterType=fullSeason&season=2026`
      +`&hydrate=person(stats(type=season,group=[hitting,fielding],season=2026,sportId=${sportId}))`
    let r; for(let a=0;a<2;a++){try{r=await (await fetch(u)).json();break}catch(e){if(a)throw e}}
    for (const p of r.roster??[]) {
      const person=p.person??{}
      const gs=person.stats??[]
      const hit=(gs.find(g=>g.group?.displayName==='hitting')?.splits??[]).find(s=>s.team?.id===team.id)
      const fldSplits=(gs.find(g=>g.group?.displayName==='fielding')?.splits??[]).filter(s=>s.team?.id===team.id)
      const c=fldSplits.find(s=>s.position?.abbreviation==='C')
      const innStr=c?.stat?.innings
      const inn=innStr!=null?(()=>{const[a,b]=String(innStr).split('.');return Number(a)+(Number(b||0)/3)})():null
      if(!hit && !c) continue
      out.push({level,teamId:team.id,playerId:person.id,name:person.fullName,
        pos:p.position?.abbreviation??null,
        pitches:hit?.stat?.numberOfPitches??null, pa:hit?.stat?.plateAppearances??null,
        gamesPlayed:hit?.stat?.gamesPlayed??null,
        cInnings:inn, cStarts:c?.stat?.gamesStarted??null, cGames:c?.stat?.games??null})
    }
    process.stdout.write('.')
  }
  console.log(' '+level+' done, rows '+out.length)
}
await writeFile('.scratch/abs-reports/exposure.json', JSON.stringify(out))
